// Isolated REAL editor/carousel components in Chromium. Only HTTP/upload and
// Next routing are replaced at the test boundary; no test server enters the app.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile } from 'node:fs/promises';

await mkdir('.cache/editor-tests', { recursive: true });
const svg = (w, h, color) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`).toString('base64')}`;
const images = [svg(1200, 600, 'green'), svg(600, 1200, 'blue'), svg(800, 800, 'orange')];
const stubs = {
  '@/i18n/navigation': `export const useRouter=()=>({push:()=>{},back:()=>{}});`,
  '@/lib/api': `export class ApiError extends Error { messageFor(){return this.message;} } export const api={createPost:async p=>{window.saved=p;return {slug:'test'}},updatePost:async(id,p)=>{window.saved=p;return {slug:'test'}}};`,
  '@/lib/queries': `import {useState} from 'react'; export const useCategories=()=>({data:[],isLoading:false}); export function useUploadCover(){ const [isPending,set]=useState(false); return {isPending,mutateAsync:async file=>{set(true);try{await new Promise(r=>setTimeout(r,120)); if(file.name==='fail.png')throw Error('Upload failed'); return {url:window.fixture.images[Number(file.name[0])]};}finally{set(false)}}};}`,
};
await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl'; import {PostEditor} from './src/components/post-editor'; import {ImageCarousel} from './src/components/post/image-carousel'; import {ToastProvider} from './src/components/toast'; import en from './messages/en.json'; import fa from './messages/fa.json'; const f=window.fixture; createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={f.locale||'en'} messages={f.locale==='fa'?fa:en} timeZone="UTC"><ToastProvider>{f.kind==='carousel'?<ImageCarousel images={f.images} alt="Gallery test"/>:<PostEditor mode={f.post?'edit':'create'} post={f.post}/>}</ToastProvider></NextIntlClientProvider>);`, loader: 'tsx', resolveDir: process.cwd() },
  bundle: true, outfile: '.cache/editor-tests/harness.js', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  plugins: [{ name: 'test-boundaries', setup(b) {
    b.onResolve({ filter: /^@\// }, args => args.path in stubs ? { path: args.path, namespace: 'stub' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: process.cwd() }));
  } }],
});
const files = await readdir('.next/static/css');
const css = (await Promise.all(files.filter(f=>f.endsWith('.css')).map(f=>readFile(`.next/static/css/${f}`, 'utf8')))).join('\n');
console.log('Harness built; starting Chromium');
const browser = await chromium.launch();
const errors = [];
async function mount(fixture, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  page.setDefaultTimeout(10_000);
  page.on('pageerror', e=>{errors.push(e.message);console.error(e.message)});
  page.on('console', m=>{if(m.type()==='error')console.error(m.text())});
  await page.route('http://zlog.test/**', async route => {
    const pathname=new URL(route.request().url()).pathname;
    const path=pathname.startsWith('/fonts/')?`public${pathname}`:pathname.startsWith('/_next/static/')?`.next/${pathname.slice('/_next/'.length)}`:null;
    if (!path) return route.abort();
    try { await route.fulfill({body:await readFile(path),contentType:'font/woff2',headers:{'access-control-allow-origin':'*'}}); } catch { await route.abort(); }
  });
  await page.setContent(`<html lang="${fixture.locale||'en'}" dir="${fixture.locale==='fa'?'rtl':'ltr'}"><head><base href="http://zlog.test/"></head><body><div id="root" style="max-width:768px;margin:auto"></div></body></html>`);
  await page.addStyleTag({ content: css });
  await page.evaluate(f => { window.fixture = f; }, fixture);
  console.log('Mounting',fixture.kind,fixture.locale);
  await page.addScriptTag({ path: '.cache/editor-tests/harness.js' });
  console.log('Mounted');
  return page;
}
async function eventually(check) {
  for(let i=0;i<80;i++) { try { await check();return; } catch(e) { if(i===79)throw e; await new Promise(r=>setTimeout(r,50)); } }
}
const file = name => ({ name, mimeType:'image/png', buffer:Buffer.from('test upload boundary') });
try {
  for (const locale of ['en', 'fa']) {
    const messages=JSON.parse(await readFile(`messages/${locale}.json`,'utf8'));
    const t=messages.editor;
    const page=await mount({kind:'editor',images,locale},390);
    const input=page.locator('#content');
    await page.locator('#title').fill('Formatting test');
    const text=locale==='fa'?'سلام دنیا':'Hello world';
    await input.fill(text);
    await input.press('ControlOrMeta+A');
    await page.getByRole('button',{name:t.bold,exact:true}).click();
    assert.equal(await input.inputValue(),`**${text}**`);
    await page.getByRole('button',{name:t.undo,exact:true}).click();
    assert.equal(await input.inputValue(),text);
    await page.getByRole('button',{name:t.redo,exact:true}).click();
    assert.equal(await input.inputValue(),`**${text}**`);
    await input.press('End');
    await page.getByRole('button',{name:t.emoji,exact:true}).click();
    await page.getByRole('button',{name:'💡',exact:true}).click();
    assert.equal(await input.inputValue(),`**${text}**💡`);
    await page.getByRole('button',{name:t.link,exact:true}).click();
    await page.locator('#content-link').fill('javascript:alert(1)');
    await page.getByRole('button',{name:t.insertLink,exact:true}).click();
    assert.ok(await page.getByRole('alert').isVisible());
    await page.locator('#content-link').fill('https://example.com');
    await page.getByRole('button',{name:t.insertLink,exact:true}).click();
    await page.getByRole('button',{name:t.preview,exact:true}).click();
    const preview=page.getByRole('region',{name:t.preview,exact:true});
    assert.equal(await preview.locator('strong').innerText(),text);
    assert.equal(await preview.locator('a').getAttribute('href'),'https://example.com/');
    assert.equal(await preview.locator('a').getAttribute('rel'),'noopener noreferrer');
    assert.ok((await preview.innerText()).includes('💡'));
    await page.getByRole('button',{name:t.write,exact:true}).click();
    const value=await input.inputValue();
    await page.locator('button[type=submit]').click();
    await eventually(async()=>assert.equal((await page.evaluate(()=>window.saved)).content,value));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if (locale==='fa') {
      assert.ok(await page.evaluate(async()=>{await document.fonts.load('16px SitePersian','سلام');return document.fonts.check('16px SitePersian','سلام');}));
      assert.ok((await input.evaluate(el=>getComputedStyle(el).fontFamily)).includes('SitePersian'));
    }
    await input.fill(text);
    await input.press('ControlOrMeta+A');
    await input.press('ControlOrMeta+i');
    assert.equal(await input.inputValue(),`*${text}*`);
    await input.press('ControlOrMeta+z');
    assert.equal(await input.inputValue(),text);
    await input.press('ControlOrMeta+Shift+z');
    assert.equal(await input.inputValue(),`*${text}*`);
    await input.fill('First\nSecond');
    await input.press('ControlOrMeta+A');
    await page.getByRole('button',{name:t.numberList,exact:true}).click();
    assert.equal(await input.inputValue(),'1. First\n2. Second');
    await page.getByRole('button',{name:t.preview,exact:true}).click();
    assert.equal(await page.getByRole('region',{name:t.preview,exact:true}).locator('ol li').count(),2);
    await page.evaluate(()=>document.documentElement.classList.add('dark'));
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()),'#101613');
    const palette=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--palette-brand-500').trim());
    assert.equal(palette,'#1fa06c');
    await page.close();console.log(`PASS formatting/undo/redo/emoji/safe links/preview/payload/mobile overflow/palette (${locale})`);
  }
  assert.deepEqual(errors,[]);console.log('PASS editor has no runtime errors');
} finally { await browser.close(); }
