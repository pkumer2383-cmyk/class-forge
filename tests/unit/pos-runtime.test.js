import assert from 'node:assert/strict';
import test from 'node:test';

import { getDefaultAgents } from '../../src/lib/pos/agents.js';
import {
  createClassForgeOperatingStatus,
  validateChiefOperatingStatus,
} from '../../src/lib/pos/chief-operating-agent.js';
import { isPosOwner, posOwnerEmails } from '../../src/lib/pos/access.js';
import { computeConsensusRound } from '../../src/lib/pos/consensus.js';
import { runPosOrchestration } from '../../src/lib/pos/orchestrator.js';
import { createPosPersistence, loadPosProjectMemory } from '../../src/lib/pos/persistence.js';
import { isRetryableError, withRetry } from '../../src/lib/pos/retry.js';
import { buildPosRunTelemetry } from '../../src/lib/pos/telemetry.js';
import { DEFAULT_CONSENSUS_SETTINGS } from '../../src/lib/pos/schemas.js';

function createTestPersistence() {
  const events = [];
  return {
    async createRun() {},
    async recordAgentOutput() {},
    async recordConsensusRound() {},
    async recordFinalPlan() {},
    async recordEvent(event) {
      events.push(event);
    },
    status() {
      return { mode: 'memory', durable: false, counts: { events: events.length } };
    },
  };
}

test('default POS agent roster includes required specialists', () => {
  const agents = getDefaultAgents();
  assert.equal(agents.length, 6);
  assert.deepEqual(
    agents.map((agent) => agent.id),
    ['project-manager', 'research', 'critic', 'risk', 'execution', 'knowledge'],
  );
});

test('consensus round produces bounded scores and disagreement hotspots', () => {
  const agents = getDefaultAgents();
  const outputs = agents.map((agent) =>
    agent.run({
      goal: 'Build a modular POS runtime.',
      context: 'Use audit trails and approval checkpoints.',
      constraints: [],
      approvalMode: 'checkpoint',
      maxIterations: 2,
      iteration: 1,
      priorConsensus: null,
      priorOutputs: [],
    }),
  );
  const round = computeConsensusRound({
    runId: 'run_test',
    roundNumber: 1,
    outputs,
    settings: DEFAULT_CONSENSUS_SETTINGS,
  });

  assert.ok(round.confidenceScore >= 0);
  assert.ok(round.confidenceScore <= 1);
  assert.ok(round.agreementScore >= 0);
  assert.ok(round.agreementScore <= 1);
  assert.ok(round.disagreementHotspots.length > 0);
});

test('orchestrator returns an execution plan and complete audit packet', async () => {
  const result = await runPosOrchestration(
    {
      goal: 'Build a modular POS that accepts a goal, delegates to agents, runs consensus, and returns a plan.',
      context: 'Local-first, vendor-agnostic, Postgres audit trail, human approval checkpoints.',
      maxIterations: 2,
    },
    { persistence: createTestPersistence() },
  );

  assert.equal(result.run.state, 'approval_required');
  assert.equal(result.consensusRounds.length, 2);
  assert.equal(result.agentOutputs.length, 12);
  assert.ok(result.finalPlan.tasks.length >= 4);
  assert.ok(result.finalPlan.agentRecommendations.length >= 6);
  assert.ok(result.finalPlan.approvalsRequired.length >= 1);
  assert.ok(result.auditEvents.some((event) => event.eventType === 'final_plan_recorded'));
  assert.equal(result.persistence.durable, false);
  assert.equal(result.telemetry.schemaVersion, 'pos-telemetry/v1');
  assert.ok(result.telemetry.eventTypes.includes('final_plan_recorded'));
});

test('retry helper recovers from transient errors and skips persistent ones', async () => {
  let tries = 0;
  const result = await withRetry(
    async () => {
      tries += 1;
      if (tries < 2) {
        const error = new Error('fetch failed');
        error.code = 'ECONNRESET';
        throw error;
      }
      return 'ok';
    },
    { attempts: 3, baseDelayMs: 0 },
  );

  assert.equal(result, 'ok');
  assert.equal(tries, 2);
  assert.equal(isRetryableError({ code: 'ETIMEDOUT', message: 'timeout' }), true);
  assert.equal(isRetryableError({ code: '42501', message: 'permission denied' }), false);
});

