import {
  clampScore,
  createId,
  isoNow,
  normalizeString,
  normalizeStringArray,
} from '../pos/schemas.js';

export const CVS_SCHEMA_VERSION = 'courtroom-validation/v1';

export const CVS_STAGE_ORDER = Object.freeze([
  'warden',
  'grand-jury',
  'prosecution',
  'analysts',
  'defense-counsel',
  'tribunal',
  'executioner',
]);

export const CVS_VERDICTS = Object.freeze(['EXECUTE', 'REVISE', 'ABANDON']);
export const CVS_STAGE_DECISIONS = Object.freeze(['ADMIT', 'DENY', 'PASS', 'FAIL', 'PROCEED', 'REVISE', 'REJECT']);

function toStringArray(value) {
  if (Array.isArray(value)) return normalizeStringArray(value);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function countWords(value) {
  return normalizeString(value).split(/\s+/).filter(Boolean).length;
}

function normalizeStageScore(value, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number < 0) return 0;
  if (number > 100) return 100;
  return Math.round(number);
}

export function normalizeCourtroomSubmission(input = {}) {
  const caseId = normalizeString(input.caseId || input.id, createId('cvs_case'));
  const title = normalizeString(input.title || input.ideaTitle || input.name || caseId, 'Untitled idea');
  const ideaSummary = normalizeString(
    input.ideaSummary || input.summary || input.idea || input.description,
    '',
  );
  const primaryGoal = normalizeString(
    input.primaryGoal || input.goal || input.objective,
    '',
  );
  const successMetrics = toStringArray(
    input.successMetrics || input.successMetric || input.successCriteria || input.successCriteriaText,
  );
  const knownConstraints = toStringArray(input.knownConstraints || input.constraints);
  const keyAssumptions = toStringArray(input.keyAssumptions || input.assumptions);
  const evidence = toStringArray(input.evidence || input.sources || input.references);
  const stakeholders = toStringArray(input.stakeholders);
  const risks = toStringArray(input.risks);

  return {
    schemaVersion: CVS_SCHEMA_VERSION,
    caseId,
    title,
    ideaSummary,
    primaryGoal,
    successMetrics,
    knownConstraints,
    keyAssumptions,
    evidence,
    stakeholders,
    risks,
    context: normalizeString(input.context),
    targetAudience: normalizeString(input.targetAudience || input.audience),
    timeline: normalizeString(input.timeline),
    budget: normalizeString(input.budget),
    userId: typeof input.userId === 'string' ? input.userId : null,
    submittedBy: normalizeString(input.submittedBy),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    submittedAt: isoNow(),
    rawInput: input,
  };
}

export function validateCourtroomSubmission(submission) {
  if (!submission || typeof submission !== 'object') {
    throw new Error('Courtroom submission must be an object.');
  }

  return submission;
}

export function createStageResult(stage, payload = {}) {
  return {
    schemaVersion: CVS_SCHEMA_VERSION,
    id: createId(`${stage}_stage`),
    stage,
    decision: CVS_STAGE_DECISIONS.includes(payload.decision) ? payload.decision : 'REVISE',
    score: normalizeStageScore(payload.score, 50),
    confidence: clampScore(payload.confidence, 0.5),
    findings: normalizeStringArray(payload.findings),
    strengths: normalizeStringArray(payload.strengths),
    weaknesses: normalizeStringArray(payload.weaknesses),
    missingInformation: normalizeStringArray(payload.missingInformation),
    keyRisks: normalizeStringArray(payload.keyRisks),
    recommendation: normalizeString(payload.recommendation, ''),
    payload,
    createdAt: isoNow(),
  };
}

export function createFinalVerdict(input = {}) {
  const verdict = CVS_VERDICTS.includes(input.verdict) ? input.verdict : 'REVISE';
  return {
    schemaVersion: CVS_SCHEMA_VERSION,
    id: createId('cvs_verdict'),
    verdict,
    confidenceScore: clampScore(input.confidenceScore, 0.5),
    primaryReason: normalizeString(input.primaryReason, ''),
    requiredNextActions: normalizeStringArray(input.requiredNextActions),
    revisionsRequired: normalizeStringArray(input.revisionsRequired),
    implementationRoadmap: Array.isArray(input.implementationRoadmap)
      ? input.implementationRoadmap.map((item) => ({
          title: normalizeString(item?.title, ''),
          detail: normalizeString(item?.detail, ''),
        })).filter((item) => item.title || item.detail)
      : [],
    payload: input,
    createdAt: isoNow(),
  };
}

export function wordCount(value) {
  return countWords(value);
}
