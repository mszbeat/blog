'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useDeleteUser, useUsers } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import {
  Avatar, Badge, Card, CardHeader, EmptyState, Skeleton, TableSkeleton,
} from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { formatDate, formatNumber } from '@/lib/utils';
import type { Locale, User, UserRole } from '@/lib/types';

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const { user: me } = useAuth();
  const toast = useToast();

  const { data, isLoading, isError, refetch } = useUsers();
  const deleteMut = useDeleteUser();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | UserRole>('all');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const users = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ = !q
        || u.name?.toLowerCase().includes(q)
        || u.email?.toLowerCase().includes(q)
        || u.bio?.toLowerCase().includes(q);
      const matchesRole = role === 'all' || u.role === role;
      return matchesQ && matchesRole;
    });
  }, [users, search, role]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSearch = (v: string) => { setSearch(v); setPage(1); };
  const onRole = (v: string) => { setRole(v as 'all' | UserRole); setPage(1); };

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

  const roleBadge = (r?: UserRole) => {
    const key = `role${(r ?? 'user').charAt(0).toUpperCase()}${(r ?? 'user').slice(1)}` as
      | 'roleAdmin' | 'roleUser' | 'roleGuest';
    const tone = r === 'admin' ? 'brand' : r === 'guest' ? 'warning' : 'neutral';
    return <Badge tone={tone}>{t(key)}</Badge>;
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t('title')}
          description={
            isLoading ? undefined : tc('resultsCount', { count: formatNumber(filtered.length, locale) })
          }
          icon={<Users className="size-[18px]" aria-hidden />}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-4" aria-hidden />
              {t('newUser')}
            </Button>
          }
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="min-w-52 flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={locale === 'fa' ? 'جستجو بر اساس نام یا ایمیل…' : 'Search by name or email…'}
              aria-label={tc('search')}
              leadingIcon={<Search className="size-4" aria-hidden />}
            />
          </div>
          <div className="w-40">
            <Select value={role} onChange={(e) => onRole(e.target.value)} aria-label={tc('role')}>
              <option value="all">{tc('all')}</option>
              <option value="admin">{t('roleAdmin')}</option>
              <option value="user">{t('roleUser')}</option>
              <option value="guest">{t('roleGuest')}</option>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            {tc('retry')}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : isError ? (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title={tc('error')}
            description={t('adminOnly')}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{tc('retry')}</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title={t('noUsers')}
            action={
              search || role !== 'all' ? (
                <Button variant="secondary" size="sm" onClick={() => { onSearch(''); onRole('all'); }}>
                  {tc('all')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>{t('newUser')}</Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden items-center gap-4 border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-3 md:flex">
              <span className="flex-1">{tc('name')}</span>
              <span className="w-28">{tc('role')}</span>
              <span className="num-en w-32">{t('createdAt')}</span>
              <span className="w-12" />
            </div>

            <ul className="divide-y divide-line">
              {rows.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <li
                    key={u.id}
                    className="flex flex-col gap-3 p-4 transition hover:bg-surface-2 md:flex-row md:items-center md:gap-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={u.avatar} name={u.name} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{u.name}</p>
                          {isSelf && (
                            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                              {locale === 'fa' ? 'شما' : 'you'}
                            </span>
                          )}
                        </div>
                        <p className="num-en truncate text-xs text-ink-3" dir="ltr">{u.email}</p>
                        {u.bio && <p className="mt-0.5 truncate text-xs text-ink-3">{u.bio}</p>}
                      </div>
                    </div>

                    <span className="w-28 shrink-0">{roleBadge(u.role)}</span>

                    <span className="num-en hidden w-32 shrink-0 text-xs text-ink-3 md:block">
                      {formatDate(u.createdAt, locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>

                    <span className="flex shrink-0 items-center gap-1.5">
                      {u.role === 'admin' && (
                        <ShieldCheck className="size-4 text-brand-500" aria-hidden />
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete(u)}
                        disabled={isSelf}
                        title={
                          isSelf
                            ? (locale === 'fa' ? 'نمی‌توانید حساب خودتان را حذف کنید' : 'You cannot delete your own account')
                            : t('deleteUser')
                        }
                        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30"
                        aria-label={t('deleteUser')}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            {filtered.length > PAGE_SIZE && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={filtered.length}
                locale={locale}
                onChange={setPage}
                className="border-t border-line p-4"
              />
            )}
          </>
        )}
      </Card>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />

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
