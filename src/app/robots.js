import { getSiteUrl } from '../lib/site.js';

export default function robots() {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: new URL('/sitemap.xml', baseUrl).toString(),
    host: baseUrl,
  };
}
