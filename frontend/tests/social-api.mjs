// Integration test: requires the REAL Nest API + PostgreSQL + Redis on :3000.
// Creates isolated disposable accounts; does not modify existing user data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_API ?? 'http://127.0.0.1:3000';
async function call(path, token, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json();
  assert.ok(res.ok, `${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
  return 'message' in data && 'data' in data ? data.data : data;
}
const stamp = Date.now();
const password = 'Regression-test-2026!';
const signup = name => call('/auth/register', null, 'POST', { name, email: `${name}-${stamp}@example.com`, password, confirmPassword: password });
const author = await signup('regression-author');
const reader = await signup('regression-reader');
const post = await call('/post', author.accessToken, 'POST', { title: `Persistence regression ${stamp}`, content: 'Real database regression test. This post exists only in the disposable test database.', published: true });
// Prime both Redis entries BEFORE the writes.
await call('/post');
await call(`/post/${post.slug}`);
const setLike = liked => call(`/posts/${post.id}/like`, reader.accessToken, 'POST', { liked });
for (const liked of [true, true, false, false, true]) {
  const response = await setLike(liked);
  assert.equal(response.liked, liked);
  assert.equal(response.likeCount, Number(liked));
  const detail = await call(`/post/${post.slug}`, reader.accessToken);
  assert.equal(detail.likeCount, Number(liked), 'Redis detail has fresh counter');
  assert.equal(detail.likedByMe, liked);
  const list = await call('/post', reader.accessToken);
  const card = list.data.find(p => p.id === post.id);
  assert.equal(card.likeCount, Number(liked), 'Redis list has fresh counter');
  assert.equal(card.likedByMe, liked, 'Redis hit stamps viewer state');
  const anonymous = await call(`/post/${post.slug}`);
  assert.equal(anonymous.likedByMe, false, 'viewer state never leaks into shared cache');
}
console.log('PASS likes: warm Redis + refresh + unlike + idempotent repeated requests');
// Simultaneous identical intent cannot drift the counter.
await Promise.all([setLike(true), setLike(true), setLike(true)]);
assert.equal((await call(`/post/${post.slug}`)).likeCount, 1);
console.log('PASS concurrent like writes: count remains 1');
for (const following of [true, true, false, false, true]) {
  const state = await call(`/users/${author.user.id}/follow`, reader.accessToken, following ? 'POST' : 'DELETE');
  assert.equal(state.isFollowing, following);
  assert.equal(state.followersCount, Number(following));
  const fresh = await call(`/users/${author.user.id}/public`, reader.accessToken);
  assert.equal(fresh.isFollowing, following);
  assert.equal(fresh.stats.followers, Number(following));
}
console.log('PASS follow/unfollow: idempotency + authenticated fresh profile');
const comment = await call(`/posts/${post.id}/comments`, reader.accessToken, 'POST', { content: 'Counter regression' });
assert.equal((await call(`/post/${post.slug}`)).commentCount, 1);
await call(`/comments/${comment.id}`, reader.accessToken, 'DELETE');
assert.equal((await call(`/post/${post.slug}`)).commentCount, 0);
console.log('PASS comment create/delete counters with warm Redis');
await setLike(false);
await call(`/users/${author.user.id}/follow`, reader.accessToken, 'DELETE');
await mkdir('.cache', { recursive: true });
await writeFile('.cache/social-fixture.json', JSON.stringify({ author, reader, post, password }));
console.log('PASS fixture ready for browser regression (no mocked API)');
