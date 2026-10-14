'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight, Check, ImagePlus, Loader2, Save, Trash2, Upload, X,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useCategories, useUploadCover } from '@/lib/queries';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Button } from '@/components/ui/button';
import { Field, Input, Switch, Textarea } from '@/components/ui/form';
import { Alert, Badge, Card, CardHeader, Spinner } from '@/components/ui/primitives';
import { getPostImages, postImagePayload } from '@/lib/post-images';
import { cn, resolveMedia } from '@/lib/utils';
import type { CreatePostPayload, Locale, Post } from '@/lib/types';

const MAX_TITLE = 200;    // CreatePostDto @MaxLength(200)
const MAX_EXCERPT = 300;  // CreatePostDto @MaxLength(300)
const MAX_FILE = 5 * 1024 * 1024; // ParseFilePipe maxSize
const ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Shared create/edit form.
 *
 * Two things the backend forces on us:
 *  • `coverImage` is just a URL string — the file must be uploaded FIRST via
 *    POST /uploads/cover, then its URL saved with the post.
 *  • ValidationPipe runs with forbidNonWhitelisted, so the payload must contain
 *    ONLY the DTO fields (never `id`, `slug`, `author`, …).
 */
export function PostEditor({ post, mode }: { post?: Post; mode: 'create' | 'edit' }) {
  const locale = useLocale() as Locale;
  const rtl = locale === 'fa';
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const router = useRouter();
  const toast = useToast();

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const uploadCover = useUploadCover();

  // One ordered list owns both gallery and cover; no independent cover state.
  const [images, setImages] = useState<string[]>(() => getPostImages(post));
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const schema = z.object({
    title: z.string().min(1, tv('titleRequired')).max(MAX_TITLE, tv('maxLength', { count: MAX_TITLE })),
    content: z.string().min(1, tv('contentRequired')),
    excerpt: z.string().max(MAX_EXCERPT, tv('maxLength', { count: MAX_EXCERPT })).optional().or(z.literal('')),
    published: z.boolean(),
    categories: z.array(z.string().uuid()).optional(),
  });
  type Form = z.infer<typeof schema>;

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: post?.title ?? '',
      content: post?.content ?? '',
      excerpt: post?.excerpt ?? '',
      published: post?.published ?? false,
      categories: post?.categories?.map((c) => c.id) ?? [],
    },
  });

  const selected = watch('categories') ?? [];
  const title = watch('title');
  const excerpt = watch('excerpt') ?? '';
  const content = watch('content');

  // Keep the form in sync if the post arrives late (edit mode).
  useEffect(() => {
    if (mode === 'edit' && post) {
      reset({
        title: post.title ?? '',
        content: post.content ?? '',
        excerpt: post.excerpt ?? '',
        published: post.published ?? false,
        categories: post.categories?.map((c) => c.id) ?? [],
      });
      setImages(getPostImages(post));
    }
  }, [mode, post, reset]);

  const toggleCategory = (id: string) => {
    setValue(
      'categories',
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
      { shouldDirty: true },
    );
  };

  /* One multi-file upload control. Serial uploads preserve selection order.
   * Keep each successful upload even if a later file fails; lock the entire
   * batch (not just the individual mutation) to prevent overlapping batches. */
  const MAX_GALLERY = 10;
  const handleGallery = async (list: FileList | null) => {
    if (!list?.length || uploadLock.current || isSubmitting) return;
    setFileError(null);
    const files = Array.from(list);
    if (galleryRef.current) galleryRef.current.value = '';
    if (images.length + files.length > MAX_GALLERY) {
      setFileError(t('galleryLimit', { count: MAX_GALLERY }));
      return;
    }
    if (files.some(file => !/\.(png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type))) {
      setFileError(t('imageTypeError'));
      return;
    }
    if (files.some(file => file.size > MAX_FILE)) {
      setFileError(t('imageSizeError'));
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    const failures: string[] = [];
    let successes = 0;
    try {
      for (const file of files) {
        try {
          const res = await uploadCover.mutateAsync(file);
          setImages(prev => [...prev, res.url]);
          successes++;
        } catch (error) {
          const message = error instanceof ApiError ? error.messageFor(locale, tc('error')) : tc('error');
          failures.push(`${file.name}: ${message}`);
        }
      }
      if (successes) toast.success(t('gallery'));
      if (failures.length) {
        const message = failures.join(' · ');
        setFileError(message);
        toast.error(tc('error'), message);
      }
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  };

  /* ── submit ── */
  const onSubmit = async (values: Form) => {
    if (uploadLock.current) return;
    setFormError(null);

    // Build a payload containing ONLY the DTO's fields.
    const payload: CreatePostPayload = {
      title: values.title.trim(),
      content: values.content,
      published: values.published,
    };
    if (values.excerpt?.trim()) payload.excerpt = values.excerpt.trim();
    Object.assign(payload, postImagePayload(images));
    if (values.categories?.length) payload.categories = values.categories;

    try {
      if (mode === 'create') {
        const { api } = await import('@/lib/api');
        const created = await api.createPost(payload);
        toast.success(t('createdSuccess'));
        router.push(`/posts/${created.slug}`);
      } else if (post) {
        const { api } = await import('@/lib/api');
        const updated = await api.updatePost(post.id, payload);
        toast.success(t('savedSuccess'));
        router.push(`/posts/${updated.slug}`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const msg = e.messageFor(locale, tc('error'));
        setFormError(msg);
        toast.error(tc('error'), msg);
      } else {
        setFormError(tc('error'));
      }
    }
  };

  const imagesDirty = JSON.stringify(images) !== JSON.stringify(getPostImages(post));

  return (
    
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {formError && (
        <Alert tone="danger" title={tc('error')}>
          {formError}
        </Alert>
      )}

{/* ── Sticky action bar ── */}
      <div className="sticky top-17 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/90 p-3 shadow-lg shadow-black/5 backdrop-blur-xl ">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowRight className={cn('size-4', !rtl && 'rotate-180')} aria-hidden />
            {tc('cancel')}
          </Button>
          {(isDirty || imagesDirty) && (
            <span className="text-xs font-medium text-amber-600">
              {locale === 'fa' ? 'تغییرات ذخیره‌نشده' : 'Unsaved changes'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'edit' && post && (
            <Button type="button" variant="danger" size="sm" onClick={() => toast.info(t('deleteConfirmTitle'))}>
              <Trash2 className="size-3.5" aria-hidden />
              {tc('delete')}
            </Button>
          )}
          <Button type="submit" loading={isSubmitting} disabled={uploading} size="md">
            {!isSubmitting && <Save className="size-4" aria-hidden />}
            {isSubmitting ? tc('saving') : tc('save')}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title={mode === 'create' ? t('newPost') : t('editPost')}
              icon={<Save className="size-[18px]" aria-hidden />}
            />
            <div className="space-y-5 p-5">
              <Field
                label={t('title')}
                required
                htmlFor="title"
                hint={t('slugNote')}
                error={errors.title?.message}
              >
                <Input
                  id="title"
                  placeholder={t('titlePlaceholder')}
                  invalid={!!errors.title}
                  maxLength={MAX_TITLE}
                  {...register('title')}
                />
                <span className="num-en mt-1 block text-end text-xs text-ink-3">
                  {title.length}/{MAX_TITLE}
                </span>
              </Field>

              <Field label={t('excerpt')} htmlFor="excerpt" optionalLabel={tc('optional')} error={errors.excerpt?.message}>
                <Textarea
                  id="excerpt"
                  rows={2}
                  placeholder={t('excerptPlaceholder')}
                  invalid={!!errors.excerpt}
                  maxLength={MAX_EXCERPT}
                  {...register('excerpt')}
                />
                <span className="num-en mt-1 block text-end text-xs text-ink-3">
                  {excerpt.length}/{MAX_EXCERPT}
                </span>
              </Field>

              <Field label={t('content')} required htmlFor="content" error={errors.content?.message}>
                <Controller
                  name="content"
                  control={control}
                  render={({ field }) => (
                    <MarkdownEditor key={post?.id ?? 'new'} id="content" value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} invalid={!!errors.content} placeholder={t('contentPlaceholder')} />
                  )}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* ── Side column ── */}
        <div className="space-y-5">
          {/* Publish */}
          <Card className="p-5">
            <h2 className="text-sm font-bold text-ink">{tc('status')}</h2>
            <div className="mt-3">
              <Controller
                name="published"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={!!field.value}
                    onChange={field.onChange}
                    label={field.value ? t('published') : t('draft')}
                    description={
                      field.value
                        ? (locale === 'fa' ? 'برای همه قابل مشاهده است' : 'Visible to everyone')
                        : (locale === 'fa' ? 'فقط شما می‌بینید' : 'Only visible to you')
                    }
                  />
                )}
              />
            </div>
            <Badge tone={watch('published') ? 'success' : 'warning'} className="mt-3">
              {watch('published') ? t('published') : t('draft')}
            </Badge>
          </Card>

          {/* Gallery */}
          <Card>
            <CardHeader
              title={t('gallery')}
              description={t('galleryHint')}
              icon={<ImagePlus className="size-[18px]" aria-hidden />}
            />
            <div className="space-y-3 p-5">
              {images.length > 0 && (
                <div className="grid grid-cols-2 items-start gap-2" data-testid="post-image-previews">
                  {images.map((url, i) => (
                    <div key={url + i} className="group relative overflow-hidden rounded-lg border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMedia(url) ?? url} alt="" className="block h-auto w-full object-contain" />
                      <span className="num-en absolute top-1 rounded bg-slate-950/70 px-1.5 text-[10px] font-bold text-white" style={{ insetInlineStart: '0.25rem' }}>
                        {i === 0 ? t('coverBadge') : i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        disabled={uploading || isSubmitting}
                        className="absolute top-1 rounded-md bg-slate-900/80 p-1 text-white backdrop-blur transition hover:bg-rose-600 disabled:opacity-50"
                        style={{ insetInlineEnd: '0.25rem' }}
                        aria-label={tc('delete')}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label
                onDragOver={(e) => { e.preventDefault(); if (!uploading && !isSubmitting) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleGallery(e.dataTransfer.files); }}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-xs font-semibold text-ink-2 transition focus-within:ring-2 focus-within:ring-brand-400',
                  uploading || isSubmitting ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-brand-400',
                  dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-line-strong bg-surface-2',
                )}
              >
                {uploading ? <Spinner className="text-brand-500" /> : <Upload className="size-4 text-ink-3" aria-hidden />}
                <span role="status">{uploading ? t('uploading') : t('addImages')}</span>
                <input
                  ref={galleryRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  aria-label={t('addImages')}
                  className="sr-only"
                  onChange={(e) => void handleGallery(e.target.files)}
                  disabled={uploading || isSubmitting}
                />
              </label>
              {fileError && <p role="alert" className="text-xs font-medium text-danger-600">{fileError}</p>}
              <p className="text-xs leading-relaxed text-ink-3">{t('imageUploadLimits')}</p>
            </div>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader title={t('categories')} icon={<Check className="size-[18px]" aria-hidden />} />
            <div className="p-4">
              {catsLoading ? (
                <div className="flex items-center gap-2 p-2 text-sm text-ink-3">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tc('loading')}
                </div>
              ) : categories.length === 0 ? (
                <p className="p-2 text-sm text-ink-3">{tc('noData')}</p>
              ) : (
                <Controller
                  name="categories"
                  control={control}
                  render={() => (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => {
                        const on = selected.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCategory(c.id)}
                            aria-pressed={on}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98]',
                              on
                                ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                                : 'border-line-strong bg-surface text-ink-2 hover:border-brand-400 hover:text-brand-600',
                            )}
                          >
                            {on && <Check className="size-3" aria-hidden />}
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              )}
              {errors.categories && (
                <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
                  {errors.categories.message as string}
                </p>
              )}
              <p className="num-en mt-3 text-xs text-ink-3">
                {selected.length} {locale === 'fa' ? 'انتخاب شده' : 'selected'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
