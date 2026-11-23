import { isoNow, normalizeStringArray } from './schemas.js';

export const COA_STATUS_VERSION = 'chief-operating-agent/v1';

export const CLASS_FORGE_PROJECT = Object.freeze({
  id: 'class-forge',
  name: 'ClassForge / Schedule Builder',
  category: 'venture',
  status: 'active',
  priority: 'high',
  currentPhase: 'Phase 2 - ClassForge Launch',
  ownerAgent: 'ClassForge Project Manager Agent',
  projectManagerAgent: 'ClassForge Project Manager Agent',
  repoPath: 'Projects/schedule-builder',
});

const DEFAULT_PROJECT_SPECIALIST_AGENTS = Object.freeze([
  {
    ownerAgent: 'Execution Agent',
    responsibility: 'Produce Codex-ready implementation tasks, acceptance criteria, and verification steps.',
    activationRule: 'Use when code, docs, migrations, or concrete implementation work is needed.',
  },
  {
    ownerAgent: 'Risk Agent',
    responsibility: 'Review security, RLS, owner gating, external writes, secrets, and approval checkpoints.',
    activationRule: 'Use when the project touches sensitive data, auth, payments, permissions, or external systems.',
  },
  {
    ownerAgent: 'Knowledge Agent',
    responsibility: 'Update Obsidian, project memory, source links, durable decisions, and handoff notes.',
    activationRule: 'Use when project state, decisions, or reusable knowledge should persist.',
  },
  {
    ownerAgent: 'Critic Agent',
    responsibility: 'Challenge scope creep, weak assumptions, missing tests, and unclear product tradeoffs.',
    activationRule: 'Use before broad integrations, launch decisions, or irreversible architecture choices.',
  },
  {
    ownerAgent: 'Research Agent',
    responsibility: 'Inspect external repos, docs, market references, and compatibility evidence.',
    activationRule: 'Use when the project depends on unfamiliar tools, libraries, competitors, or external claims.',
  },
]);

const CLASS_FORGE_LINKS = Object.freeze([
  {
    sourceType: 'repo',
    title: 'Schedule Builder repo',
    uri: 'Projects/schedule-builder',
    summary: 'Next.js app and POS runtime host.',
  },
  {
    sourceType: 'obsidian',
    title: 'ClassForge project note',
    uri: 'obsidian-vault/01-PROJECTS/class-forge/README.md',
    summary: 'Human-readable project identity and status note.',
  },
  {
    sourceType: 'local-doc',
    title: 'POS Runtime MVP',
    uri: 'Projects/schedule-builder/docs/POS-runtime-mvp.md',
    summary: 'Implemented POS runtime scaffold and persistence decision.',
  },
  {
    sourceType: 'local-doc',
    title: 'POS Implementation Roadmap',
    uri: 'Projects/schedule-builder/docs/POS-implementation-roadmap.md',
    summary: 'Milestones for runtime, persistence, memory, and delivery.',
  },
  {
    sourceType: 'local-doc',
    title: 'Chief Operating Agent MVP',
    uri: 'Projects/schedule-builder/docs/chief-operating-agent-mvp.md',
    summary: 'Pilot architecture, status model, and implementation plan.',
  },
]);

function recentRunSummaries(projectMemory) {
  if (!projectMemory || !Array.isArray(projectMemory.recentRuns)) return [];
  return projectMemory.recentRuns
    .slice(0, 3)
    .map((run) => `${run.goal} (${run.state || 'unknown'})`);
}

function memoryItems(projectMemory, key) {
  return normalizeStringArray(projectMemory?.[key]);
}

function makeCodexTask({ title, prompt, verification, approvalRequired = 'No' }) {
  return {
    title,
    targetRepo: CLASS_FORGE_PROJECT.repoPath,
    prompt,
    expectedOutput: 'Implemented code, tests, and a concise completion summary.',
    verification,
    approvalRequired,
  };
}

