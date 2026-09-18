'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useCreateUser } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import type { Locale, UserRole } from '@/lib/types';

/** Admin-only "create user" modal — POST /users with CreateUserDto. */
export function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const tv = useTranslations('validation');
  const toast = useToast();
  const createMut = useCreateUser();
  const [error, setError] = useState<string | null>(null);

  /** CreateUserDto: name, email, password(min 6), confirmPassword(@Match), role?, bio? */
  const schema = z
    .object({
      name: z.string().min(1, tv('nameRequired')),
      email: z.string().min(1, tv('required')).email(tv('email')),
      password: z.string().min(6, tv('minLength', { count: 6 })),
      confirmPassword: z.string().min(1, tv('required')),
      role: z.enum(['admin', 'user', 'guest']),
      bio: z.string().optional().or(z.literal('')),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: tv('passwordMatch'),
      path: ['confirmPassword'],
    });
  type Form = z.infer<typeof schema>;

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: 'user', bio: '' },
  });

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset();
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  if (!open) return null;

  const submit = async (values: Form) => {
    setError(null);
    try {
      // Only DTO fields; `bio` is omitted when blank.
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        role: values.role as UserRole,
        ...(values.bio?.trim() ? { bio: values.bio.trim() } : {}),
      };
      await createMut.mutateAsync(payload);
      toast.success(t('createdSuccess'));
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
          <h2 className="text-base font-bold text-ink">{t('newUser')}</h2>
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
            <Field label={tc('name')} required htmlFor="u-name" error={form.formState.errors.name?.message}>
              <Input id="u-name" autoComplete="name" invalid={!!form.formState.errors.name} {...form.register('name')} />
            </Field>

            <Field label={tc('role')} required htmlFor="u-role">
              <Select id="u-role" {...form.register('role')}>
                <option value="user">{t('roleUser')}</option>
                <option value="admin">{t('roleAdmin')}</option>
                <option value="guest">{t('roleGuest')}</option>
              </Select>
            </Field>
          </div>

          <Field label={tc('email')} required htmlFor="u-email" error={form.formState.errors.email?.message}>
            <Input
              id="u-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="user@example.com"
              invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc('password')} required htmlFor="u-pw" hint={ta('passwordHint')} error={form.formState.errors.password?.message}>
              <Input id="u-pw" type="password" dir="ltr" autoComplete="new-password" invalid={!!form.formState.errors.password} {...form.register('password')} />
            </Field>

            <Field label={ta('confirmPassword')} required htmlFor="u-pw2" error={form.formState.errors.confirmPassword?.message}>
              <Input id="u-pw2" type="password" dir="ltr" autoComplete="new-password" invalid={!!form.formState.errors.confirmPassword} {...form.register('confirmPassword')} />
            </Field>
          </div>

          <Field label={tc('bio')} htmlFor="u-bio" optionalLabel={tc('optional')}>
            <Textarea id="u-bio" rows={2} {...form.register('bio')} />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={createMut.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" loading={createMut.isPending}>
              {createMut.isPending ? tc('saving') : tc('create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
