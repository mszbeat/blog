import { resolveMedia } from './utils';

/** Ordered gallery, including covers saved separately by older editors. */
export function getPostImages(post?: { coverImage?: string | null; images?: string[] | null }): string[] {
  const seen = new Set<string>();
  return [post?.coverImage, ...(post?.images ?? [])].filter((url): url is string => {
    if (!url?.trim()) return false;
    const key = resolveMedia(url.trim()) ?? url.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Explicit empty fields are important when editing: removing all photos clears both. */
export function postImagePayload(images: string[]) {
  return { images, coverImage: images[0] ?? '' };
}
