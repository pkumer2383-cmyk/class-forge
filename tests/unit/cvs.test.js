import assert from 'node:assert/strict';
import test from 'node:test';

import { GET as getCourtroomHistory, POST as postCourtroomValidation } from '../../src/app/api/cvs/route.js';
import { createCentralOperatingAgent } from '../../src/lib/coa/index.js';
import { runCourtroomValidation } from '../../src/lib/cvs/service.js';
import {
  createCourtroomPersistence,
  createMemoryCourtroomPersistence,
  loadCourtroomHistory,
} from '../../src/lib/cvs/persistence.js';
import { normalizeCourtroomSubmission, validateCourtroomSubmission } from '../../src/lib/cvs/schemas.js';

function makeSubmission(overrides = {}) {
  return {
    title: 'Central Operating Agent',
    primaryGoal: 'Build a reusable service that routes ideas through Planning, Knowledge, Execution, Monitoring, and a Courtroom Validation System.',
    ideaSummary:
      'A reusable service for the broader agent ecosystem with deterministic validation stages and structured verdicts.',
    successMetrics: ['Produces EXECUTE, REVISE, or ABANDON verdicts', 'Persists results when signed in'],
    knownConstraints: ['Use the existing Next.js and Supabase stack', 'Do not hardcode secrets'],
    keyAssumptions: ['The current app can host the service'],
    evidence: ['Existing POS runtime and Supabase auth already exist'],
    targetAudience: 'Forge internal operators',
    timeline: 'Immediate',
    budget: 'Low',
    ...overrides,
  };
}

test('normalizes courtroom submissions and validates required fields', () => {
  const normalized = normalizeCourtroomSubmission(makeSubmission());
  assert.equal(normalized.schemaVersion, 'courtroom-validation/v1');
  assert.equal(normalized.title, 'Central Operating Agent');
  assert.ok(normalized.successMetrics.length >= 2);
  assert.doesNotThrow(() => validateCourtroomSubmission(normalized));
});

test('warden, jury, prosecution, analysts, defense, tribunal, and executioner all produce structured outputs', async () => {
  const result = await runCourtroomValidation(makeSubmission(), {
    persistence: createMemoryCourtroomPersistence(),
  });

  assert.equal(result.warden.decision, 'ADMIT');
  assert.ok(result.grandJury);
  assert.ok(result.prosecution);
  assert.ok(result.analysts);
  assert.ok(result.defenseCounsel);
  assert.ok(result.tribunal);
  assert.ok(['EXECUTE', 'REVISE', 'ABANDON'].includes(result.executioner.verdict));
  assert.ok(Array.isArray(result.stageResults));
  assert.equal(result.stageResults.length >= 1, true);
});

test('executioner yields ABANDON when the warden denies intake', async () => {
  const result = await runCourtroomValidation(
    makeSubmission({
      ideaSummary: '',
      successMetrics: [],
    }),
    { persistence: createMemoryCourtroomPersistence() },
  );

  assert.equal(result.warden.decision, 'DENY');
  assert.equal(result.verdict, 'ABANDON');
  assert.equal(result.grandJury, null);
  assert.ok(result.skippedStages.includes('grand-jury'));
});

test('persistence falls back cleanly when no authenticated user is present', async () => {
  const persistence = await createCourtroomPersistence();
  const status = persistence.status();

  assert.equal(status.mode, 'memory');
  assert.equal(status.durable, false);
});

test('guest courtroom history returns an empty memory snapshot', async () => {
  const history = await loadCourtroomHistory();

  assert.equal(history.durable, false);
  assert.deepEqual(history.recentSubmissions, []);
  assert.deepEqual(history.recentVerdicts, []);
});

test('central operating agent facade exposes the courtroom validation system', async () => {
  const coa = createCentralOperatingAgent();
  const result = await coa.validateIdea(makeSubmission(), { persistence: createMemoryCourtroomPersistence() });

  assert.equal(coa.name, 'Central Operating Agent');
  assert.ok(coa.divisions.courtroomValidationSystem);
  assert.equal(result.executioner.verdict, result.verdict);
});

test('API route validates ideas and returns courtroom history', async () => {
  const postResponse = await postCourtroomValidation(
    new Request('http://localhost/api/cvs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeSubmission()),
    }),
  );
  const postBody = await postResponse.json();

  assert.equal(postResponse.status, 200);
  assert.ok(postBody.result);
  assert.ok(['EXECUTE', 'REVISE', 'ABANDON'].includes(postBody.result.verdict));

  const getResponse = await getCourtroomHistory();
  const getBody = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.ok(getBody.history);
});