export function createClassForgeOperatingStatus({ projectMemory, generatedAt = isoNow() } = {}) {
  const recentRuns = recentRunSummaries(projectMemory);
  const memoryNextActions = memoryItems(projectMemory, 'nextActions');
  const memoryRisks = memoryItems(projectMemory, 'risks');
  const openQuestions = memoryItems(projectMemory, 'openQuestions');

  const blocker = projectMemory?.durable
    ? 'No blocking memory issue detected; next durable step is COA status persistence.'
    : 'Durable project memory is not available in the open version.';

  const activeProjects = [
    {
      name: CLASS_FORGE_PROJECT.name,
      status: CLASS_FORGE_PROJECT.status,
      priority: CLASS_FORGE_PROJECT.priority,
      currentPhase: CLASS_FORGE_PROJECT.currentPhase,
      nextAction: 'Implement deterministic Chief Operating Agent status generation and expose it through an owner-gated API.',
      blocker,
      ownerAgent: CLASS_FORGE_PROJECT.ownerAgent,
      projectManagerAgent: CLASS_FORGE_PROJECT.projectManagerAgent,
      specialistAgents: DEFAULT_PROJECT_SPECIALIST_AGENTS,
      links: CLASS_FORGE_LINKS,
    },
    {
      name: 'Personal Operating System',
      status: 'active',
      priority: 'high',
      currentPhase: 'Phase 1 - AI Workbench',
      nextAction: 'Use the Chief Operating Agent as the default front door for project status, delegation, and memory updates.',
      blocker: 'Needs the ClassForge pilot to prove the status loop.',
      ownerAgent: 'POS Project Manager Agent',
      projectManagerAgent: 'POS Project Manager Agent',
      specialistAgents: DEFAULT_PROJECT_SPECIALIST_AGENTS,
      links: [
        {
          sourceType: 'obsidian',
          title: 'POS Chief Operating Agent',
          uri: 'obsidian-vault/04-REFERENCE/pos/pos-chief-of-staff.md',
          summary: 'Operating role and routing loop.',
        },
      ],
    },
  ];

  const decisionsNeeded = [
    {
      decision: 'Should Chief Operating Agent persistence use separate coa_* tables or extend existing pos_* tables?',
      recommendation: 'Use separate coa_* tables after the deterministic status API is stable.',
      approvalRequired: true,
    },
    {
      decision: 'Should Calendar and task manager integrations write real external records during MVP?',
      recommendation: 'No. Emit suggested calendar/task actions first; add write integrations after approval.',
      approvalRequired: true,
    },
    ...openQuestions.map((question) => ({
      decision: question,
      recommendation: 'Resolve during the next Chief Operating Agent review.',
      approvalRequired: true,
    })),
  ].slice(0, 6);

  const delegatedWork = [
    {
      ownerAgent: 'Project Manager Agent',
      assignment: 'Maintain the per-project manager standard: each active project has one project manager agent that reports to the Chief Operating Agent and coordinates applicable specialist agents underneath it.',
      status: 'ready',
    },
    {
      ownerAgent: CLASS_FORGE_PROJECT.projectManagerAgent,
      assignment: 'Govern ClassForge / Schedule Builder day to day: phase, scope, priority, next action, blockers, weekly status, and specialist-agent delegation.',
      status: 'ready',
      specialistAgents: DEFAULT_PROJECT_SPECIALIST_AGENTS,
    },
    {
      ownerAgent: 'POS Project Manager Agent',
      assignment: 'Govern Personal Operating System implementation work and coordinate applicable specialist agents underneath the project manager layer.',
      status: 'ready',
      specialistAgents: DEFAULT_PROJECT_SPECIALIST_AGENTS,
    },
  ];

  const risksBlockers = [
    blocker,
    'Project-local .agents and .codex skill folders are constrained by workspace or OneDrive permissions; user-level Codex skills are active instead.',
    'Full CodeGraph, Understand Anything, ECC, and MoneyPrinterTurbo activation should remain gated until a specific task justifies setup.',
    ...memoryRisks,
  ].slice(0, 8);

  const recommendedNextActions = [
    {
      rank: 1,
      action: 'Have each active project manager produce a status packet for Chief Operating Agent consolidation.',
      leverage: 'Keeps project-level governance separate from portfolio-level synthesis.',
    },
    {
      rank: 2,
      action: 'Persist Chief Operating Agent status snapshots and delegated work after the API contract is approved.',
      leverage: 'Turns status updates into durable project memory.',
    },
    {
      rank: 3,
      action: 'Add suggested Calendar and task-manager actions without external writes until Patrick approves the integration behavior.',
      leverage: 'Moves from status visibility to operational follow-through while preserving approval gates.',
    },
    ...memoryNextActions.slice(0, 3).map((action, index) => ({
      rank: index + 4,
      action,
      leverage: 'Pulled from prior durable POS project memory.',
    })),
  ].slice(0, 6);

  const codexReadyTasks = [
    makeCodexTask({
      title: 'Add Chief Operating Agent Status Model',
      prompt:
        'In Projects/schedule-builder, implement and test a deterministic Chief Operating Agent status model that returns executiveSummary, activeProjects, decisionsNeeded, delegatedWork, risksBlockers, recommendedNextActions, codexReadyTasks, obsidianNotesToUpdate, and longTermMemoryUpdates.',
      verification: 'Run npm test and confirm the status contract test passes.',
    }),
    makeCodexTask({
      title: 'Add Owner-Gated POS Status API',
      prompt:
        'In Projects/schedule-builder, add GET /api/pos/status using requirePosOwnerUser, loadPosProjectMemory, and the Chief Operating Agent status generator. Return projectMemory with the status payload.',
      verification: 'Confirm unauthenticated users are rejected by the existing owner gate and unit tests still pass.',
    }),
    makeCodexTask({
      title: 'Add COA Persistence Migration',
      prompt:
        'Create a database migration for Chief Operating Agent persistence tables after the API payload is approved: coa_projects, coa_project_links, coa_status_updates, coa_work_items, coa_delegations, coa_decisions, coa_codex_tasks, and coa_memory_updates.',
      verification: 'Review RLS policies against the existing POS owner-scoped pattern.',
      approvalRequired: 'Yes - requires approving the separate coa_* table design.',
    }),
  ];

  const obsidianNotesToUpdate = [
    {
      path: 'obsidian-vault/04-REFERENCE/pos/pos-chief-of-staff.md',
      update: 'Keep Chief Operating Agent responsibilities and routing policy current.',
    },
    {
      path: 'obsidian-vault/04-REFERENCE/pos/chief-operating-agent-mvp.md',
      update: 'Record the MVP architecture, ClassForge pilot state, and implementation plan.',
    },
    {
      path: 'obsidian-vault/01-PROJECTS/class-forge/README.md',
      update: 'Add the Chief Operating Agent pilot status and next action.',
    },
    {
      path: 'obsidian-vault/03-DECISIONS/0008-ai-agent-repo-capability-layer.md',
      update: 'Record that the Chief Operating Agent is the default operating layer.',
    },
  ];

  const longTermMemoryUpdates = [
    'The default AI interface for Forge is now the Chief Operating Agent / AI Chief of Staff.',
    'ClassForge / Schedule Builder is the pilot implementation for the Chief Operating Agent.',
    'Every active project should have a project manager agent; the Chief Operating Agent communicates with project managers rather than directly managing all specialist agents.',
    'Project manager agents coordinate applicable specialist agents underneath them, including execution, risk, knowledge, critic, and research agents.',
    'The Chief Operating Agent should produce unified status dashboards, not just task plans.',
    'Gated repos should be activated only when a specific task justifies setup and approvals.',
    'Existing Schedule Builder POS runtime should be extended rather than replaced.',
    ...recentRuns.map((run) => `Prior POS run loaded into status context: ${run}`),
  ].slice(0, 10);

  return {
    schemaVersion: COA_STATUS_VERSION,
    generatedAt,
    executiveSummary:
      'ClassForge / Schedule Builder is ready to become the pilot for the Chief Operating Agent. The repo already has a POS runtime scaffold, so the immediate goal is a reliable status dashboard contract with owner-gated API access, Codex-ready tasks, Obsidian update guidance, and durable memory hooks.',
    activeProjects,
    decisionsNeeded,
    delegatedWork,
    risksBlockers,
    recommendedNextActions,
    codexReadyTasks,
    obsidianNotesToUpdate,
    longTermMemoryUpdates,
    sourceRefs: CLASS_FORGE_LINKS,
    projectMemory: {
      durable: Boolean(projectMemory?.durable),
      reason: projectMemory?.reason || 'No durable project memory loaded.',
      recentRuns,
    },
  };
}

export function validateChiefOperatingStatus(status) {
  const requiredArrays = [
    'activeProjects',
    'decisionsNeeded',
    'delegatedWork',
    'risksBlockers',
    'recommendedNextActions',
    'codexReadyTasks',
    'obsidianNotesToUpdate',
    'longTermMemoryUpdates',
  ];

  if (!status || typeof status !== 'object') throw new Error('Chief Operating Agent status must be an object.');
  if (!status.executiveSummary) throw new Error('Chief Operating Agent status is missing executiveSummary.');
  for (const key of requiredArrays) {
    if (!Array.isArray(status[key])) throw new Error(`Chief Operating Agent status ${key} must be an array.`);
  }
  return status;
}
