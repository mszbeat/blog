type Media = { images?: string[] | null; coverImage?: string | null };

/** New clients send the ordered gallery. Older clients may send only a cover. */
export function normalizePostMedia(input: Media, existing?: Media): { images?: string[]; coverImage?: string } {
  if (input.images === undefined && input.coverImage === undefined) return {};
  const ordered = input.images !== undefined
    ? input.images ?? []
    : [input.coverImage, ...(existing?.images ?? [])];
  const images = [...new Set(ordered.filter((url): url is string => !!url?.trim()).map(url => url.trim()))];
  return { images, coverImage: images[0] ?? '' };
}
