import { getSiteUrl } from '../lib/site.js';

const publicRoutes = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
];

export default function sitemap() {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();

  return publicRoutes.map((path) => ({
    url: new URL(path, baseUrl).toString(),
    lastModified,
  }));
}
