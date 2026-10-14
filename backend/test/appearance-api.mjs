// REAL API integration: empty disposable DB only. Never deletes production data.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_API??'http://127.0.0.1:3000';
if(process.env.ALLOW_DISPOSABLE_TEST!=='true')throw Error('Set ALLOW_DISPOSABLE_TEST=true against a disposable database only.');
async function call(path,token,method='GET',body,status=200) {
 const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json();assert.equal(res.status,status,`${method} ${path}: ${JSON.stringify(data)}`);return data?.message&&'data' in data?data.data:data;
}
const password='Appearance-test-2026!';
if(process.env.TEST_RESTART==='true') {
 const fixture=JSON.parse(await readFile('.cache/appearance-fixture.json','utf8'));
 const themes=await call('/appearance/themes');
 assert.equal(themes.find(t=>t.id==='ocean').light['--palette-brand-600'],fixture.color);
 assert.equal((await call('/auth/me',fixture.admin.accessToken)).role,'admin');
 console.log('PASS catalog and auth sessions survive backend restart / cache toggle');
} else {
 const stamp=Date.now();
 const signup=name=>call('/auth/register',null,'POST',{name,email:`${name}-${stamp}@example.com`,password,confirmPassword:password},201);
 const pair=await Promise.all([signup('theme-first-a'),signup('theme-first-b')]);
 assert.equal(pair.filter(x=>x.user.role==='admin').length,1,'Exactly ONE first admin, even for concurrent registrations. Requires empty DB.');
 const admin=pair.find(x=>x.user.role==='admin');const reader=pair.find(x=>x.user.role==='user');
 assert.ok(admin && reader);assert.equal((await signup('theme-third')).user.role,'user');
 await call('/auth/register',null,'POST',{name:'Injected',email:`injected-${stamp}@example.com`,password,confirmPassword:password,role:'admin'},400);
 assert.ok(!('password' in admin.user));assert.ok(!('password' in await call('/auth/me',admin.accessToken)));
 console.log('PASS first signup transaction, concurrent signups, later user role, role injection rejected, no password hash exposed');
 let themes=await call('/appearance/themes');assert.equal(themes.length,4);
 for(const theme of themes){assert.equal(Object.keys(theme.light).length,60);assert.deepEqual(Object.keys(theme.light).sort(),Object.keys(theme.dark).sort());}
 const ocean=themes.find(t=>t.id==='ocean');const body={version:ocean.version,light:{...ocean.light},dark:{...ocean.dark}};
 await call('/appearance/themes/ocean',null,'PUT',body,401);
 await call('/appearance/themes/ocean',reader.accessToken,'PUT',body,403);
 await call('/appearance/themes/ocean',admin.accessToken,'PUT',{...body,light:{...body.light,'--malicious':'url(javascript:alert(1))'}},400);
 await call('/appearance/themes/ocean',admin.accessToken,'PUT',{...body,light:{...body.light,'--surface':'url(https://evil.example)'}},400);
 await call('/appearance/themes/ocean',admin.accessToken,'PUT',{...body,version:0},400);
 const color='#176b8f';body.light['--palette-brand-600']=color;
 const saved=await call('/appearance/themes/ocean',admin.accessToken,'PUT',body);
 assert.equal(saved.version,ocean.version+1);assert.equal(saved.light['--palette-brand-600'],color);assert.deepEqual(saved.dark,ocean.dark);
 await call('/appearance/themes/ocean',admin.accessToken,'PUT',body,409);
 themes=await call('/appearance/themes');assert.equal(themes.find(t=>t.id==='ocean').light['--palette-brand-600'],color);
 const second=await call('/users',admin.accessToken,'POST',{name:'Temp admin',email:`temp-admin-${stamp}@example.com`,password,confirmPassword:password,role:'admin'},201);
 const logged=await call('/auth/login',null,'POST',{email:second.email,password},200);
 await call(`/users/${second.id}/admin`,admin.accessToken,'PATCH',{role:'user'});
 await call('/appearance/themes/ocean',logged.accessToken,'PUT',{...body,version:saved.version},403);
 console.log('PASS public catalog, 401/403, demoted admin, whitelist/HEX validation, light/dark independence, version conflict, persistence');
 await mkdir('.cache',{recursive:true});await writeFile('.cache/appearance-fixture.json',JSON.stringify({admin,reader,color,password}));
}
