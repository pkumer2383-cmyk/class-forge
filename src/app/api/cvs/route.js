import { runCourtroomValidation } from '../../../lib/coa/index.js';
import { createCourtroomPersistence, loadCourtroomHistory } from '../../../lib/cvs/persistence.js';

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
    const history = await loadCourtroomHistory();
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
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Could not parse request body as JSON.', 400);
    }

    const history = await loadCourtroomHistory();
    const persistence = await createCourtroomPersistence();
    const result = await runCourtroomValidation(
      {
        ...body,
        context: withHistoryContext(body, history),
        userId: null,
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
