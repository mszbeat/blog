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
import { Button } from '@/components/ui/button';
import { Field, Input, Switch, Textarea } from '@/components/ui/form';
import { Alert, Badge, Card, CardHeader, Spinner } from '@/components/ui/primitives';
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

  const [coverUrl, setCoverUrl] = useState<string | null>(post?.coverImage ?? null);
  /** Instagram-style gallery, upload order. Shown as a carousel on the post. */
  const [images, setImages] = useState<string[]>(post?.images ?? []);
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
      setCoverUrl(post.coverImage ?? null);
      setImages(post.images ?? []);
    }
  }, [mode, post, reset]);

  const toggleCategory = (id: string) => {
    setValue(
      'categories',
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
      { shouldDirty: true },
    );
  };

  /* ── cover upload (client-side checks mirror the ParseFilePipe) ── */
  const handleFile = async (file?: File | null) => {
    setFileError(null);
    if (!file) return;

    if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setFileError(locale === 'fa' ? 'فقط PNG، JPG، JPEG یا WEBP مجاز است' : 'Only PNG, JPG, JPEG or WEBP are allowed');
      return;
    }
    if (file.size > MAX_FILE) {
      setFileError(locale === 'fa' ? 'حجم فایل باید کمتر از ۵ مگابایت باشد' : 'File must be under 5 MB');
      return;
    }

    try {
      const res = await uploadCover.mutateAsync(file);
      setCoverUrl(res.url);
      setValue('excerpt', excerpt, { shouldDirty: true }); // keep dirty state coherent
      toast.success(t('uploadCover'));
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      setFileError(msg);
      toast.error(tc('error'), msg);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* ── gallery (multi-select) ── */
  const MAX_GALLERY = 10;
  const handleGallery = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFileError(null);
    const files = Array.from(list);
    if (images.length + files.length > MAX_GALLERY) {
      setFileError(locale === 'fa' ? `حداکثر ${MAX_GALLERY} عکس در گالری` : `At most ${MAX_GALLERY} photos in the gallery`);
      return;
    }
    const urls: string[] = [];
    try {
      for (const file of files) {
        if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type)) {
          setFileError(locale === 'fa' ? 'فقط PNG، JPG، JPEG یا WEBP مجاز است' : 'Only PNG, JPG, JPEG or WEBP are allowed');
          continue;
        }
        if (file.size > MAX_FILE) {
          setFileError(locale === 'fa' ? 'حجم هر فایل باید کمتر از ۵ مگابایت باشد' : 'Each file must be under 5 MB');
          continue;
        }
        const res = await uploadCover.mutateAsync(file);
        urls.push(res.url);
      }
      if (urls.length) {
        setImages((prev) => [...prev, ...urls]);
        toast.success(t('gallery'));
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      setFileError(msg);
      toast.error(tc('error'), msg);
    } finally {
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  /* ── submit ── */
  const onSubmit = async (values: Form) => {
    setFormError(null);

    // Build a payload containing ONLY the DTO's fields.
    const payload: CreatePostPayload = {
      title: values.title.trim(),
      content: values.content,
      published: values.published,
    };
    if (values.excerpt?.trim()) payload.excerpt = values.excerpt.trim();
    if (coverUrl) payload.coverImage = coverUrl;
    if (images.length) {
      payload.images = images;
      // Cards and Open Graph need a single thumbnail — fall back to slide 1.
      if (!payload.coverImage) payload.coverImage = images[0];
    }
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

  const cover = resolveMedia(coverUrl);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {formError && (
        <Alert tone="danger" title={tc('error')}>
          {formError}
        </Alert>
      )}

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
                <Textarea
                  id="content"
                  rows={16}
                  placeholder={t('contentPlaceholder')}
                  invalid={!!errors.content}
                  className="font-mono text-[13px] leading-relaxed"
                  {...register('content')}
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

          {/* Cover */}
          <Card>
            <CardHeader title={t('coverImage')} icon={<ImagePlus className="size-[18px]" aria-hidden />} />
            <div className="space-y-3 p-5">
              {cover ? (
                <div className="group relative overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverUrl(null)}
                    className="absolute top-2 rounded-lg bg-slate-900/80 p-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-rose-600 focus:opacity-100"
                    style={{ insetInlineEnd: '0.5rem' }}
                    aria-label={tc('delete')}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    'flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition',
                    dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-line-strong bg-surface-2 hover:border-brand-400',
                  )}
                >
                  {uploadCover.isPending ? (
                    <>
                      <Spinner className="text-brand-500" />
                      <span className="text-xs font-semibold text-ink-3">{t('uploading')}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-5 text-ink-3" aria-hidden />
                      <span className="text-xs font-semibold text-ink-2">{t('uploadCover')}</span>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                    disabled={uploadCover.isPending}
                  />
                </label>
              )}

              {fileError && <p role="alert" className="text-xs font-medium text-rose-600">{fileError}</p>}

              <p className="text-xs leading-relaxed text-ink-3">
                {t('coverUploadHint')}
              </p>
              <p className="num-en text-[11px] text-ink-3">
                {locale === 'fa' ? 'حداکثر ۵ مگابایت · PNG/JPG/WEBP' : 'Max 5 MB · PNG/JPG/WEBP'}
              </p>

              {cover && (
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" aria-hidden />
                  {locale === 'fa' ? 'تغییر تصویر' : 'Replace image'}
                </Button>
              )}
            </div>
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
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((url, i) => (
                    <div key={url + i} className="group relative overflow-hidden rounded-lg border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMedia(url) ?? url} alt="" className="aspect-square w-full object-cover" />
                      <span className="num-en absolute top-1 rounded bg-slate-950/70 px-1.5 text-[10px] font-bold text-white" style={{ insetInlineStart: '0.25rem' }}>
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 rounded-md bg-slate-900/80 p-1 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-rose-600 focus:opacity-100"
                        style={{ insetInlineEnd: '0.25rem' }}
                        aria-label={tc('delete')}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface-2 px-4 py-3 text-xs font-semibold text-ink-2 transition hover:border-brand-400">
                {uploadCover.isPending ? <Spinner className="text-brand-500" /> : <Upload className="size-4 text-ink-3" aria-hidden />}
                {t('addImages')}
                <input
                  ref={galleryRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={(e) => void handleGallery(e.target.files)}
                  disabled={uploadCover.isPending}
                />
              </label>
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

      {/* ── Sticky action bar ── */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/90 p-3 shadow-lg shadow-black/5 backdrop-blur-xl">
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
          {isDirty && (
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
          <Button type="submit" loading={isSubmitting} size="md">
            {!isSubmitting && <Save className="size-4" aria-hidden />}
            {isSubmitting ? tc('saving') : tc('save')}
          </Button>
        </div>
      </div>
    </form>
  );
}
