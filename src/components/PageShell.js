// src/components/PageShell.js
// Shared shell for About/Contact/Privacy/Terms pages.
// Same fonts and theme palette as the main app, but standalone (no auth, no Supabase).
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '../lib/brand.js';

export default function PageShell({ title, lastUpdated, children, attorneyReview }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a14',
      color: '#e5e7eb',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      fontSize: 16,
      lineHeight: 1.6,
    }}>
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{
            color: '#e5e7eb', textDecoration: 'none', fontWeight: 700, fontSize: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Image
              src={BRAND.assets.logoProfile}
              alt=""
              width={28}
              height={28}
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
            />
            {BRAND.name}
          </Link>
          <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <Link href="/about" style={navLink}>About</Link>
            <Link href="/contact" style={navLink}>Contact</Link>
            <Link href="/privacy" style={navLink}>Privacy</Link>
            <Link href="/terms" style={navLink}>Terms</Link>
            <Link href="/" style={{ ...navLink, color: '#a5b4fc' }}>Open app &rarr;</Link>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px 60px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{title}</h1>
        {lastUpdated && (
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            Last updated: {lastUpdated}
          </p>
        )}
        {attorneyReview && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fcd34d',
            padding: 16,
            borderRadius: 8,
            marginBottom: 28,
            fontSize: 14,
          }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>{"⚠"} Attorney review required</strong>
            This document is a first-draft template. It has not been reviewed by a licensed attorney and is not legal advice. {BRAND.name} is currently in pre-launch and this document is provided for transparency about the operator&apos;s intent. Before using {BRAND.name} to charge users, sign institutional contracts, or otherwise transact, this document must be reviewed and finalized by a Pennsylvania-licensed attorney.
          </div>
        )}
        <div style={{ color: '#cbd5e1' }}>{children}</div>
      </main>

      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '24px',
        marginTop: 40,
        textAlign: 'center',
        color: '#64748b',
        fontSize: 13,
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          &copy; {new Date().getFullYear()} {BRAND.name}. Built in the Lehigh Valley.{' '}
          <Link href="/privacy" style={{ color: '#94a3b8' }}>Privacy</Link>{' · '}
          <Link href="/terms" style={{ color: '#94a3b8' }}>Terms</Link>{' · '}
          <Link href="/contact" style={{ color: '#94a3b8' }}>Contact</Link>
        </div>
      </footer>
    </div>
  );
}

const navLink = {
  color: '#cbd5e1',
  textDecoration: 'none',
};

export function H2({ children }) {
  return <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12, color: '#f1f5f9' }}>{children}</h2>;
}
export function H3({ children }) {
  return <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 22, marginBottom: 8, color: '#e2e8f0' }}>{children}</h3>;
}
export function P({ children }) {
  return <p style={{ marginBottom: 14 }}>{children}</p>;
}
export function UL({ children }) {
  return <ul style={{ marginBottom: 14, paddingLeft: 24 }}>{children}</ul>;
}
export function LI({ children }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>;
}
export function Strong({ children }) {
  return <strong style={{ color: '#f1f5f9' }}>{children}</strong>;
}
