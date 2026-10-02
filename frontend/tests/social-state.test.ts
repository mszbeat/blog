import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocialStore, EMPTY_SOCIAL } from '../src/lib/social-state';

test('snapshot is pure and stable across conflicting mounts and back navigation', () => {
  const s = new SocialStore();
  assert.equal(s.read('p'), EMPTY_SOCIAL);
  s.initialize('p', { liked: false, likeCount: 0, commentCount: 0 });
  const before = s.read('p');
  for (let i = 0; i < 100; i++) {
    s.initialize('p', { liked: i % 2 === 0, likeCount: i });
    assert.equal(s.read('p'), before);
  }
  s.setLiked('p', true);
  const after = s.read('p');
  s.initialize('p', { liked: false, likeCount: 0 });
  assert.equal(s.read('p'), after);
  assert.equal(after.likeCount, 1);
});

test('late query cannot overwrite pending intent; fresh server false wins later', () => {
  const s = new SocialStore();
  s.initialize('p', { liked: false, likeCount: 0 });
  s.begin('like:p');
  s.setLiked('p', true);
  s.reconcileLiked('p', false, Date.now());
  assert.equal(s.read('p').liked, true);
  s.finish('like:p');
  s.reconcileLiked('p', false, 1);
  assert.equal(s.read('p').liked, true);
  s.reconcileLiked('p', false, Date.now() + 1);
  assert.equal(s.read('p').liked, false);
});

test('unfollow false is not lost to stale true props; fresh remote false is accepted', () => {
  const s = new SocialStore();
  s.initializeFollow('u', true);
  s.setFollowing('u', false);
  s.initializeFollow('u', true);
  assert.equal(s.readFollow('u'), false);
  s.reconcileFollow('u', true, Date.now() + 1);
  s.reconcileFollow('u', false, Date.now() + 2);
  assert.equal(s.readFollow('u'), false);
});

test('no-op writes do not notify; comments and likes do not overwrite each other', () => {
  const s = new SocialStore();
  let notifications = 0;
  s.initialize('p', { liked: false, likeCount: 0, commentCount: 3 });
  s.subscribe('p', () => notifications++);
  s.setLiked('p', true);
  s.setLiked('p', true);
  assert.equal(notifications, 1);
  s.bump('p', { commentCount: 1 });
  s.apply('p', { liked: true, likeCount: 5 });
  assert.deepEqual(s.read('p'), { liked: true, likeCount: 5, commentCount: 4 });
});
