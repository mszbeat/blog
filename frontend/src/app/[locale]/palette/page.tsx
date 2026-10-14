import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/lib/types';
export default async function PalettePage({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;
  redirect({href:'/admin/palette',locale:locale as Locale});
}
