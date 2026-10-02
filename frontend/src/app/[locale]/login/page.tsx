'use client';

import { Suspense, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AtSign, Eye, EyeOff, Info, Lock, LogIn } from 'lucide-react';
import { Link, redirect, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import type { Locale } from '@/lib/types';

function LoginForm() {
  const locale = useLocale() as Locale;
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tv = useTranslations('validation');
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const schema = z.object({
    email: z.string().min(1, tv('required')).email(tv('email')),
    // Mirrors LoginDto: @MinLength(6)
    password: z.string().min(6, tv('minLength', { count: 6 })),
  });
  type Form = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  // Already signed in → straight to the dashboard.
  useEffect(() => {
    if (isAuthenticated) redirect({ href: '/dashboard', locale });
  }, [isAuthenticated, locale]);

  const onSubmit = async (values: Form) => {
    setFormError(null);
    setFieldErrors({});
    try {
      const user = await login(values);
      toast.success(t('welcomeBack', { name: user.name }));

      // Honour ?next= so AuthGuard can return the user where they were headed.
      const next = new URLSearchParams(window.location.search).get('next');
      const target = next && next.startsWith('/') ? next : '/dashboard';
      router.replace(target as '/' | '/dashboard');
    } catch (e) {
      if (e instanceof ApiError) {
        const msg = e.messageFor(locale, te('generic'));
        if (e.isValidation) {
          // Map class-validator messages onto fields where we can identify them.
          const mapped: Record<string, string> = {};
          e.details.forEach((d) => {
            if (/email/i.test(d)) mapped.email = d;
            else if (/password/i.test(d)) mapped.password = d;
          });
          setFieldErrors(mapped);
          setFormError(Object.keys(mapped).length ? null : msg);
        } else {
          setFormError(msg);
        }
      } else {
        setFormError(te('networkError'));
      }
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <LogIn className="size-5" aria-hidden />
        </span>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{t('loginTitle')}</h1>
        <p className="mt-1.5 text-sm text-ink-3">{t('loginSubtitle')}</p>

        {formError && (
          <Alert tone="danger" className="mt-5" icon={<Info className="size-4" aria-hidden />}>
            {formError}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
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
              autoComplete="current-password"
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

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            {!isSubmitting && <LogIn className="size-4" aria-hidden />}
            {isSubmitting ? t('signingIn') : t('signIn')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-3">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
            {t('signUp')}
          </Link>
        </p>
      </div>

      <Link
        href="/"
        className="mt-5 text-center text-xs font-medium text-ink-3 transition hover:text-brand-600"
      >
        ← {te('backHome')}
      </Link>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams (via ?next=) needs a Suspense boundary in App Router.
  return (
    <Suspense fallback={<div className="py-20" />}>
      <LoginForm />
    </Suspense>
  );
}
