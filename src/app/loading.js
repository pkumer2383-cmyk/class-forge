import Image from 'next/image';
import { BRAND } from '../lib/brand.js';

export default function Loading() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at top left, rgba(79, 70, 229, 0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(6, 182, 212, 0.12), transparent 24%), #07111f',
        color: '#e2e8f0',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: 'min(940px, 100%)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.78)',
          padding: 24,
          boxShadow: '0 30px 90px rgba(2, 6, 23, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c4b5fd' }}>
              {BRAND.name}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>Loading your schedule builder</div>
            <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>{BRAND.tagline}</div>
          </div>
          <Image
            src={BRAND.assets.logoProfile}
            alt=""
            width={42}
            height={42}
            style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }}
          />
        </div>
        <div style={{ display: 'grid', gap: 16, marginTop: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: 92,
                borderRadius: 8,
                border: '1px solid rgba(148, 163, 184, 0.14)',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
