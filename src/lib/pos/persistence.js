import { posPersistenceFallbackReason } from './persistence-errors.js';
import { withRetry } from './retry.js';

function serialize(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryPersistence(reason = 'Supabase is not configured.') {
  const events = [];
  const runs = [];
  const outputs = [];
  const rounds = [];
  const plans = [];

  return {
    async createRun(run) {
      runs.push(serialize(run));
    },
    async recordAgentOutput(run, output) {
      outputs.push({ runId: run.id, output: serialize(output) });
    },
    async recordConsensusRound(run, round) {
      rounds.push({ runId: run.id, round: serialize(round) });
    },
    async recordFinalPlan(run, finalPlan) {
      plans.push({ run: serialize(run), finalPlan: serialize(finalPlan) });
    },
    async recordEvent(event) {
      events.push(serialize(event));
    },
    status() {
      return {
        mode: 'memory',
        durable: false,
        reason,
        retryCount: 0,
        counts: {
          runs: runs.length,
          outputs: outputs.length,
          rounds: rounds.length,
          plans: plans.length,
          events: events.length,
        },
      };
    },
  };
}

export async function createPosPersistence({ userId } = {}) {
  if (!userId) {
    return createMemoryPersistence('Sign in to persist POS audit records.');
  }

  let supabase;
  try {
    const { createClient } = await import('../supabase/server.js');
    supabase = await createClient();
  } catch (error) {
    return createMemoryPersistence(error.message);
  }

  let durable = true;
  let fallbackReason = '';
  let retryCount = 0;

  async function insert(table, payload) {
    if (!durable) return;
    let result;
    try {
      result = await withRetry(
        async () => supabase.from(table).insert(payload),
        {
          attempts: 3,
          baseDelayMs: 25,
          onRetry: () => {
            retryCount += 1;
          },
        },
      );
    } catch (error) {
      result = { error };
    }
    const { error } = result || {};
    if (error) {
      durable = false;
      fallbackReason = posPersistenceFallbackReason(error, table);
    }
  }

  return {
    async createRun(run) {
      await insert('pos_runs', {
        id: run.id,
        user_id: userId,
        goal_id: run.goalId,
        state: run.state,
        goal: run.goal,
        context: run.context,
        constraints: run.constraints,
        agents: run.agents,
        metadata: {
          schemaVersion: run.schemaVersion,
          approvalMode: run.approvalMode,
          maxIterations: run.maxIterations,
        },
        started_at: run.startedAt,
        completed_at: run.completedAt,
      });
    },
    async recordAgentOutput(run, output) {
      await insert('pos_agent_messages', {
        id: output.id,
        run_id: run.id,
        agent_id: output.agentId,
        agent_type: output.agentType,
        iteration: output.iteration,
        role: 'agent',
        content: output.summary,
        payload: output,
        confidence: output.scores.confidence,
        created_at: output.createdAt,
      });
    },
    async recordConsensusRound(run, round) {
      await insert('pos_consensus_rounds', {
        id: round.id,
        run_id: run.id,
        round_number: round.roundNumber,
        status: round.status,
        confidence_score: round.confidenceScore,
        agreement_score: round.agreementScore,
        disagreements: round.disagreementHotspots,
        payload: round,
        created_at: round.createdAt,
      });
    },
    async recordFinalPlan(run, finalPlan) {
      await insert('pos_artifacts', {
        id: `${run.id}_final_plan`,
        run_id: run.id,
        artifact_type: 'final_plan',
        title: `Execution plan for ${run.goal.slice(0, 80)}`,
        payload: finalPlan,
        created_at: finalPlan.auditSummary.completedAt,
      });
    },
    async recordEvent(event) {
      await insert('pos_audit_events', {
        run_id: event.runId,
        event_type: event.eventType,
        payload: event.payload,
        created_at: event.createdAt,
      });
    },
    status() {
      return {
        mode: durable ? 'supabase' : 'memory',
        durable,
        reason: durable ? 'Supabase audit inserts accepted.' : fallbackReason,
        retryCount,
      };
    },
  };
}

export function createGuestProjectMemory(reason = 'Sign in to load durable project memory.') {
  return {
    durable: false,
    reason,
    recentRuns: [],
    durableDecisions: [],
    openQuestions: [],
    risks: [],
    nextActions: [],
    contextBlock: '',
  };
}

export async function loadPosProjectMemory({ userId, limit = 5 } = {}) {
  if (!userId) return createGuestProjectMemory();

  let supabase;
  try {
    const { createClient } = await import('../supabase/server.js');
    supabase = await createClient();
  } catch (error) {
    return createGuestProjectMemory(error.message);
  }

  const [runsResult, artifactsResult] = await Promise.all([
    withRetry(
      async () =>
        supabase
          .from('pos_runs')
          .select('id, goal, state, started_at, completed_at')
          .order('started_at', { ascending: false })
          .limit(limit),
      {
        attempts: 3,
        baseDelayMs: 25,
      },
    ).catch((error) => ({ error })),
    withRetry(
      async () =>
        supabase
          .from('pos_artifacts')
          .select('run_id, title, payload, created_at')
          .eq('artifact_type', 'final_plan')
          .order('created_at', { ascending: false })
          .limit(limit),
      {
        attempts: 3,
        baseDelayMs: 25,
      },
    ).catch((error) => ({ error })),
  ]);

  const error = runsResult.error || artifactsResult.error;
  if (error) {
    return createGuestProjectMemory(posPersistenceFallbackReason(error, error.table || 'pos_runs'));
  }

  const recentRuns = (runsResult.data || []).map((run) => ({
    id: run.id,
    goal: run.goal,
    state: run.state,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  }));

  const plans = (artifactsResult.data || []).map((artifact) => artifact.payload || {});
  const durableDecisions = uniqueStrings(
    plans.flatMap((plan) =>
      (plan.agentRecommendations || []).flatMap((agent) => agent.recommendations || []),
    ),
  ).slice(0, 8);
  const openQuestions = uniqueStrings(
    plans.flatMap((plan) => plan.consensus?.disagreementHotspots || []),
  ).slice(0, 8);
  const risks = uniqueStrings(plans.flatMap((plan) => plan.risks || [])).slice(0, 8);
  const nextActions = uniqueStrings(
    plans.flatMap((plan) => (plan.tasks || []).map((task) => task.title)),
  ).slice(0, 8);

  return {
    durable: true,
    reason: recentRuns.length
      ? 'Loaded durable project memory from prior POS runs.'
      : 'No prior POS runs yet.',
    recentRuns,
    durableDecisions,
    openQuestions,
    risks,
    nextActions,
    contextBlock: buildProjectMemoryContext({
      recentRuns,
      durableDecisions,
      openQuestions,
      risks,
      nextActions,
    }),
  };
}

function uniqueStrings(items) {
  return [...new Set(items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))];
}

function buildProjectMemoryContext(memory) {
  const lines = [];
  if (memory.recentRuns.length) {
    lines.push('Prior POS runs:');
    for (const run of memory.recentRuns) {
      lines.push(`- ${run.goal} (${run.state})`);
    }
  }
  if (memory.durableDecisions.length) {
    lines.push('Durable prior decisions:');
    for (const decision of memory.durableDecisions) lines.push(`- ${decision}`);
  }
  if (memory.nextActions.length) {
    lines.push('Previously recommended next actions:');
    for (const action of memory.nextActions) lines.push(`- ${action}`);
  }
  if (memory.risks.length) {
    lines.push('Known risks from prior runs:');
    for (const risk of memory.risks) lines.push(`- ${risk}`);
  }
  if (memory.openQuestions.length) {
    lines.push('Open questions from prior consensus:');
    for (const question of memory.openQuestions) lines.push(`- ${question}`);
  }
  return lines.join('\n');
}
