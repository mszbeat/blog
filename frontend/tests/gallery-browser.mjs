// Isolated REAL editor/carousel components in Chromium. Only HTTP/upload and
// Next routing are replaced at the test boundary; no test server enters the app.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile } from 'node:fs/promises';

await mkdir('.cache/gallery-tests', { recursive: true });
const svg = (w, h, color) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`).toString('base64')}`;
const images = [svg(1200, 600, 'green'), svg(600, 1200, 'blue'), svg(800, 800, 'orange')];
const stubs = {
  '@/i18n/navigation': `export const useRouter=()=>({push:()=>{},back:()=>{}});`,
  '@/lib/api': `export class ApiError extends Error { messageFor(){return this.message;} } export const api={createPost:async p=>{window.saved=p;return {slug:'test'}},updatePost:async(id,p)=>{window.saved=p;return {slug:'test'}}};`,
  '@/lib/queries': `import {useState} from 'react'; export const useCategories=()=>({data:[],isLoading:false}); export function useUploadCover(){ const [isPending,set]=useState(false); return {isPending,mutateAsync:async file=>{set(true);try{await new Promise(r=>setTimeout(r,120)); if(file.name==='fail.png')throw Error('Upload failed'); return {url:window.fixture.images[Number(file.name[0])]};}finally{set(false)}}};}`,
};
await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl'; import {PostEditor} from './src/components/post-editor'; import {ImageCarousel} from './src/components/post/image-carousel'; import {ToastProvider} from './src/components/toast'; import en from './messages/en.json'; import fa from './messages/fa.json'; const f=window.fixture; createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={f.locale||'en'} messages={f.locale==='fa'?fa:en} timeZone="UTC"><ToastProvider>{f.kind==='carousel'?<ImageCarousel images={f.images} alt="Gallery test"/>:<PostEditor mode={f.post?'edit':'create'} post={f.post}/>}</ToastProvider></NextIntlClientProvider>);`, loader: 'tsx', resolveDir: process.cwd() },
  bundle: true, outfile: '.cache/gallery-tests/harness.js', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
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
async function mount(fixture, width = 390, height = 844) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(10_000);
  page.on('pageerror', e=>{errors.push(e.message);console.error(e.message)});
  page.on('console', m=>{if(m.type()==='error')console.error(m.text())});
  await page.setContent(`<html dir="${fixture.locale==='fa'?'rtl':'ltr'}"><head></head><body><div id="root" style="max-width:768px;margin:auto"></div></body></html>`);
  await page.addStyleTag({ content: css });
  await page.evaluate(f => { window.fixture = f; }, fixture);
  console.log('Mounting',fixture.kind,fixture.locale);
  await page.addScriptTag({ path: '.cache/gallery-tests/harness.js' });
  console.log('Mounted');
  return page;
}
async function eventually(check) {
  for(let i=0;i<80;i++) { try { await check();return; } catch(e) { if(i===79)throw e; await new Promise(r=>setTimeout(r,50)); } }
}
const file = name => ({ name, mimeType:'image/png', buffer:Buffer.from('test upload boundary') });
try {
  const boundedImages = [...images, svg(200,4000,'purple'), svg(4000,200,'red')];
  for (const locale of ['en','fa']) {
    for (const [width,height,cap] of [[390,844,360],[1280,900,560],[844,390,560]]) {
      const page=await mount({kind:'carousel',images:boundedImages,locale},width,height);
      const frame=page.locator('.post-gallery-frame');
      const img=frame.locator('img');
      let firstHeight;
      for (const ratio of [2,0.5,1,0.05,20]) {
        await eventually(async()=>{
          const box=await img.evaluate(el=>{
            const r=el.getBoundingClientRect(),f=el.parentElement.getBoundingClientRect();
            return {w:r.width,h:r.height,x:r.x,y:r.y,fw:f.width,fh:f.height,fx:f.x,fy:f.y,nw:el.naturalWidth,nh:el.naturalHeight,fit:getComputedStyle(el).objectFit};
          });
          assert.ok(box.nw>0 && box.nh>0);
          assert.equal(box.nw/box.nh,ratio);
          assert.ok(Math.abs((box.w/box.h)/ratio-1)<0.01,JSON.stringify(box));
          assert.equal(box.fit,'contain');
          assert.ok(box.h<=box.fh && box.w<=box.fw);
          assert.ok(Math.abs(box.fh-Math.min(cap,height*0.65))<1);
          assert.ok(Math.abs(box.x+box.w/2-(box.fx+box.fw/2))<1,'horizontally centered');
          assert.ok(Math.abs(box.y+box.h/2-(box.fy+box.fh/2))<1,'vertically centered');
          if(firstHeight===undefined)firstHeight=box.fh;
          assert.equal(box.fh,firstHeight,'frame must not jump between slides');
        });
        await page.getByRole('button',{name:'next',exact:true}).click();
      }
      await frame.focus();
      await page.keyboard.press(locale==='fa'?'ArrowLeft':'ArrowRight');
      await eventually(async()=>assert.equal(await img.getAttribute('src'),images[1]));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.close();
      console.log(`PASS stable capped frame, natural ratios, extreme aspect ratios, centering, keyboard, overflow (${locale}, ${width}x${height})`);
    }
  }
  for (const [width,height] of [[390,844],[1280,900],[844,390]]) {
    const page=await mount({kind:'carousel',images:[images[1]]},width,height);
    await eventually(async()=>{
      const box=await page.locator('#root img').evaluate(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,nh:el.naturalHeight};});
      assert.ok(box.nh>0);assert.ok(Math.abs(box.w/box.h-0.5)<0.01);
      assert.ok(box.h<=Math.min(width<640?360:560,height*0.65));
    });
    assert.equal(await page.getByRole('button',{name:'next',exact:true}).count(),0);
    await page.close();console.log(`PASS single portrait cap (${width}x${height})`);
  }
  {
    const page=await mount({kind:'editor',images},1100);
    assert.equal(await page.locator('input[type=file]').count(),1);
    await page.locator('#title').fill('Gallery test'); await page.locator('#content').fill('Test body');
    await page.locator('input[type=file]').setInputFiles([file('0.png'),file('1.png'),file('2.png')]);
    assert.ok(await page.locator('button[type=submit]').isDisabled());
    await eventually(async()=>assert.equal(await page.locator('[data-testid=post-image-previews] img').count(),3));
    await page.locator('button[type=submit]').click();
    await eventually(async()=>assert.deepEqual(await page.evaluate(()=>window.saved), {title:'Gallery test',content:'Test body',published:false,images,coverImage:images[0]}));
    const remove=page.locator('[data-testid=post-image-previews] button');
    await remove.first().click(); await page.locator('button[type=submit]').click();
    await eventually(async()=>assert.equal((await page.evaluate(()=>window.saved)).coverImage,images[1]));
    await remove.first().click(); await remove.first().click(); await page.locator('button[type=submit]').click();
    await eventually(async()=>assert.deepEqual((await page.evaluate(()=>window.saved)).images,[]));
    assert.equal((await page.evaluate(()=>window.saved)).coverImage,'');
    await page.close();console.log('PASS one uploader, selection order, save lock, cover promotion and clearing');
  }
  {
    const post={id:'legacy',title:'Old post',content:'Body',published:true,coverImage:images[0],images:[images[1],images[2]],categories:[]};
    const page=await mount({kind:'editor',images,post});
    await eventually(async()=>assert.equal(await page.locator('[data-testid=post-image-previews] img').count(),3));
    await page.locator('button[type=submit]').click();
    await eventually(async()=>assert.deepEqual((await page.evaluate(()=>window.saved)).images,images));
    await page.close();console.log('PASS legacy cover retained in editor and save payload');
  }
  {
    const page=await mount({kind:'editor',images});
    await page.locator('input[type=file]').setInputFiles([file('0.png'),file('fail.png'),file('2.png')]);
    await eventually(async()=>assert.equal(await page.locator('[data-testid=post-image-previews] img').count(),2));
    assert.ok(await page.getByRole('alert').isVisible());
    assert.deepEqual(await page.locator('[data-testid=post-image-previews] img').evaluateAll(els=>els.map(el=>el.getAttribute('src'))),[images[0],images[2]]);
    await page.locator('input[type=file]').setInputFiles([file('1.png')]);
    await eventually(async()=>assert.equal(await page.locator('[data-testid=post-image-previews] img').count(),3));
    await page.close();console.log('PASS partial upload failure keeps successful images and allows retry');
  }
  {
    const page=await mount({kind:'editor',images});
    await page.locator('input[type=file]').setInputFiles([{name:'invalid.gif',mimeType:'image/gif',buffer:Buffer.from('invalid')}]);
    assert.ok(await page.getByRole('alert').isVisible());
    assert.equal(await page.locator('[data-testid=post-image-previews] img').count(),0);
    await page.locator('input[type=file]').setInputFiles(Array.from({length:11},()=>file('0.png')));
    assert.ok((await page.getByRole('alert').innerText()).includes('10'));
    await page.close();console.log('PASS file type and 10-photo limit validation');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS no component runtime errors');
} finally { await browser.close(); }
