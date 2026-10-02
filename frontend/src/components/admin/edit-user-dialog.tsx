'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldAlert, X } from 'lucide-react';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useAdminUpdateUser } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Avatar } from '@/components/ui/primitives';
import type { Locale, User, UserRole } from '@/lib/types';

/**
 * Admin-only "edit user" modal — PATCH /users/:id/admin (AdminUpdateUserDto).
 *
 * This is the privileged twin of CreateUserDialog and the ONLY surface in the
 * app that can rewrite another person's `email` or `role`, so an ordinary
 * `user` can be promoted to `admin` (and back) from here.
 *
 * Two deliberate differences from the create form:
 *  - No password fields. AdminUpdateUserDto declares none, and
 *    `forbidNonWhitelisted` would reject the request outright. Password changes
 *    stay with the account owner (`PATCH /users/me/password`).
 *  - Only fields that actually changed are sent, so opening the dialog and
 *    saving it cannot silently overwrite a concurrent edit.
 */
export function EditUserDialog({
  open, user, onClose,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const toast = useToast();
  const updateMut = useAdminUpdateUser();
  const { user: me } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(1, tv('nameRequired')).max(255),
    email: z.string().min(1, tv('required')).email(tv('email')).max(255),
    bio: z.string().max(1000).optional().or(z.literal('')),
    role: z.enum(['admin', 'user', 'guest']),
  });
  type Form = z.infer<typeof schema>;

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', bio: '', role: 'user' },
  });

  /* Seed from the selected row each time the dialog opens — `user` changes
   * without `open` changing when the admin clicks a different row. */
  useEffect(() => {
    if (!open || !user) return;
    form.reset({
      name: user.name ?? '',
      email: user.email ?? '',
      bio: user.bio ?? '',
      role: (user.role ?? 'user') as UserRole,
    });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !user) return null;

  const values = form.watch();
  const isSelf = me?.id === user.id;
  /** Demoting yourself is the one irreversible-feeling mistake worth flagging. */
  const selfDemotion = isSelf && values.role !== 'admin';
  const roleChanged = values.role !== (user.role ?? 'user');

  const submit = async (next: Form) => {
    setError(null);

    const payload = {
      ...(next.name.trim() !== (user.name ?? '') ? { name: next.name.trim() } : {}),
      ...(next.email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()
        ? { email: next.email.trim() } : {}),
      ...(next.bio?.trim() !== (user.bio ?? '') ? { bio: next.bio?.trim() ?? '' } : {}),
      ...(next.role !== user.role ? { role: next.role as UserRole } : {}),
    };

    if (Object.keys(payload).length === 0) {
      toast.info(tc('noChanges'));
      onClose();
      return;
    }

    try {
      await updateMut.mutateAsync({ id: user.id, payload });
      toast.success(t('updatedSuccess'));
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />

      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl shadow-black/20 animate-fade-up">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={user.avatar} name={user.name} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-ink">{t('editUser')}</h2>
              <p className="num-en truncate text-xs text-ink-3" dir="ltr">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink"
            aria-label={tc('close')}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(submit)} className="space-y-4 p-5" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc('name')} required htmlFor="eu-name" error={form.formState.errors.name?.message}>
              <Input id="eu-name" autoComplete="off" invalid={!!form.formState.errors.name} {...form.register('name')} />
            </Field>

            <Field
              label={tc('role')}
              required
              htmlFor="eu-role"
              hint={roleChanged ? t('roleChangeHint') : undefined}
            >
              <Select id="eu-role" {...form.register('role')}>
                <option value="user">{t('roleUser')}</option>
                <option value="admin">{t('roleAdmin')}</option>
                <option value="guest">{t('roleGuest')}</option>
              </Select>
            </Field>
          </div>

          <Field label={tc('email')} required htmlFor="eu-email" error={form.formState.errors.email?.message}>
            <Input
              id="eu-email"
              type="email"
              dir="ltr"
              autoComplete="off"
              invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
          </Field>

          <Field label={tc('bio')} htmlFor="eu-bio" optionalLabel={tc('optional')}>
            <Textarea id="eu-bio" rows={3} {...form.register('bio')} />
          </Field>

          {selfDemotion && (
            <Alert tone="warning">
              <span className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('selfDemotionWarning')}
              </span>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={updateMut.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" loading={updateMut.isPending}>
              {updateMut.isPending ? tc('saving') : tc('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
