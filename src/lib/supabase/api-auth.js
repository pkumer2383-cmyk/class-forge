import { isPosOwner } from '../pos/access.js';

export function unauthorizedJson(message = 'Sign in to use this API.') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

export function forbiddenJson(message = 'You do not have access to this API.') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { user: null, response: unauthorizedJson() };
  }

  return { user, response: null };
}

export async function requirePosOwnerUser() {
  const { user, response } = await requireAuthenticatedUser();

  if (response) {
    return { user: null, response };
  }

  if (!isPosOwner(user)) {
    return { user: null, response: forbiddenJson('Agent control room access is restricted.') };
  }

  return { user, response: null };
}

export async function getAuthenticatedUser() {
  let supabase;
  try {
    const { createClient } = await import('./server.js');
    supabase = await createClient();
  } catch {
    return null;
  }

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return data.claims;
}
