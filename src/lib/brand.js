export const BRAND = Object.freeze({
  name: 'ClassForge',
  tagline: 'Build your college class schedule in minutes.',
  category: 'college schedule builder',
  instagramHandle: '@classforge_official',
  socialDisplayName: 'ClassForge | College Schedule Builder',
  // Public contact address. Override per deployment with NEXT_PUBLIC_SUPPORT_EMAIL.
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'classforge.app@gmail.com',
  assets: Object.freeze({
    logoProfile: '/brand/classforge-logo-profile.png',
    instagramBackground: '/brand/classforge-instagram-background.png',
    facebookCover: '/brand/classforge-facebook-cover.png',
    brandSocialAssets: '/brand/classforge-brand-social-assets.png',
    icon192: '/icon-192.png',
    icon512: '/icon-512.png',
    appleIcon: '/apple-icon.png',
  }),
  colors: Object.freeze({
    ink: '#07111f',
    panel: '#0f172a',
    blue: '#2563eb',
    indigo: '#4f46e5',
    violet: '#7c3aed',
    cyan: '#06b6d4',
  }),
});

