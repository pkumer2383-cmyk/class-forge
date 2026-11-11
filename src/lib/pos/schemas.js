export const POS_SCHEMA_VERSION = 'pos-runtime/v1';

export const AGENT_TYPES = Object.freeze({
  PROJECT_MANAGER: 'project_manager',
  RESEARCH: 'research',
  CRITIC: 'critic',
  RISK: 'risk',
  EXECUTION: 'execution',
  KNOWLEDGE: 'knowledge',
});

export const RISK_LEVELS = Object.freeze(['low', 'medium', 'high']);

export const DEFAULT_CONSENSUS_SETTINGS = Object.freeze({
  maxIterations: 2,
  confidenceThreshold: 0.78,
  agreementThreshold: 0.72,
  requireRevisionRound: true,
});

export function createId(prefix) {
  const random =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function clampScore(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number < 0) return 0;
  if (number > 1) return 1;
  return Number(number.toFixed(3));
}

export function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export function normalizeRiskLevel(value) {
  return RISK_LEVELS.includes(value) ? value : 'medium';
}

export function normalizeGoalInput(input = {}) {
  const goal = normalizeString(input.goal || input.title || input.description);
  const context = normalizeString(input.context);
  const constraints = normalizeStringArray(input.constraints);
  const approvalMode = input.approvalMode === 'manual' ? 'manual' : 'checkpoint';
  const requestedAgents = Array.isArray(input.agents) ? input.agents : [];
  const maxIterations = Number.isFinite(input.maxIterations)
    ? Math.max(1, Math.min(5, Math.floor(input.maxIterations)))
    : DEFAULT_CONSENSUS_SETTINGS.maxIterations;

  return {
    goal,
    context,
    constraints,
    approvalMode,
    requestedAgents,
    maxIterations,
  };
}

export function makeAgentOutput(agent, draft = {}) {
  const scores = draft.scores && typeof draft.scores === 'object' ? draft.scores : {};

  return {
    schemaVersion: POS_SCHEMA_VERSION,
    id: createId('agent_output'),
    agentId: agent.id,
    agentType: agent.type,
    agentName: agent.name,
    iteration: Number.isFinite(draft.iteration) ? draft.iteration : 1,
    summary: normalizeString(draft.summary, `${agent.name} produced no summary.`),
    recommendations: normalizeStringArray(draft.recommendations),
    concerns: normalizeStringArray(draft.concerns),
    assumptions: normalizeStringArray(draft.assumptions),
    evidence: normalizeStringArray(draft.evidence),
    tasks: normalizeStringArray(draft.tasks),
    questions: normalizeStringArray(draft.questions),
    approvalsRequired: normalizeStringArray(draft.approvalsRequired),
    revisionNotes: normalizeStringArray(draft.revisionNotes),
    scores: {
      confidence: clampScore(scores.confidence),
      evidenceStrength: clampScore(scores.evidenceStrength),
      executionReadiness: clampScore(scores.executionReadiness),
      disagreementIndex: clampScore(scores.disagreementIndex),
      riskLevel: normalizeRiskLevel(scores.riskLevel),
    },
    createdAt: isoNow(),
  };
}

export function createRunRecord(input, agents) {
  return {
    schemaVersion: POS_SCHEMA_VERSION,
    id: createId('run'),
    goalId: createId('goal'),
    goal: input.goal,
    context: input.context,
    constraints: input.constraints,
    approvalMode: input.approvalMode,
    state: 'running',
    maxIterations: input.maxIterations,
    agents: agents.map((agent) => ({
      id: agent.id,
      type: agent.type,
      name: agent.name,
      weight: agent.weight,
    })),
    startedAt: isoNow(),
    completedAt: null,
  };
}

export function validateFinalPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Final plan must be an object.');
  }
  if (!plan.goalSummary) throw new Error('Final plan is missing goalSummary.');
  if (!Array.isArray(plan.tasks)) throw new Error('Final plan tasks must be an array.');
  if (!plan.consensus || typeof plan.consensus !== 'object') {
    throw new Error('Final plan is missing consensus metadata.');
  }
  return plan;
}
