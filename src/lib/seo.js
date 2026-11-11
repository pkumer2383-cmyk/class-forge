import { getSiteUrl } from './site.js';
import { BRAND } from './brand.js';

export const SITE_NAME = BRAND.name;
export const SITE_DESCRIPTION =
  'Build a better college schedule with a fast planner for course catalogs, degree requirements, saved schedules, and academic advising.';
export const SITE_URL = getSiteUrl();
export const DEFAULT_OG_IMAGE = BRAND.assets.instagramBackground;

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = '/',
  noindex = false,
  keywords = [],
} = {}) {
  const canonical = path;
  const canonicalUrl = absoluteUrl(path);

  return {
    metadataBase: new URL(SITE_URL),
    applicationName: BRAND.name,
    title,
    description,
    category: BRAND.category,
    alternates: {
      canonical,
    },
    keywords,
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: BRAND.assets.icon192, sizes: '192x192', type: 'image/png' },
        { url: BRAND.assets.icon512, sizes: '512x512', type: 'image/png' },
      ],
      apple: BRAND.assets.appleIcon,
    },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: typeof title === 'string' ? title : SITE_NAME,
      description,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: typeof title === 'string' ? title : SITE_NAME,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          nocache: true,
        }
      : {
          index: true,
          follow: true,
          nocache: false,
        },
  };
}
