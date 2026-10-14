// Run against the disposable real API started with CACHE_ENABLED=false.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const Redis=require('ioredis');
if(process.env.ALLOW_DISPOSABLE_TEST!=='true')throw Error('Disposable test server required.');
const redis=new Redis();const base=process.env.TEST_API??'http://127.0.0.1:3000';
const {author,post}=JSON.parse(await readFile('../frontend/.cache/social-fixture.json','utf8'));
const key=`cache:v2:post:slug:${post.slug}`;
try {
 await redis.set(key,JSON.stringify({...post,title:'STALE CACHE PROBE'}),'EX',60);
 let result=await(await fetch(`${base}/post/${post.slug}`)).json();result=result.data??result;
 assert.equal(result.title,post.title,'Disabled caching must bypass an existing Redis value');
 assert.ok((await redis.get(key)).includes('STALE CACHE PROBE'),'Disabled read must not populate/overwrite cache');
 const res=await fetch(`${base}/post/${post.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${author.accessToken}`},body:JSON.stringify({content:'Edited while caching was disabled.'})});
 assert.equal(res.status,200);assert.equal(await redis.get(key),null,'Mutations invalidate even while caching is disabled');
 result=await(await fetch(`${base}/post/${post.slug}`)).json();result=result.data??result;
 assert.equal(result.content,'Edited while caching was disabled.');assert.equal(await redis.get(key),null,'Disabled reads never populate Redis');
 console.log('PASS real HTTP CACHE_ENABLED=false: cached value bypassed, no cache writes, edits invalidate old keys, authenticated edit still works');
}finally{await redis.del(key);await redis.quit();}