test('telemetry summarizes the run in a structured packet', () => {
  const telemetry = buildPosRunTelemetry({
    run: { id: 'run_1', goalId: 'goal_1', state: 'completed' },
    finalPlan: {
      tasks: [{ title: 'Ship' }, { title: 'Verify' }],
      approvalsRequired: ['Approve: Ship'],
      consensus: { confidenceScore: 0.9, agreementScore: 0.8 },
      auditSummary: { completedAt: '2026-06-06T00:00:10.000Z' },
    },
    auditEvents: [
      { eventType: 'run_started' },
      { eventType: 'final_plan_recorded' },
    ],
    consensusRounds: [{}, {}],
    persistence: { mode: 'supabase', durable: true, retryCount: 1 },
    retryCount: 1,
    startedAt: '2026-06-06T00:00:00.000Z',
  });

  assert.equal(telemetry.schemaVersion, 'pos-telemetry/v1');
  assert.equal(telemetry.durationMs, 10000);
  assert.equal(telemetry.iterationCount, 2);
  assert.equal(telemetry.taskCount, 2);
  assert.equal(telemetry.approvalCount, 1);
  assert.equal(telemetry.retryCount, 1);
});

test('POS persistence stays in memory in the open version', async () => {
  const persistence = await createPosPersistence();
  const status = persistence.status();

  assert.equal(status.mode, 'memory');
  assert.equal(status.durable, false);
  assert.match(status.reason, /open version/);
});

test('project memory falls back for guest users', async () => {
  const memory = await loadPosProjectMemory();

  assert.equal(memory.durable, false);
  assert.match(memory.reason, /open version/);
  assert.deepEqual(memory.recentRuns, []);
  assert.equal(memory.contextBlock, '');
});

test('POS owner access is denied to everyone when no owner is configured', () => {
  const original = process.env.POS_OWNER_EMAILS;
  delete process.env.POS_OWNER_EMAILS;
  try {
    assert.deepEqual(posOwnerEmails(), []);
    assert.equal(isPosOwner({ email: 'owner@example.com' }), false);
    assert.equal(isPosOwner({}), false);
  } finally {
    if (original === undefined) delete process.env.POS_OWNER_EMAILS;
    else process.env.POS_OWNER_EMAILS = original;
  }
});

test('POS owner access is limited to POS_OWNER_EMAILS, case-insensitive', () => {
  const original = process.env.POS_OWNER_EMAILS;
  process.env.POS_OWNER_EMAILS = ' Owner@Example.com , second@example.com';
  try {
    assert.deepEqual(posOwnerEmails(), ['owner@example.com', 'second@example.com']);
    assert.equal(isPosOwner({ email: 'owner@example.com' }), true);
    assert.equal(isPosOwner({ email: 'OWNER@EXAMPLE.COM' }), true);
    assert.equal(isPosOwner({ email: 'someone@example.com' }), false);
  } finally {
    if (original === undefined) delete process.env.POS_OWNER_EMAILS;
    else process.env.POS_OWNER_EMAILS = original;
  }
});

test('Chief Operating Agent status includes required ClassForge sections', () => {
  const status = validateChiefOperatingStatus(
    createClassForgeOperatingStatus({
      projectMemory: {
        durable: true,
        reason: 'Loaded durable project memory from prior POS runs.',
        recentRuns: [
          {
            goal: 'Ship the POS runtime MVP.',
            state: 'completed',
          },
        ],
        nextActions: ['Apply the Supabase POS migration.'],
        risks: ['Durable audit history depends on Supabase migration status.'],
        openQuestions: ['Which task manager should receive delegated work?'],
      },
      generatedAt: '2026-06-06T00:00:00.000Z',
    }),
  );

  assert.equal(status.schemaVersion, 'chief-operating-agent/v1');
  assert.ok(status.executiveSummary.includes('ClassForge'));
  assert.ok(status.activeProjects.some((project) => project.name.includes('Schedule Builder')));
  assert.ok(
    status.activeProjects.some(
      (project) =>
        project.name === 'ClassForge / Schedule Builder' &&
        project.ownerAgent === 'ClassForge Project Manager Agent' &&
        project.projectManagerAgent === 'ClassForge Project Manager Agent' &&
        project.specialistAgents.some((agent) => agent.ownerAgent === 'Execution Agent'),
    ),
  );
  assert.ok(status.decisionsNeeded.length >= 1);
  assert.ok(status.delegatedWork.some((work) => work.ownerAgent === 'ClassForge Project Manager Agent'));
  assert.equal(status.delegatedWork.some((work) => work.ownerAgent === 'Execution Agent'), false);
  assert.ok(status.risksBlockers.some((risk) => risk.includes('Supabase')));
  assert.ok(status.recommendedNextActions.length >= 3);
  assert.ok(status.codexReadyTasks.every((task) => task.prompt && task.targetRepo));
  assert.ok(status.obsidianNotesToUpdate.some((note) => note.path.includes('class-forge')));
  assert.ok(status.longTermMemoryUpdates.some((fact) => fact.includes('Chief Operating Agent')));
  assert.equal(status.projectMemory.durable, true);
  assert.ok(status.projectMemory.recentRuns[0].includes('Ship the POS runtime MVP'));
});
