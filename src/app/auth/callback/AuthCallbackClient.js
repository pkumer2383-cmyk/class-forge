'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';

export default function AuthCallbackClient({ nextPath }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        router.replace('/login?error=callback');
        return;
      }

      if (data.session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      router.replace('/login?error=callback');
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router, supabase]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-5 text-sm text-slate-300">
        Finishing sign-in...
      </div>
    </div>
  );
}
