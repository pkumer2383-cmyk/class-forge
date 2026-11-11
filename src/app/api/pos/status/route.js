import {
  createClassForgeOperatingStatus,
  validateChiefOperatingStatus,
} from '@/lib/pos/chief-operating-agent';
import { loadPosProjectMemory } from '@/lib/pos/persistence';
import { requirePosOwnerUser } from '@/lib/supabase/api-auth';

export const runtime = 'nodejs';

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET() {
  try {
    const { user, response } = await requirePosOwnerUser();
    if (response) return response;

    const projectMemory = await loadPosProjectMemory({ userId: user?.sub });
    const status = validateChiefOperatingStatus(
      createClassForgeOperatingStatus({ projectMemory }),
    );

    return Response.json({ status, projectMemory });
  } catch (err) {
    return jsonError(
      'Unexpected Chief Operating Agent status error: ' +
        (err && err.message ? err.message : String(err)),
      500,
    );
  }
}

