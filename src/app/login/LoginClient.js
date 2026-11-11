'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BRAND } from '../../lib/brand';
import { createClient } from '../../lib/supabase/client';

export default function LoginClient({ nextPath, initialError }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(initialError ? decodeError(initialError) : null);

  async function signInWithPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  async function signUpWithPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: authError } = await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    setMessage('Check your email for the confirmation link.');
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', nextPath);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    });

    setBusy(false);
    if (authError) setError(authError.message);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Image src={BRAND.assets.logoProfile} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-indigo-300">{BRAND.name}</div>
              <div className="text-xs text-slate-400">{BRAND.tagline}</div>
            </div>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Sign in to continue</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your schedules, tracker, and reviews live behind your account.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full rounded-lg border border-slate-700 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <form onSubmit={mode === 'signin' ? signInWithPassword : signUpWithPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">Password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>

            {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
            {message && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setMessage(null);
            }}
            className="w-full text-center text-sm text-slate-400 underline underline-offset-4"
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

function decodeError(value) {
  if (value === 'auth') return 'Authentication failed. Please try again.';
  if (value === 'callback') return 'Could not finish sign-in. Please try again.';
  return 'Sign-in failed. Please try again.';
}
