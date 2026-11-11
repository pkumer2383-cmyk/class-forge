import { runPosOrchestration } from '@/lib/pos/orchestrator';
import { createPosPersistence, loadPosProjectMemory } from '@/lib/pos/persistence';
import { requirePosOwnerUser } from '@/lib/supabase/api-auth';

export const runtime = 'nodejs';

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(request) {
  try {
    const { user, response } = await requirePosOwnerUser();
    if (response) return response;

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Could not parse request body as JSON.', 400);
    }

    const projectMemory = await loadPosProjectMemory({ userId: user?.sub });
    const context = [body?.context, projectMemory.contextBlock ? `Project memory:\n${projectMemory.contextBlock}` : '']
      .filter(Boolean)
      .join('\n\n');
    const persistence = await createPosPersistence({ userId: user?.sub });
    const result = await runPosOrchestration({ ...body, context }, { persistence });
    return Response.json({ ...result, projectMemory });
  } catch (err) {
    return jsonError(
      'Unexpected POS run error: ' + (err && err.message ? err.message : String(err)),
      500,
    );
  }
}

export async function GET() {
  try {
    const { user, response } = await requirePosOwnerUser();
    if (response) return response;

    const projectMemory = await loadPosProjectMemory({ userId: user?.sub });
    return Response.json({ projectMemory });
  } catch (err) {
    return jsonError(
      'Unexpected POS memory error: ' + (err && err.message ? err.message : String(err)),
      500,
    );
  }
}
