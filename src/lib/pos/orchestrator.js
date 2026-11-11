import { selectAgents } from './agents.js';
import { computeConsensusRound, shouldContinueConsensus } from './consensus.js';
import { buildPosRunTelemetry } from './telemetry.js';
import {
  DEFAULT_CONSENSUS_SETTINGS,
  createRunRecord,
  isoNow,
  normalizeGoalInput,
  validateFinalPlan,
} from './schemas.js';

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function withWeights(outputs, agents) {
  const weights = new Map(agents.map((agent) => [agent.id, agent.weight]));
  return outputs.map((output) => ({
    ...output,
    agentWeight: weights.get(output.agentId) || 1,
  }));
}

function buildAgentInput({ input, iteration, priorConsensus, priorOutputs }) {
  return {
    goal: input.goal,
    context: input.context,
    constraints: input.constraints,
    approvalMode: input.approvalMode,
    maxIterations: input.maxIterations,
    iteration,
    priorConsensus,
    priorOutputs,
  };
}

function milestoneFromTask(task, index) {
  const phase = index < 2 ? 'Foundation' : index < 5 ? 'Runtime' : 'Delivery';
  return {
    id: `milestone-${index + 1}`,
    title: task,
    phase,
    status: 'planned',
  };
}

function taskFromText(task, index, agentName) {
  return {
    id: `task-${index + 1}`,
    title: task,
    owner: agentName || 'Orchestrator',
    status: 'ready',
    approvalRequired: /external|irreversible|approval|spending|deletion/i.test(task),
  };
}

export function generateFinalPlan({ run, rounds, outputsByRound }) {
  const latestOutputs = outputsByRound[outputsByRound.length - 1] || [];
  const allOutputs = outputsByRound.flat();
  const finalConsensus = rounds[rounds.length - 1];
  const tasks = unique(latestOutputs.flatMap((output) => output.tasks || []))
    .slice(0, 12)
    .map((task, index) => {
      const ownerOutput = latestOutputs.find((output) => (output.tasks || []).includes(task));
      return taskFromText(task, index, ownerOutput?.agentName);
    });

  const risks = unique(allOutputs.flatMap((output) => output.concerns || [])).slice(0, 10);
  const assumptions = unique(allOutputs.flatMap((output) => output.assumptions || [])).slice(0, 10);
  const approvalsRequired = unique([
    ...(finalConsensus?.approvalsRequired || []),
    ...tasks.filter((task) => task.approvalRequired).map((task) => `Approve: ${task.title}`),
  ]);

  const recommendations = latestOutputs.map((output) => ({
    agentId: output.agentId,
    agentName: output.agentName,
    summary: output.summary,
    recommendations: output.recommendations,
    scores: output.scores,
  }));

  const plan = {
    goalId: run.goalId,
    runId: run.id,
    goalSummary: run.goal,
    scopeStatement:
      'MVP scope: accept one goal, delegate to specialist agents, run bounded consensus, persist an audit trail, and return an execution-ready plan.',
    assumptions,
    risks,
    agentRecommendations: recommendations,
    revisionNotes: unique(allOutputs.flatMap((output) => output.revisionNotes || [])),
    consensus: finalConsensus,
    milestones: tasks.slice(0, 6).map((task, index) => milestoneFromTask(task.title, index)),
    tasks,
    approvalsRequired,
    memoryLinks: [
      {
        sourceType: 'local-doc',
        sourceUri: 'docs/POS-architecture-and-roadmap.md',
        summary: 'Architecture and database schema source of truth.',
      },
      {
        sourceType: 'local-doc',
        sourceUri: 'docs/POS-implementation-roadmap.md',
        summary: 'MVP milestones and build order.',
      },
    ],
    auditSummary: {
      agentOutputCount: allOutputs.length,
      consensusRoundCount: rounds.length,
      completedAt: isoNow(),
    },
  };

  return validateFinalPlan(plan);
}

export async function runPosOrchestration(rawInput, options = {}) {
  const input = normalizeGoalInput(rawInput);
  if (!input.goal) throw new Error('A goal is required.');

  const settings = {
    ...DEFAULT_CONSENSUS_SETTINGS,
    maxIterations: input.maxIterations,
  };
  const agents = selectAgents(input.requestedAgents);
  const run = createRunRecord(input, agents);
  const persistence = options.persistence || null;
  const outputsByRound = [];
  const rounds = [];
  const auditEvents = [];

  async function record(eventType, payload) {
    const event = {
      eventType,
      runId: run.id,
      payload,
      createdAt: isoNow(),
    };
    auditEvents.push(event);
    if (persistence) await persistence.recordEvent(event);
  }

  if (persistence) await persistence.createRun(run);
  await record('run_started', { goal: run.goal, agentCount: agents.length });

  let iteration = 1;
  let priorConsensus = null;
  let priorOutputs = [];

  while (iteration <= settings.maxIterations) {
    const agentInput = buildAgentInput({ input, iteration, priorConsensus, priorOutputs });
    const outputs = withWeights(
      agents.map((agent) => agent.run(agentInput)),
      agents,
    );
    outputsByRound.push(outputs);

    for (const output of outputs) {
      if (persistence) await persistence.recordAgentOutput(run, output);
      await record('agent_output_recorded', {
        iteration,
        agentId: output.agentId,
        confidence: output.scores.confidence,
      });
    }

    const round = computeConsensusRound({
      runId: run.id,
      roundNumber: iteration,
      outputs,
      settings,
    });
    rounds.push(round);
    if (persistence) await persistence.recordConsensusRound(run, round);
    await record('consensus_round_recorded', round);

    if (!shouldContinueConsensus({ round, iteration, settings })) break;
    priorConsensus = round;
    priorOutputs = outputs;
    iteration += 1;
  }

  const finalPlan = generateFinalPlan({ run, rounds, outputsByRound });
  run.state = finalPlan.approvalsRequired.length ? 'approval_required' : 'completed';
  run.completedAt = finalPlan.auditSummary.completedAt;
  if (persistence) await persistence.recordFinalPlan(run, finalPlan);
  const persistenceStatus = persistence ? persistence.status() : { mode: 'memory', durable: false, retryCount: 0 };
  await record('final_plan_recorded', {
    state: run.state,
    confidenceScore: finalPlan.consensus.confidenceScore,
    taskCount: finalPlan.tasks.length,
  });

  return {
    schemaVersion: run.schemaVersion,
    run,
    finalPlan,
    agentOutputs: outputsByRound.flat(),
    consensusRounds: rounds,
    auditEvents,
    telemetry: buildPosRunTelemetry({
      run,
      finalPlan,
      auditEvents,
      consensusRounds: rounds,
      persistence: persistenceStatus,
      retryCount: persistenceStatus.retryCount || 0,
      startedAt: run.startedAt,
    }),
    persistence: persistenceStatus,
  };
}
