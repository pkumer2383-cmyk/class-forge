const PUBLIC_PATHS = new Set([
  '/',
  '/about',
  '/contact',
  '/cvs',
  '/opengraph-image',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
]);

export function isPublicPath(pathname) {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return PUBLIC_PATHS.has(normalized);
}
