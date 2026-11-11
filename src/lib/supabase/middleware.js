import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { isPosOwner } from '../pos/access.js';
import { isPublicPath } from '../public-routes.js';
import { getSupabaseKey, getSupabaseUrl } from './env.js';

function isOwnerPath(pathname) {
  return pathname === '/agents' || pathname === '/agents/';
}

export async function updateSession(request) {
  let response = NextResponse.next({ request });
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;
  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && isOwnerPath(pathname) && !isPosOwner(user)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
