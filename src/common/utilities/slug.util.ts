export function slugify(text: string): string {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')                          
    .replace(/[^\u0600-\u06FFa-z0-9\-]+/g, '')     
    .replace(/\-\-+/g, '-')                         
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}