// Real Redis DB 14; no auth/session keys touched.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Redis=require('ioredis');const {ConfigService}=require('@nestjs/config');
const {DataCacheService}=require('../dist/redis/data-cache.service.js');
const redis=new Redis({host:'127.0.0.1',port:6379,db:14});
const logger={forContext:()=>({info(){},warn(){}})};
const on=new DataCacheService(redis,new ConfigService({CACHE_ENABLED:'true'}),logger);
const off=new DataCacheService(redis,new ConfigService({CACHE_ENABLED:'false'}),logger);
const key=`test-${Date.now()}`;
try {
 await on.set(key,{value:1},60);assert.deepEqual(await on.get(key),{value:1});assert.ok(await redis.ttl(`cache:v2:${key}`)>0);
 assert.equal(await off.get(key),null);await off.set(key,{value:2},60);assert.deepEqual(await on.get(key),{value:1});
 await off.delete(key);assert.equal(await on.get(key),null);
 await on.set(key+':a',1,60);await on.set(key+':b',2,60);await off.invalidate(key+':*');assert.equal(await on.get(key+':a'),null);assert.equal(await on.get(key+':b'),null);
 assert.throws(()=>new DataCacheService(redis,new ConfigService({CACHE_ENABLED:'maybe'}),logger),/must be true or false/);
 const down={get:async()=>{throw Error('Redis unavailable')},set:async()=>{throw Error('Redis unavailable')}};
 const fallback=new DataCacheService(down,new ConfigService({CACHE_ENABLED:'true'}),logger);assert.equal(await fallback.get(key),null);await fallback.set(key,1,60);
 console.log('PASS cache true/false, TTL, bypass read/write, invalidation while disabled, invalid config, fail-open');
} finally {await redis.del(`cache:v2:${key}`);await redis.quit();}
