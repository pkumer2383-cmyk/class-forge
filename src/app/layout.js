// src/app/layout.js
import './globals.css';
import Analytics from '../components/Analytics.js';
import { BRAND } from '../lib/brand.js';
import { buildMetadata, SITE_DESCRIPTION } from '../lib/seo.js';

export const metadata = buildMetadata({
  title: `${BRAND.name} (Beta): ${BRAND.tagline}`,
  description: SITE_DESCRIPTION,
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
