'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AtSign, Check, Eye, EyeOff, Info, Lock, UserPlus, X } from 'lucide-react';
import { Link, redirect, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export default function RegisterPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tv = useTranslations('validation');
  const router = useRouter();
  const { register: signUp, isAuthenticated } = useAuth();
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Mirrors RegisterDto exactly: name, email, password(min 6), confirmPassword(Match). */
  const schema = z
    .object({
      name: z.string().min(1, tv('nameRequired')),
      email: z.string().min(1, tv('required')).email(tv('email')),
      password: z.string().min(6, tv('minLength', { count: 6 })),
      confirmPassword: z.string().min(1, tv('required')),
    })
    // The backend's @Match('password') validator rejects mismatches server-side;
    // catching it here avoids a pointless round trip.
    .refine((d) => d.password === d.confirmPassword, {
      message: tv('passwordMatch'),
      path: ['confirmPassword'],
    });
  type Form = z.infer<typeof schema>;

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');

  useEffect(() => {
    if (isAuthenticated) redirect({ href: '/dashboard', locale });
  }, [isAuthenticated, locale]);

  const onSubmit = async (values: Form) => {
    setFormError(null);
    setFieldErrors({});
    try {
      const user = await signUp(values);
      toast.success(t('accountCreated'), t('welcomeBack', { name: user.name }));
      router.replace('/dashboard');
    } catch (e) {
      if (e instanceof ApiError) {
        const msg = e.messageFor(locale, te('generic'));
        if (e.isValidation) {
          const mapped: Record<string, string> = {};
          e.details.forEach((d) => {
            if (/confirm/i.test(d)) mapped.confirmPassword = d;
            else if (/email/i.test(d)) mapped.email = d;
            else if (/password/i.test(d)) mapped.password = d;
            else if (/name/i.test(d)) mapped.name = d;
          });
          setFieldErrors(mapped);
          setFormError(Object.keys(mapped).length ? null : msg);
        } else {
          // e.g. 409 "Email already exists"
          setFormError(msg);
          if (/email/i.test(msg)) setFieldErrors({ email: msg });
        }
      } else {
        setFormError(te('networkError'));
      }
    }
  };

  /** Live strength hint — purely client-side guidance. */
  const strength = (() => {
    if (!password) return { score: 0, label: '' };
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password) || /[^\w\s]/.test(password)) s++;
    const labels = locale === 'fa'
      ? ['', 'ضعیف', 'متوسط', 'خوب', 'قوی']
      : ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score: s, label: labels[s] };
  })();

  const match = password && password === watch('confirmPassword');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600">
          <UserPlus className="size-5" aria-hidden />
        </span>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{t('registerTitle')}</h1>
        <p className="mt-1.5 text-sm text-ink-3">{t('registerSubtitle')}</p>

        {formError && (
          <Alert tone="danger" className="mt-5" icon={<Info className="size-4" aria-hidden />}>
            {formError}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Field label={t('name')} required htmlFor="name" error={errors.name?.message ?? fieldErrors.name}>
            <Input
              id="name"
              autoComplete="name"
              placeholder={locale === 'fa' ? 'مثلاً: سارا احمدی' : 'e.g. Sara Ahmadi'}
              invalid={!!errors.name || !!fieldErrors.name}
              {...register('name')}
            />
          </Field>

          <Field label={t('email')} required htmlFor="email" error={errors.email?.message ?? fieldErrors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              placeholder="you@example.com"
              invalid={!!errors.email || !!fieldErrors.email}
              leadingIcon={<AtSign className="size-4" aria-hidden />}
              {...register('email')}
            />
          </Field>

          <Field
            label={t('password')}
            required
            htmlFor="password"
            hint={t('passwordHint')}
            error={errors.password?.message ?? fieldErrors.password}
          >
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              dir="ltr"
              placeholder="••••••••"
              invalid={!!errors.password || !!fieldErrors.password}
              leadingIcon={<Lock className="size-4" aria-hidden />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-lg p-1 text-ink-3 transition hover:text-ink"
                  aria-label={showPassword ? tc('close') : t('password')}
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              }
              {...register('password')}
            />
          </Field>

          {password && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      i <= strength.score
                        ? strength.score <= 1 ? 'bg-rose-500'
                          : strength.score === 2 ? 'bg-amber-500'
                          : strength.score === 3 ? 'bg-sky-500'
                          : 'bg-emerald-500'
                        : 'bg-surface-3',
                    )}
                  />
                ))}
              </div>
              <span className="w-14 shrink-0 text-xs font-semibold text-ink-3">{strength.label}</span>
            </div>
          )}

          <Field
            label={t('confirmPassword')}
            required
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message ?? fieldErrors.confirmPassword}
          >
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              dir="ltr"
              placeholder="••••••••"
              invalid={!!errors.confirmPassword || !!fieldErrors.confirmPassword}
              leadingIcon={<Lock className="size-4" aria-hidden />}
              trailing={
                watch('confirmPassword') ? (
                  match
                    ? <Check className="size-4 text-emerald-500" aria-hidden />
                    : <X className="size-4 text-rose-500" aria-hidden />
                ) : undefined
              }
              {...register('confirmPassword')}
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            {!isSubmitting && <UserPlus className="size-4" aria-hidden />}
            {isSubmitting ? t('signingUp') : t('signUp')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-3">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
            {t('signIn')}
          </Link>
        </p>
      </div>

      <Link href="/" className="mt-5 text-center text-xs font-medium text-ink-3 transition hover:text-brand-600">
        ← {te('backHome')}
      </Link>
    </div>
  );
}
