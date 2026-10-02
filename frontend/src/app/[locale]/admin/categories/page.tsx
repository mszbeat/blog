'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useCategories, useDeleteCategory } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import {
  Card, CardHeader, EmptyState, Skeleton,
} from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn, gradientFor } from '@/lib/utils';
import type { Category, Locale } from '@/lib/types';

const MAX_NAME = 50;         // CreateCategoryDto @MaxLength(50)
const MAX_DESCRIPTION = 200; // CreateCategoryDto @MaxLength(200)

export default function AdminCategoriesPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('categories');
  const tc = useTranslations('common');
  const toast = useToast();

  const { data: categories, isLoading, isError, refetch } = useCategories();
  const deleteMut = useDeleteCategory();

  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const openNew = () => {
    setEditing('new');
    setName('');
    setDescription('');
    setFormError(null);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name ?? '');
    setDescription(c.description ?? '');
    setFormError(null);
  };

  const closeForm = () => {
    setEditing(null);
    setFormError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { api } = await import('@/lib/api');
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(locale === 'fa' ? 'نام دسته الزامی است' : 'Category name is required');
      return;
    }
    if (trimmedName.length > MAX_NAME) {
      setFormError(locale === 'fa' ? `حداکثر ${MAX_NAME} نویسه` : `Max ${MAX_NAME} characters`);
      return;
    }

    // Only send `description` when non-empty (PartialType → optional field).
    const payload: { name: string; description?: string } = { name: trimmedName };
    if (description.trim()) payload.description = description.trim();

    setSaving(true);
    try {
      if (editing === 'new') {
        await api.createCategory(payload);
        toast.success(t('createdSuccess'));
      } else if (editing) {
        await api.updateCategory(editing.id, payload);
        toast.success(t('updatedSuccess'));
      }
      closeForm();
      void refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.messageFor(locale, tc('error')) : String(err);
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMut.mutateAsync(pendingDelete.id);
      toast.success(t('deletedSuccess'));
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      toast.error(tc('error'), msg);
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t('title')}
          description={t('adminOnly')}
          icon={<Layers className="size-[18px]" aria-hidden />}
          action={
            <Button size="sm" onClick={openNew} disabled={editing !== null}>
              <Plus className="size-4" aria-hidden />
              {t('newCategory')}
            </Button>
          }
        />

        {/* ── Inline create / edit form ── */}
        {editing !== null && (
          <form onSubmit={save} className="space-y-4 border-b border-line bg-surface-2 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">
                {editing === 'new' ? t('newCategory') : t('editCategory')}
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
                {tc('cancel')}
              </Button>
            </div>

            {formError && (
              <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {formError}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('name')} required htmlFor="c-name">
                <Input
                  id="c-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                  placeholder={t('namePlaceholder')}
                  maxLength={MAX_NAME}
                  autoFocus
                />
                <span className="num-en mt-1 block text-end text-xs text-ink-3">
                  {name.length}/{MAX_NAME}
                </span>
              </Field>

              <Field label={t('description')} htmlFor="c-desc" optionalLabel={tc('optional')}>
                <Textarea
                  id="c-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                  placeholder={t('descriptionPlaceholder')}
                  maxLength={MAX_DESCRIPTION}
                />
                <span className="num-en mt-1 block text-end text-xs text-ink-3">
                  {description.length}/{MAX_DESCRIPTION}
                </span>
              </Field>
            </div>

            {editing !== 'new' && (
              <p className="num-en text-xs text-ink-3">
                {t('slug')}: <code dir="ltr" className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px]">/{editing.slug}</code>
                {name.trim() && name.trim() !== editing.name && (
                  <span className="ms-2 text-amber-600">
                    {locale === 'fa' ? '— با تغییر نام، slug دوباره ساخته می‌شود' : '— changing the name regenerates the slug'}
                  </span>
                )}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
                {tc('cancel')}
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? tc('saving') : tc('save')}
              </Button>
            </div>
          </form>
        )}

        {/* ── List ── */}
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title={tc('error')}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{tc('retry')}</Button>}
          />
        ) : !categories?.length ? (
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title={t('noCategories')}
            description={t('noCategoriesDesc')}
            action={<Button size="sm" onClick={openNew}>{t('newCategory')}</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-4 p-4 transition hover:bg-surface-2">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-white', gradientFor(c.slug))}>
                  <Layers className="size-[18px]" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/categories/${c.slug}`}
                      className="truncate text-sm font-semibold text-ink transition hover:text-brand-600 dark:hover:text-brand-300"
                    >
                      {c.name}
                    </Link>
                    <code dir="ltr" className="num-en rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      /{c.slug}
                    </code>
                  </div>
                  {c.description ? (
                    <p className="mt-1 line-clamp-1 text-xs text-ink-3">{c.description}</p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-3/60">{locale === 'fa' ? 'بدون توضیحات' : 'No description'}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="secondary" size="iconSm" onClick={() => openEdit(c)} aria-label={t('editCategory')} title={t('editCategory')}>
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => setPendingDelete(c)}
                    aria-label={t('deleteCategory')}
                    title={t('deleteCategory')}
                    className="hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleteMut.isPending}
        title={t('confirmDeleteTitle')}
        description={t('confirmDeleteDesc', { name: pendingDelete?.name ?? '' })}
        confirmLabel={tc('delete')}
      />
    </div>
  );
}
