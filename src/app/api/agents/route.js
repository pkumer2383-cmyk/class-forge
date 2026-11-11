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

function legacyShape(result, projectMemory) {
  const plan = result.finalPlan;
  return {
    summary: plan.scopeStatement,
    consensus: plan.consensus.status,
    decisions: plan.agentRecommendations.flatMap((agent) => agent.recommendations).slice(0, 10),
    risks: plan.risks,
    nextActions: plan.tasks.map((task) => task.title),
    memoryUpdate: {
      durableDecisions: plan.agentRecommendations
        .flatMap((agent) => agent.recommendations)
        .slice(0, 5),
      openQuestions: plan.consensus.disagreementHotspots || [],
    },
    rounds: result.consensusRounds.map((round) => ({
      round: round.roundNumber,
      turns: result.agentOutputs
        .filter((output) => output.iteration === round.roundNumber)
        .map((output) => ({
          agentId: output.agentId,
          agentName: output.agentName,
          message: output.summary,
          handoffTo: round.status === 'revision_required' ? 'consensus-engine' : 'orchestrator',
        })),
    })),
    model: 'deterministic-pos-runtime',
    finishReason: 'STOP',
    preset: 'pos-mvp',
    agents: result.run.agents,
    finalPlan: plan,
    audit: {
      run: result.run,
      events: result.auditEvents,
      persistence: result.persistence,
    },
    projectMemory,
  };
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
    const result = await runPosOrchestration(
      {
        goal: body?.goal,
        context,
        constraints: body?.constraints,
        agents: body?.agents,
        maxIterations: body?.maxIterations || body?.rounds,
        approvalMode: body?.approvalMode,
      },
      { persistence },
    );

    return Response.json(legacyShape(result, projectMemory));
  } catch (err) {
    return jsonError(
      'Unexpected POS orchestration error: ' +
        (err && err.message ? err.message : String(err)),
      500,
    );
  }
}
