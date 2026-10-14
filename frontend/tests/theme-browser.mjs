// Real Next + Nest + PostgreSQL + Redis, not an isolated mock harness.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const fixture=JSON.parse(await readFile('../backend/.cache/appearance-fixture.json','utf8'));
const base=process.env.TEST_SITE??'http://127.0.0.1:3001';
const browser=await chromium.launch();const errors=[];
async function session(user,width=1366) {
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(({accessToken,refreshToken})=>{localStorage.setItem('blog.accessToken',accessToken);localStorage.setItem('blog.refreshToken',refreshToken);},{accessToken:user.accessToken,refreshToken:user.refreshToken});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));return {context,page};
}
async function eventually(check) {for(let i=0;i<60;i++){try{await check();return;}catch(e){if(i===59)throw e;await new Promise(r=>setTimeout(r,100));}}}
try {
 const {context:adminContext,page:admin}=await session(fixture.admin);
 await admin.goto(base+'/en/admin/palette');await admin.getByTestId('theme-studio').waitFor();
 assert.equal(await admin.locator('[data-testid^="edit-theme-"]').count(),4);
 await admin.getByTestId('edit-theme-iris').click();await admin.getByTestId('edit-mode-light').click();
 const darkBefore=await admin.evaluate(async()=>{const a=await(await fetch('/api/appearance/themes')).json();return a.find(t=>t.id==='iris').dark['--palette-brand-600'];});
 const before=await admin.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--palette-brand-600').trim());
 const newColor=(await admin.getByRole('textbox',{name:'--palette-brand-600',exact:true}).inputValue())==='#7133aa'?'#743aaa':'#7133aa';
 await admin.getByRole('textbox',{name:'--palette-brand-600',exact:true}).fill(newColor);
 assert.equal(await admin.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--palette-brand-600').trim()),before,'draft must not change global theme');
 const saved=admin.waitForResponse(r=>r.url().endsWith('/appearance/themes/iris')&&r.request().method()==='PUT');
 await admin.getByTestId('publish-theme').click();assert.equal((await saved).status(),200);
 await admin.getByRole('status').filter({hasText:'Theme colors saved'}).waitFor();
 await admin.getByTestId('edit-mode-dark').click();assert.equal(await admin.getByRole('textbox',{name:'--palette-brand-600',exact:true}).inputValue(),darkBefore);
 await admin.getByRole('textbox',{name:'--surface',exact:true}).fill('#zzzzzz');assert.ok(await admin.getByTestId('publish-theme').isDisabled());
 await admin.getByRole('button',{name:'Discard changes',exact:true}).click();
 await admin.reload();await admin.getByTestId('theme-studio').waitFor();await admin.getByTestId('edit-theme-iris').click();await admin.getByTestId('edit-mode-light').click();
 assert.equal(await admin.getByRole('textbox',{name:'--palette-brand-600',exact:true}).inputValue(),newColor);
 await admin.getByRole('button',{name:'Primary',exact:true}).click();
 await mkdir('.cache',{recursive:true});await admin.screenshot({path:'.cache/theme-studio-en.png',fullPage:true});
 console.log('PASS admin: 4 themes, actual PUT, draft isolation, independent modes, validation, discard, persisted colors after reload');
 const {context:readerContext,page:reader}=await session(fixture.reader,390);
 await reader.goto(base+'/en/palette');await reader.waitForURL('**/en/admin/palette');
 await eventually(async()=>assert.ok((await reader.locator('main').innerText()).includes('permission')||(await reader.locator('main').innerText()).includes('Access denied')));
 assert.equal(await reader.getByTestId('theme-studio').count(),0);
 await reader.goto(base+'/en');
 await reader.getByRole('button',{name:'Settings',exact:true}).click();
 const settings=reader.getByRole('dialog');await settings.waitFor();
 assert.equal(await settings.locator('input[type=color]').count(),0);assert.equal(await settings.locator('a[href*=palette]').count(),0);
 await settings.getByRole('button',{name:'Iris',exact:true}).click();
 await settings.getByRole('button',{name:'Light',exact:true}).click();
 await eventually(async()=>assert.equal(await reader.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--palette-brand-600').trim()),newColor));
 await settings.getByRole('button',{name:'Dark',exact:true}).click();
 await eventually(async()=>assert.equal(await reader.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--palette-brand-600').trim()),darkBefore));
 await settings.getByRole('button',{name:'فارسی',exact:true}).click();
 await reader.waitForURL('**/fa');
 await eventually(async()=>assert.equal(await reader.evaluate(()=>document.documentElement.dataset.colorTheme),'iris'));
 assert.equal(await reader.evaluate(()=>document.documentElement.classList.contains('dark')),true);
 await reader.reload();
 await eventually(async()=>assert.equal(await reader.evaluate(()=>document.documentElement.dataset.colorTheme),'iris'));
 assert.equal(await reader.evaluate(()=>document.documentElement.classList.contains('dark')),true);
 assert.ok(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS ordinary user: admin route denied, no palette edit in Settings, saved global colors visible, theme/mode survive locale switch and reload, mobile width');
 await admin.goto(base+'/fa/admin/palette');await admin.getByTestId('theme-studio').waitFor();await admin.setViewportSize({width:390,height:844});
 await admin.getByTestId('edit-theme-ocean').click();await admin.getByTestId('edit-mode-dark').click();
 assert.ok(await admin.getByTestId('edit-mode-dark').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;}));
 assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const mobileColor=admin.getByRole('textbox',{name:'--palette-brand-600',exact:true});
 await mobileColor.fill((await mobileColor.inputValue())==='#1d4ed8'?'#2563eb':'#1d4ed8');
 const mobileSave=admin.waitForResponse(r=>r.url().endsWith('/appearance/themes/ocean')&&r.request().method()==='PUT');
 await admin.getByTestId('publish-theme').click();assert.equal((await mobileSave).status(),200);
 await admin.getByRole('button',{name:'رنگ اصلی',exact:true}).click();await admin.screenshot({path:'.cache/theme-studio-fa.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS Persian admin mobile, no runtime errors');
 await adminContext.close();await readerContext.close();
} finally {await browser.close();}
