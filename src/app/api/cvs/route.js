import { runCourtroomValidation } from '../../../lib/coa/index.js';
import { createCourtroomPersistence, loadCourtroomHistory } from '../../../lib/cvs/persistence.js';
import { getAuthenticatedUser } from '../../../lib/supabase/api-auth.js';

export const runtime = 'nodejs';

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function withHistoryContext(body, history) {
  const pieces = [body?.context, history?.contextBlock ? `Courtroom history:\n${history.contextBlock}` : ''].filter(Boolean);
  return pieces.join('\n\n');
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const history = await loadCourtroomHistory({ userId: user?.sub });
    return Response.json({ history });
  } catch (err) {
    return jsonError(
      'Unexpected courtroom history error: ' + (err && err.message ? err.message : String(err)),
      500,
    );
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser();
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Could not parse request body as JSON.', 400);
    }

    const history = await loadCourtroomHistory({ userId: user?.sub });
    const persistence = await createCourtroomPersistence({ userId: user?.sub || body?.userId || null });
    const result = await runCourtroomValidation(
      {
        ...body,
        context: withHistoryContext(body, history),
        userId: user?.sub || body?.userId || null,
      },
      { persistence },
    );

    return Response.json({ result, history });
  } catch (err) {
    return jsonError(
      'Unexpected courtroom validation error: ' + (err && err.message ? err.message : String(err)),
      500,
    );
  }
}
