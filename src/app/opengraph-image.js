import { ImageResponse } from 'next/og';
import { BRAND } from '../lib/brand.js';
import { getSiteUrl } from '../lib/site.js';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function Image() {
  const siteUrl = getSiteUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background:
            'radial-gradient(circle at top left, rgba(79, 70, 229, 0.32), transparent 32%), linear-gradient(135deg, #07111f 0%, #172554 52%, #312e81 100%)',
          color: '#e2e8f0',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#c4b5fd' }}>
              {siteUrl.replace('https://', '').replace('http://', '')}
            </div>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02, marginTop: 8 }}>
              {BRAND.name}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
          <div style={{ fontSize: 34, color: '#cbd5e1', lineHeight: 1.25 }}>
            {BRAND.tagline}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 22, color: '#bfdbfe' }}>
            <span style={{ padding: '10px 18px', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 9999 }}>Schedule builder</span>
            <span style={{ padding: '10px 18px', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 9999 }}>Degree tracker</span>
            <span style={{ padding: '10px 18px', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 9999 }}>{BRAND.instagramHandle}</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
