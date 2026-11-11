import { AGENT_TYPES, makeAgentOutput, normalizeStringArray } from './schemas.js';

function splitGoal(goal) {
  return goal
    .replace(/\s+/g, ' ')
    .split(/[.;]\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function goalDomain(goal, context) {
  const text = `${goal} ${context}`.toLowerCase();
  if (text.includes('launch') || text.includes('mvp') || text.includes('product')) return 'product delivery';
  if (text.includes('revenue') || text.includes('sales') || text.includes('customer')) return 'go-to-market';
  if (text.includes('database') || text.includes('runtime') || text.includes('api')) return 'technical execution';
  return 'project execution';
}

function baseEvidence(input) {
  const evidence = ['User-supplied goal and context'];
  if (input.constraints.length) evidence.push('Explicit constraints supplied by operator');
  if (input.priorConsensus) evidence.push('Previous consensus round');
  return evidence;
}

function revisionNotes(input, agentName) {
  if (!input.priorConsensus) return [];
  return [
    `${agentName} revised its output against round ${input.priorConsensus.roundNumber} disagreements.`,
  ];
}

function makeSpecialistAgent(config, run) {
  return {
    ...config,
    run(input) {
      return makeAgentOutput(config, run(input));
    },
  };
}

export function getDefaultAgents() {
  return [
    makeSpecialistAgent(
      {
        id: 'project-manager',
        type: AGENT_TYPES.PROJECT_MANAGER,
        name: 'Project Manager',
        weight: 1.1,
      },
      (input) => {
        const slices = splitGoal(input.goal);
        return {
          iteration: input.iteration,
          summary: `Define the ${goalDomain(input.goal, input.context)} path, freeze MVP scope, and sequence the work into auditable milestones.`,
          recommendations: [
            'Treat this as a bounded MVP run with a single goal intake, specialist review, consensus, and final plan output.',
            'Use a small core agent set first, then make agent registration data-driven for dozens of agents.',
            'Make every run reconstructable from stored inputs, agent outputs, consensus rounds, and artifacts.',
          ],
          concerns: input.iteration === 1 ? ['Scope can sprawl if integrations are added before the runtime contract is stable.'] : [],
          assumptions: [
            slices[0] || 'The goal can be decomposed into implementation tasks.',
            'Human approval is required before external side effects or irreversible actions.',
          ],
          evidence: baseEvidence(input),
          tasks: [
            'Define run and agent message schemas.',
            'Build orchestrator and consensus loop.',
            'Persist audit trail records.',
            'Render final execution plan.',
          ],
          scores: {
            confidence: input.iteration > 1 ? 0.84 : 0.76,
            evidenceStrength: 0.68,
            executionReadiness: input.iteration > 1 ? 0.86 : 0.74,
            disagreementIndex: input.iteration > 1 ? 0.16 : 0.3,
            riskLevel: 'medium',
          },
          revisionNotes: revisionNotes(input, 'Project Manager'),
        };
      },
    ),
    makeSpecialistAgent(
      {
        id: 'research',
        type: AGENT_TYPES.RESEARCH,
        name: 'Research',
        weight: 0.95,
      },
      (input) => ({
        iteration: input.iteration,
        summary: 'Anchor the plan in existing project context and avoid inventing external facts.',
        recommendations: [
          'Use local architecture docs, roadmap docs, and current source files as the first knowledge source.',
          'Record evidence links or source names in every agent output.',
          'Keep provider-specific model calls behind adapters so the runtime remains vendor-agnostic.',
        ],
        concerns: input.context ? [] : ['No extra context was supplied beyond the goal.'],
        assumptions: ['The MVP can start with local project context before adding Drive, GitHub, and Obsidian retrieval.'],
        evidence: [...baseEvidence(input), 'POS architecture and implementation roadmap'],
        tasks: [
          'Attach source references to agent outputs.',
          'Add memory links for durable decisions and project docs.',
        ],
        scores: {
          confidence: input.iteration > 1 ? 0.8 : 0.72,
          evidenceStrength: input.context ? 0.74 : 0.58,
          executionReadiness: 0.68,
          disagreementIndex: input.iteration > 1 ? 0.18 : 0.32,
          riskLevel: 'medium',
        },
        revisionNotes: revisionNotes(input, 'Research'),
      }),
    ),
    makeSpecialistAgent(
      {
        id: 'critic',
        type: AGENT_TYPES.CRITIC,
        name: 'Critic',
        weight: 1,
      },
      (input) => ({
        iteration: input.iteration,
        summary: 'The main failure mode is producing convincing plans without enforcing bounded loops, auditability, or approval checkpoints.',
        recommendations: [
          'Reject any runtime path that cannot explain why consensus stopped.',
          'Keep consensus deterministic before adding stochastic provider calls.',
          'Expose unresolved questions in the final plan instead of smoothing them over.',
        ],
        concerns:
          input.iteration === 1
            ? [
                'Persistence may be skipped if local development lacks database tables.',
                'A single generic agent response would not prove modular delegation.',
              ]
            : ['Database migrations still need to be applied before the Postgres audit trail is durable.'],
        assumptions: ['The operator prefers a complete scaffold over a mock-only UI.'],
        evidence: baseEvidence(input),
        tasks: [
          'Add tests around consensus thresholds and final plan validity.',
          'Return persistence status so missing audit storage is visible.',
        ],
        scores: {
          confidence: input.iteration > 1 ? 0.82 : 0.7,
          evidenceStrength: 0.66,
          executionReadiness: input.iteration > 1 ? 0.76 : 0.62,
          disagreementIndex: input.iteration > 1 ? 0.24 : 0.46,
          riskLevel: input.iteration > 1 ? 'medium' : 'high',
        },
        approvalsRequired: input.approvalMode === 'manual' ? ['Operator approval before execution tasks are dispatched'] : [],
        revisionNotes: revisionNotes(input, 'Critic'),
      }),
    ),
    makeSpecialistAgent(
      {
        id: 'risk',
        type: AGENT_TYPES.RISK,
        name: 'Risk',
        weight: 1.05,
      },
      (input) => ({
        iteration: input.iteration,
        summary: 'Constrain operational, technical, and data risks before execution expands.',
        recommendations: [
          'Store raw agent outputs and consensus decisions separately from rendered artifacts.',
          'Require approval checkpoints for external writes, data deletion, spending, or irreversible automation.',
          'Use explicit run states so failed, blocked, approved, and completed runs can be audited later.',
        ],
        concerns: [
          'Supabase table and RLS setup must be verified before treating persistence as complete.',
          ...(input.maxIterations > 3 ? ['Large iteration caps can burn tokens and obscure decision ownership.'] : []),
        ],
        assumptions: ['MVP users are authenticated or operating in trusted local development.'],
        evidence: baseEvidence(input),
        tasks: [
          'Create audit tables for runs, messages, consensus rounds, and artifacts.',
          'Surface approvals required in final plan.',
        ],
        scores: {
          confidence: input.iteration > 1 ? 0.81 : 0.73,
          evidenceStrength: 0.7,
          executionReadiness: input.iteration > 1 ? 0.78 : 0.66,
          disagreementIndex: input.iteration > 1 ? 0.2 : 0.36,
          riskLevel: 'medium',
        },
        approvalsRequired: ['Human approval before executing external side effects'],
        revisionNotes: revisionNotes(input, 'Risk'),
      }),
    ),
    makeSpecialistAgent(
      {
        id: 'execution',
        type: AGENT_TYPES.EXECUTION,
        name: 'Execution',
        weight: 1.15,
      },
      (input) => ({
        iteration: input.iteration,
        summary: 'Convert consensus into a task plan that can be implemented and checked in sequence.',
        recommendations: [
          'Ship the runtime in thin modules: schemas, agents, consensus, orchestrator, persistence, and API.',
          'Make the API return the final plan and the full audit packet in one response.',
          'Add unit tests before expanding agent intelligence.',
        ],
        concerns: input.iteration === 1 ? ['UI must show confidence and audit state, not only prose output.'] : [],
        assumptions: ['The current Next.js app is the correct MVP host.'],
        evidence: baseEvidence(input),
        tasks: [
          'Build the POS runtime scaffold.',
          'Wire the route handler to orchestrator.',
          'Update Agent Lab output for final plan, consensus, and audit.',
          'Run lint, tests, and build.',
        ],
        scores: {
          confidence: input.iteration > 1 ? 0.88 : 0.8,
          evidenceStrength: 0.64,
          executionReadiness: input.iteration > 1 ? 0.9 : 0.82,
          disagreementIndex: input.iteration > 1 ? 0.12 : 0.24,
          riskLevel: 'low',
        },
        revisionNotes: revisionNotes(input, 'Execution'),
      }),
    ),
    makeSpecialistAgent(
      {
        id: 'knowledge',
        type: AGENT_TYPES.KNOWLEDGE,
        name: 'Knowledge',
        weight: 0.85,
      },
      (input) => ({
        iteration: input.iteration,
        summary: 'Preserve the durable decisions and link the run to reusable project knowledge.',
        recommendations: [
          'Separate working memory for active runs from long-term memory links.',
          'Store durable decisions as structured fields plus human-readable artifacts.',
          'Keep source URIs stable so later agents can recover context without replaying the whole chat.',
        ],
        concerns: [],
        assumptions: ['Architecture docs and roadmap are the current source of truth.'],
        evidence: [...baseEvidence(input), 'Local POS documentation files'],
        tasks: [
          'Create memory links for architecture and roadmap docs.',
          'Add final plan artifact metadata.',
        ],
        scores: {
          confidence: input.iteration > 1 ? 0.83 : 0.75,
          evidenceStrength: 0.76,
          executionReadiness: 0.7,
          disagreementIndex: input.iteration > 1 ? 0.14 : 0.28,
          riskLevel: 'low',
        },
        revisionNotes: revisionNotes(input, 'Knowledge'),
      }),
    ),
  ];
}

export function selectAgents(requestedAgents = []) {
  const defaults = getDefaultAgents();
  const requested = normalizeStringArray(requestedAgents);
  if (!requested.length) return defaults;
  const selected = defaults.filter(
    (agent) => requested.includes(agent.id) || requested.includes(agent.type),
  );
  return selected.length ? selected : defaults;
}
