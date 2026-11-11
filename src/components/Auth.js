// src/components/Auth.js
'use client';
import Image from 'next/image';
import { useState } from 'react';
import { BRAND } from '../lib/brand';
import { supabase } from '../lib/supabase';

export default function Auth({ open, onClose, theme = 'dark' }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  if (!open) return null;
  const dark = theme === 'dark';

  async function withGoogle() {
    setBusy(true); setErr(null);
    const redirectTo =
      typeof window !== 'undefined'
        ? new URL(`/auth/callback?next=${encodeURIComponent(window.location.pathname)}`, window.location.origin).toString()
        : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) setErr(error.message);
    setBusy(false);
  }

  async function withEmail(e) {
    e?.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose?.();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Check your email to confirm your account.');
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={
          'w-full max-w-sm rounded-2xl border p-6 shadow-2xl ' +
          (dark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900')
        }
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src={BRAND.assets.logoProfile} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <div className={dark ? 'text-xs text-indigo-300' : 'text-xs text-indigo-600'}>{BRAND.name}</div>
              <h2 className="text-xl font-bold">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              'rounded-md px-2 py-1 text-sm ' +
              (dark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500')
            }
            aria-label="Close"
          >✕</button>
        </div>

        <button
          type="button"
          onClick={withGoogle}
          disabled={busy}
          className={
            'w-full mb-3 rounded-lg border px-4 py-2.5 text-sm font-medium ' +
            (dark
              ? 'bg-white text-slate-900 border-white hover:bg-slate-100'
              : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50') +
            ' disabled:opacity-50'
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.1 4 9.3 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5.1l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.1 39.6 16 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.2-4.5 5.5l6.2 5.2C40.5 36 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className={'flex-1 h-px ' + (dark ? 'bg-slate-700' : 'bg-slate-200')} />
          <span className={'text-xs ' + (dark ? 'text-slate-500' : 'text-slate-400')}>or</span>
          <div className={'flex-1 h-px ' + (dark ? 'bg-slate-700' : 'bg-slate-200')} />
        </div>

        <form onSubmit={withEmail} className="space-y-3">
          <div>
            <label className="block text-xs mb-1 opacity-80">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
              className={
                'w-full rounded-lg border px-3 py-2 text-sm outline-none ' +
                (dark
                  ? 'bg-slate-800 border-slate-700 focus:border-indigo-400 text-slate-100'
                  : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-900')
              }
            />
          </div>
          <div>
            <label className="block text-xs mb-1 opacity-80">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className={
                'w-full rounded-lg border px-3 py-2 text-sm outline-none ' +
                (dark
                  ? 'bg-slate-800 border-slate-700 focus:border-indigo-400 text-slate-100'
                  : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-900')
              }
            />
          </div>
          {err && <div className="text-xs text-rose-400">{err}</div>}
          {msg && <div className="text-xs text-emerald-400">{msg}</div>}
          <button
            type="submit" disabled={busy}
            className={
              'w-full rounded-lg px-4 py-2.5 text-sm font-semibold ' +
              'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50'
            }
          >
            {busy ? 'Working…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); setMsg(null); }}
          className={'block w-full text-center text-xs mt-4 underline ' + (dark ? 'text-slate-400' : 'text-slate-500')}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
