import presets from './theme-defaults.json';
export type ThemeMode = 'light' | 'dark';
export type SiteTheme = {
  id: string;
  name: { en: string; fa: string };
  description: { en: string; fa: string };
  version: number;
  light: Record<string, string>;
  dark: Record<string, string>;
};
export const DEFAULT_THEMES: SiteTheme[] = presets;
export const COLOR_KEYS = Object.keys(presets[0].light);
export const COLOR_HEX = /^#[\da-f]{6}([\da-f]{2})?$/i;
export const THEME_ID_KEY = 'blog.colorTheme';
export const CATALOG_KEY = 'blog.themeCatalog.v1';
export const isThemeCatalog = (data: unknown): data is SiteTheme[] =>
  Array.isArray(data) &&
  data.length === DEFAULT_THEMES.length &&
  DEFAULT_THEMES.every((defaultTheme) => {
    const t = data.find((item) => item?.id === defaultTheme.id);
    return (
      t &&
      Number.isInteger(t.version) &&
      t.version > 0 &&
      typeof t.name?.en === 'string' &&
      typeof t.name?.fa === 'string' &&
      ['light', 'dark'].every(
        (mode) =>
          t[mode] &&
          COLOR_KEYS.every(
            (k) => typeof t[mode][k] === 'string' && COLOR_HEX.test(t[mode][k]),
          ),
      )
    );
  });
export function applyTheme(preset: SiteTheme, mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.dataset.colorTheme = preset.id;
  for (const key of COLOR_KEYS) root.style.setProperty(key, preset[mode][key]);
}
// Used before paint. Values from storage are never interpreted as HTML/CSS code.
export const themeBootScript = `(function(){try{
var d=${JSON.stringify(DEFAULT_THEMES)},ks=Object.keys(d[0].light),a=d;
try{var c=JSON.parse(localStorage.getItem('${CATALOG_KEY}'));if(Array.isArray(c)&&d.every(function(t){var v=c.find(function(x){return x&&x.id===t.id});return v&&['light','dark'].every(function(m){return v[m]&&ks.every(function(k){return /^#[\\da-f]{6}([\\da-f]{2})?$/i.test(v[m][k])})})}))a=c;}catch(e){}
var m=localStorage.getItem('blog.theme');if(m!=='dark'&&m!=='light')m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
var id=localStorage.getItem('${THEME_ID_KEY}'),p=a.find(function(x){return x.id===id})||a[0],r=document.documentElement;
r.classList.toggle('dark',m==='dark');r.style.colorScheme=m;r.dataset.colorTheme=p.id;ks.forEach(function(k){r.style.setProperty(k,p[m][k])});
if(localStorage.getItem('blog.reduceMotion')==='1')r.classList.add('reduce-motion');
}catch(e){}})();`;
