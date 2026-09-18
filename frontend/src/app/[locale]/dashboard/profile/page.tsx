'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Camera, Check, Eye, Grid3x3, KeyRound, Loader2, Lock, Pencil,
  Save, Settings2, ShieldCheck, UserCog, X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError, api } from '@/lib/api';
import { useUploadAvatar, useMyPosts } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Alert, Avatar, Badge, Card, CardHeader } from '@/components/ui/primitives';
import { PostsGrid } from '@/components/profile/posts-grid';
import { ShareButton } from '@/components/share-button';
import { cn, formatDate, formatNumber, gradientFor } from '@/lib/utils';
import type { Locale } from '@/lib/types';

const MAX_FILE = 5 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';

type Tab = 'view' | 'edit' | 'security' | 'posts';

export default function ProfilePage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const tu = useTranslations('users');
  const tv = useTranslations('validation');
  const ta = useTranslations('auth');
  const tp = useTranslations('posts');
  const { user, patchUser } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('view');

  /* ══════════ profile form ══════════ */
  // UpdateUserDto = Partial(Omit(CreateUserDto, email|password|confirmPassword))
  const profileSchema = z.object({
    name: z.string().min(1, tv('nameRequired')),
    bio: z.string().max(1000).optional().or(z.literal('')),
  });
  type ProfileForm = z.infer<typeof profileSchema>;

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', bio: user?.bio ?? '' },
  });

  useEffect(() => {
    if (user) profile.reset({ name: user.name, bio: user.bio ?? '' });
    // Reset only when the identity changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [profileError, setProfileError] = useState<string | null>(null);

  const saveProfile = async (values: ProfileForm) => {
    if (!user) return;
    setProfileError(null);
    try {
      // Send ONLY the DTO fields — forbidNonWhitelisted rejects anything else.
      const payload = { name: values.name.trim() } as { name: string; bio?: string };
      if (values.bio?.trim()) payload.bio = values.bio.trim();
      const updated = await api.updateUser(user.id, payload);
      patchUser(updated);
      toast.success(t('updatedSuccess'));
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      setProfileError(msg);
      toast.error(tc('error'), msg);
    }
  };

  /* ══════════ password form ══════════ */
  const pwSchema = z
    .object({
      currentPassword: z.string().min(6, tv('minLength', { count: 6 })),
      newPassword: z.string().min(6, tv('minLength', { count: 6 })),
      confirmNewPassword: z.string().min(1, tv('required')),
    })
    .refine((d) => d.newPassword === d.confirmNewPassword, {
      message: tv('passwordMatch'),
      path: ['confirmNewPassword'],
    });
  type PwForm = z.infer<typeof pwSchema>;

  const pw = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const [pwError, setPwError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const savePassword = async (values: PwForm) => {
    setPwError(null);
    try {
      await api.changePassword(values);
      toast.success(t('passwordChanged'));
      pw.reset();
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      setPwError(msg);
      toast.error(tc('error'), msg);
    }
  };

  /* ══════════ avatar upload ══════════ */
  const uploadAvatar = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleAvatar = async (file?: File | null) => {
    setAvatarError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setAvatarError(locale === 'fa' ? 'فقط PNG، JPG، JPEG یا WEBP مجاز است' : 'Only PNG, JPG, JPEG or WEBP allowed');
      return;
    }
    if (file.size > MAX_FILE) {
      setAvatarError(locale === 'fa' ? 'حجم فایل باید کمتر از ۵ مگابایت باشد' : 'File must be under 5 MB');
      return;
    }
    try {
      const { url } = await uploadAvatar.mutateAsync(file);
      // The backend already persisted it on user.avatar — reflect it locally.
      patchUser({ avatar: url });
      toast.success(t('avatarUploaded'));
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      setAvatarError(msg);
      toast.error(tc('error'), msg);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    try {
      const updated = await api.updateUser(user.id, { avatar: '' });
      patchUser(updated);
      toast.success(t('removeAvatar'));
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      toast.error(tc('error'), msg);
    }
  };

  /* ══════════ my posts (only fetched when that tab is open) ══════════ */
  const myPostsQuery = useMyPosts({ limit: 48 }, tab === 'posts');
  // `/post/my` answers `{ data, meta }` — and skips the author/category joins.
  const myPosts = myPostsQuery.data?.data ?? [];

  if (!user) return null;

  const roleKey = `role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` as
    | 'roleAdmin' | 'roleUser' | 'roleGuest';

  const TABS: { id: Tab; label: string; icon: typeof Eye }[] = [
    { id: 'view', label: locale === 'fa' ? 'مشاهده' : 'View', icon: Eye },
    { id: 'edit', label: locale === 'fa' ? 'ویرایش' : 'Edit', icon: Pencil },
    { id: 'security', label: locale === 'fa' ? 'امنیت' : 'Security', icon: KeyRound },
    { id: 'posts', label: tp('allPosts'), icon: Grid3x3 },
  ];

  return (
    <div className="space-y-5">
      {/* ══════════ Instagram-style identity card ══════════ */}
      <Card className="overflow-hidden !p-0">
        <div className="relative h-28 sm:h-36">
          <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br', gradientFor(user.id + user.name))} />
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle at 30% 20%, #fff 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/20 to-transparent" />

          {/* Quick link to the public profile */}
          <Link
            href={`/users/${user.id}`}
            className="glass absolute top-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-ink transition hover:border-brand-400"
            style={{ insetInlineEnd: '0.75rem' }}
          >
            <Eye className="size-3.5" aria-hidden />
            {locale === 'fa' ? 'نمای عمومی' : 'Public view'}
          </Link>
        </div>

        <div className="px-5 pb-5">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="relative">
                <Avatar src={user.avatar} name={user.name} ring className="!size-24 !text-2xl shadow-elev-3 sm:!size-28" />

                {/* Upload trigger */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadAvatar.isPending}
                  className="absolute bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-surface-1 bg-brand-600 text-white shadow-elev-2 transition hover:bg-brand-700 disabled:opacity-60"
                  style={{ insetInlineEnd: '-0.1rem' }}
                  aria-label={t('uploadAvatar')}
                  title={t('uploadAvatar')}
                >
                  {uploadAvatar.isPending
                    ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    : <Camera className="size-3.5" aria-hidden />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => void handleAvatar(e.target.files?.[0])}
                />
              </div>

              <div className="min-w-0 pb-1">
                <h2 className="truncate text-xl font-extrabold tracking-tight text-ink">{user.name}</h2>
                <p className="num-en mt-0.5 truncate text-sm font-semibold text-ink-3" dir="ltr">
                  @{user.email.split('@')[0]}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'} icon={<ShieldCheck className="size-3" aria-hidden />}>
                {tu(roleKey)}
              </Badge>
              <ShareButton variant="outline" size="sm" label={tc('share')} />
            </div>
          </div>

          {user.bio && (
            <p className="mt-3 max-w-2xl text-sm leading-loose whitespace-pre-wrap text-ink-2">{user.bio}</p>
          )}

          {/* Inline stats */}
          <div className="num-en mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-3">
            <span>
              <b className="text-sm font-extrabold text-ink">{formatNumber(myPosts.length, locale)}</b>{' '}
              {tp('allPosts')}
            </span>
            <span className="num-en" dir="ltr">{user.email}</span>
            <span>{t('memberSince', { date: formatDate(user.createdAt, locale, { year: 'numeric', month: 'long' }) })}</span>
          </div>

          {avatarError && <p role="alert" className="mt-3 text-xs font-medium text-rose-600">{avatarError}</p>}
        </div>
      </Card>

      {/* ══════════ Tabs ══════════ */}
      <div
        role="tablist"
        aria-label={t('title')}
        className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-bold transition',
              tab === id ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {id === 'posts' && myPosts.length > 0 && (
              <span className="num-en rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-2">
                {formatNumber(myPosts.length, locale)}
              </span>
            )}
            {tab === id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════ Tab: VIEW ══════════ */}
      {tab === 'view' && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader
              title={locale === 'fa' ? 'پیش‌نمایش پروفایل' : 'Profile preview'}
              description={locale === 'fa'
                ? 'همان چیزی که دیگران در صفحهٔ عمومی شما می‌بینند.'
                : 'Exactly what visitors see on your public page.'}
              icon={<Eye className="size-[18px]" aria-hidden />}
              action={
                <Link href={`/users/${user.id}`} className="contents">
                  <Button variant="ghost" size="sm">{locale === 'fa' ? 'باز کردن' : 'Open'}</Button>
                </Link>
              }
            />
            <div className="space-y-4 p-5">
              <Row label={tc('name')} value={user.name} />
              <Row label={tc('email')} value={user.email} ltr />
              <Row label={tc('role')} value={tu(roleKey)} />
              <Row
                label={tc('bio')}
                value={user.bio || (locale === 'fa' ? '— نوشته نشده —' : '— not set —')}
                multiline
              />
              <Row
                label={locale === 'fa' ? 'تاریخ عضویت' : 'Joined'}
                value={formatDate(user.createdAt, locale, { year: 'numeric', month: 'long', day: 'numeric' })}
              />
            </div>
          </Card>

          {/* Avatar panel */}
          <Card>
            <CardHeader title={t('avatarSection')} icon={<Camera className="size-[18px]" aria-hidden />} />
            <div className="space-y-4 p-5">
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleAvatar(e.dataTransfer.files?.[0]); }}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition',
                  dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-line-strong bg-surface-2 hover:border-brand-400',
                )}
              >
                {uploadAvatar.isPending ? (
                  <Loader2 className="size-6 animate-spin text-brand-500" aria-hidden />
                ) : (
                  <Camera className="size-6 text-ink-3" aria-hidden />
                )}
                <span className="text-sm font-semibold text-ink-2">
                  {uploadAvatar.isPending ? t('uploading') : user.avatar ? t('changeAvatar') : t('uploadAvatar')}
                </span>
                <span className="text-xs text-ink-3">{t('maxFileSize')}</span>
                <span className="num-en text-[11px] text-ink-3">{t('allowedTypes')}</span>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => void handleAvatar(e.target.files?.[0])}
                  disabled={uploadAvatar.isPending}
                />
              </label>

              {user.avatar && (
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => void removeAvatar()}>
                  <X className="size-3.5" aria-hidden />
                  {t('removeAvatar')}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ Tab: EDIT ══════════ */}
      {tab === 'edit' && (
        <Card>
          <CardHeader
            title={t('personalInfo')}
            description={t('personalInfoDesc')}
            icon={<UserCog className="size-[18px]" aria-hidden />}
          />
          <form onSubmit={profile.handleSubmit(saveProfile)} className="space-y-4 p-5" noValidate>
            {profileError && <Alert tone="danger">{profileError}</Alert>}

            <Field label={tc('name')} required htmlFor="p-name" error={profile.formState.errors.name?.message}>
              <Input
                id="p-name"
                autoComplete="name"
                invalid={!!profile.formState.errors.name}
                {...profile.register('name')}
              />
            </Field>

            <Field label={tc('email')} htmlFor="p-email" hint={t('emailNote')}>
              {/* Email is omitted from UpdateUserDto, so it is read-only here. */}
              <Input id="p-email" value={user.email} dir="ltr" readOnly disabled />
            </Field>

            <Field
              label={tc('bio')}
              htmlFor="p-bio"
              optionalLabel={tc('optional')}
              error={profile.formState.errors.bio?.message}
              hint={locale === 'fa' ? 'در پروفایل عمومی و زیر نام شما در فید نمایش داده می‌شود.' : 'Shown on your public profile and under your name in the feed.'}
            >
              <Textarea
                id="p-bio"
                rows={5}
                maxLength={1000}
                placeholder={locale === 'fa' ? 'کمی دربارهٔ خودت بنویس…' : 'Tell us a little about yourself…'}
                invalid={!!profile.formState.errors.bio}
                {...profile.register('bio')}
              />
            </Field>

            <div className="flex items-center gap-2">
              <Button type="submit" loading={profile.formState.isSubmitting}>
                {!profile.formState.isSubmitting && <Save className="size-4" aria-hidden />}
                {profile.formState.isSubmitting ? tc('saving') : t('updateProfile')}
              </Button>
              {profile.formState.isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => profile.reset({ name: user.name, bio: user.bio ?? '' })}
                >
                  <X className="size-3.5" aria-hidden />
                  {tc('cancel')}
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      {/* ══════════ Tab: SECURITY ══════════ */}
      {tab === 'security' && (
        <Card>
          <CardHeader
            title={t('passwordSection')}
            description={t('passwordSectionDesc')}
            icon={<KeyRound className="size-[18px]" aria-hidden />}
          />
          <form onSubmit={pw.handleSubmit(savePassword)} className="space-y-4 p-5" noValidate>
            {pwError && <Alert tone="danger">{pwError}</Alert>}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('currentPassword')} required htmlFor="cur" error={pw.formState.errors.currentPassword?.message}>
                <Input
                  id="cur"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  placeholder="••••••••"
                  invalid={!!pw.formState.errors.currentPassword}
                  leadingIcon={<Lock className="size-4" aria-hidden />}
                  {...pw.register('currentPassword')}
                />
              </Field>

              <Field label={t('newPassword')} required htmlFor="new" hint={ta('passwordHint')} error={pw.formState.errors.newPassword?.message}>
                <Input
                  id="new"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  dir="ltr"
                  placeholder="••••••••"
                  invalid={!!pw.formState.errors.newPassword}
                  leadingIcon={<Lock className="size-4" aria-hidden />}
                  {...pw.register('newPassword')}
                />
              </Field>

              <Field label={t('confirmNewPassword')} required htmlFor="conf" error={pw.formState.errors.confirmNewPassword?.message}>
                <Input
                  id="conf"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  dir="ltr"
                  placeholder="••••••••"
                  invalid={!!pw.formState.errors.confirmNewPassword}
                  leadingIcon={<Check className="size-4" aria-hidden />}
                  {...pw.register('confirmNewPassword')}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={pw.formState.isSubmitting}>
                {!pw.formState.isSubmitting && <KeyRound className="size-4" aria-hidden />}
                {pw.formState.isSubmitting ? t('changingPassword') : t('changePassword')}
              </Button>

              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-xs font-semibold text-ink-3 transition hover:text-brand-600"
              >
                {showPw
                  ? (locale === 'fa' ? 'پنهان کردن رمزها' : 'Hide passwords')
                  : (locale === 'fa' ? 'نمایش رمزها' : 'Show passwords')}
              </button>
            </div>

            <Alert tone="info" className="mt-2">
              <span className="flex items-start gap-2 text-xs leading-relaxed">
                <Settings2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {locale === 'fa'
                  ? 'پس از تغییر رمز، توکن فعلی شما باطل نمی‌شود؛ ولی برای امنیت بیشتر از دستگاه‌های دیگر خارج شوید.'
                  : 'Changing your password does not revoke the current token, but sign out of other devices for safety.'}
              </span>
            </Alert>
          </form>
        </Card>
      )}

      {/* ══════════ Tab: MY POSTS (Instagram grid) ══════════ */}
      {tab === 'posts' && (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Grid3x3 className="size-4 text-brand-500" aria-hidden />
                {locale === 'fa' ? 'نوشته‌های من' : 'My posts'}
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                {locale === 'fa'
                  ? 'همان گرید اینستاگرامی صفحهٔ عمومی، به‌همراه پیش‌نویس‌ها.'
                  : 'The same grid as your public page, plus drafts.'}
              </p>
            </div>
            <Link href="/dashboard/posts" className="contents">
              <Button variant="outline" size="sm">{locale === 'fa' ? 'مدیریت نوشته‌ها' : 'Manage posts'}</Button>
            </Link>
          </div>

          {myPostsQuery.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton aspect-square rounded-2xl" />
              ))}
            </div>
          ) : myPostsQuery.isError ? (
            <Alert tone="danger">{(myPostsQuery.error as Error).message}</Alert>
          ) : (
            <PostsGrid posts={myPosts} />
          )}
        </Card>
      )}
    </div>
  );
}

/** One label/value line used by the read-only "View" tab. */
function Row({ label, value, ltr, multiline }: { label: string; value: string; ltr?: boolean; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd
        className={cn(
          'min-w-0 flex-1 text-sm font-semibold text-ink',
          ltr && 'num-en',
          multiline && 'leading-loose whitespace-pre-wrap font-normal text-ink-2',
        )}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
