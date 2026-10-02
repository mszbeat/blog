import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PaletteExplorer } from '@/components/palette-explorer';
import type { Locale } from '@/lib/types';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'palette' });
  return { title: t('title'), description: t('subtitle') };
}

/**
 * A working tool rather than a marketing page: every colour token the site uses,
 * rendered as a live swatch beside its name and resolved value, read straight
 * from the COLOR CENTER in globals.css. Re-theme there, refresh here.
 */
export default async function PalettePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PaletteExplorer />;
}
