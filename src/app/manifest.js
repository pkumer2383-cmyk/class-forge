import { BRAND } from '../lib/brand.js';

export default function manifest() {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: BRAND.colors.ink,
    theme_color: BRAND.colors.indigo,
    icons: [
      {
        src: BRAND.assets.icon192,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: BRAND.assets.icon512,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

