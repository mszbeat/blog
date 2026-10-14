import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPostImages, postImagePayload } from '../src/lib/post-images';
import { normalizePostMedia } from '../../backend/src/posts/post-media';

test('legacy separate cover is first; existing duplicate cover is not repeated', () => {
  assert.deepEqual(getPostImages({ coverImage: 'cover', images: ['second', 'cover', 'third'] }), ['cover', 'second', 'third']);
  assert.deepEqual(getPostImages({ coverImage: '/photos/a.jpg', images: ['/api/photos/a.jpg'] }), ['/photos/a.jpg']);
});
test('new post uses first selected image for BOTH cover and gallery', () => {
  const input = postImagePayload(['a', 'b', 'c']);
  assert.deepEqual(input, { images: ['a', 'b', 'c'], coverImage: 'a' });
  assert.deepEqual(normalizePostMedia(input), input);
});
test('deleting first image promotes second; deleting all explicitly clears media', () => {
  assert.deepEqual(normalizePostMedia(postImagePayload(['b']), { images: ['a', 'b'], coverImage: 'a' }), { images: ['b'], coverImage: 'b' });
  assert.deepEqual(normalizePostMedia(postImagePayload([]), { images: ['a'], coverImage: 'a' }), { images: [], coverImage: '' });
});
test('backend canonicalizes gallery order and leaves unrelated edits untouched', () => {
  assert.deepEqual(normalizePostMedia({ images: ['a', 'b'], coverImage: 'wrong' }), { images: ['a', 'b'], coverImage: 'a' });
  assert.deepEqual(normalizePostMedia({}, { images: ['old'], coverImage: 'old' }), {});
  assert.deepEqual(normalizePostMedia({ coverImage: 'old-client' }, { images: ['b'] }), { images: ['old-client', 'b'], coverImage: 'old-client' });
});
