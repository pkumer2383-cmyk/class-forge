import { posPersistenceFallbackReason } from '../pos/persistence-errors.js';
import { normalizeCourtroomSubmission } from './schemas.js';

function serialize(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryCourtroomPersistence(reason = 'Supabase is not configured.') {
  const submissions = [];
  const stageResults = [];
  const verdicts = [];
  const events = [];

  return {
    async createSubmission(submission) {
      submissions.push(serialize(submission));
    },
    async recordStageResult(submission, stageResult) {
      stageResults.push({ submissionId: submission.caseId, stageResult: serialize(stageResult) });
    },
    async recordFinalVerdict(submission, verdict) {
      verdicts.push({ submissionId: submission.caseId, verdict: serialize(verdict) });
    },
    async recordEvent(event) {
      events.push(serialize(event));
    },
    status() {
      return {
        mode: 'memory',
        durable: false,
        reason,
        counts: {
          submissions: submissions.length,
          stageResults: stageResults.length,
          verdicts: verdicts.length,
          events: events.length,
        },
      };
    },
  };
}

export async function createCourtroomPersistence({ userId } = {}) {
  if (!userId) {
    return createMemoryCourtroomPersistence('No authenticated user supplied; court results remain in memory.');
  }

  let supabase;
  try {
    const { createClient } = await import('../supabase/server.js');
    supabase = await createClient();
  } catch (error) {
    return createMemoryCourtroomPersistence(error.message);
  }

  let durable = true;
  let fallbackReason = '';

  async function insert(table, payload) {
    if (!durable) return;
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      durable = false;
      fallbackReason = posPersistenceFallbackReason(error, table);
    }
  }

  return {
    async createSubmission(submission) {
      const normalized = normalizeCourtroomSubmission(submission);
      await insert('cvs_idea_submissions', {
        id: normalized.caseId,
        user_id: userId,
        title: normalized.title,
        idea_summary: normalized.ideaSummary,
        primary_goal: normalized.primaryGoal,
        success_metrics: normalized.successMetrics,
        known_constraints: normalized.knownConstraints,
        key_assumptions: normalized.keyAssumptions,
        evidence: normalized.evidence,
        stakeholders: normalized.stakeholders,
        risks: normalized.risks,
        context: normalized.context,
        target_audience: normalized.targetAudience,
        timeline: normalized.timeline,
        budget: normalized.budget,
        submitted_by: normalized.submittedBy,
        metadata: normalized.metadata,
        submitted_at: normalized.submittedAt,
      });
    },
    async recordStageResult(submission, stageResult) {
      await insert('cvs_stage_results', {
        id: stageResult.id,
        submission_id: submission.caseId,
        user_id: userId,
        stage_name: stageResult.stage,
        decision: stageResult.decision,
        score: stageResult.score,
        confidence: stageResult.confidence,
        payload: stageResult,
        created_at: stageResult.createdAt,
      });
    },
    async recordFinalVerdict(submission, verdict) {
      await insert('cvs_final_verdicts', {
        id: verdict.id,
        submission_id: submission.caseId,
        user_id: userId,
        verdict: verdict.verdict,
        confidence_score: verdict.confidenceScore,
        primary_reason: verdict.primaryReason,
        required_next_actions: verdict.requiredNextActions,
        revisions_required: verdict.revisionsRequired,
        implementation_roadmap: verdict.implementationRoadmap,
        payload: verdict,
        created_at: verdict.createdAt,
      });
    },
    async recordEvent(event) {
      await insert('cvs_audit_history', {
        submission_id: event.submissionId,
        user_id: userId,
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
      };
    },
  };
}

export function createGuestCourtroomHistory(reason = 'Sign in to load durable courtroom history.') {
  return {
    durable: false,
    reason,
    recentSubmissions: [],
    recentVerdicts: [],
    stageSummaries: [],
    contextBlock: '',
  };
}

export async function loadCourtroomHistory({ userId, limit = 5 } = {}) {
  if (!userId) return createGuestCourtroomHistory();

  let supabase;
  try {
    const { createClient } = await import('../supabase/server.js');
    supabase = await createClient();
  } catch (error) {
    return createGuestCourtroomHistory(error.message);
  }

  const [submissionsResult, verdictsResult, stagesResult] = await Promise.all([
    supabase
      .from('cvs_idea_submissions')
      .select('id, title, idea_summary, primary_goal, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(limit),
    supabase
      .from('cvs_final_verdicts')
      .select('submission_id, verdict, confidence_score, primary_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('cvs_stage_results')
      .select('submission_id, stage_name, decision, score, created_at')
      .order('created_at', { ascending: false })
      .limit(limit * 3),
  ]);

  const error = submissionsResult.error || verdictsResult.error || stagesResult.error;
  if (error) {
    return createGuestCourtroomHistory(posPersistenceFallbackReason(error, error.table || 'cvs_idea_submissions'));
  }

  const recentSubmissions = (submissionsResult.data || []).map((item) => ({
    id: item.id,
    title: item.title,
    ideaSummary: item.idea_summary,
    primaryGoal: item.primary_goal,
    submittedAt: item.submitted_at,
  }));

  const recentVerdicts = (verdictsResult.data || []).map((item) => ({
    submissionId: item.submission_id,
    verdict: item.verdict,
    confidenceScore: item.confidence_score,
    primaryReason: item.primary_reason,
    createdAt: item.created_at,
  }));

  const stageSummaries = (stagesResult.data || []).map((item) => ({
    submissionId: item.submission_id,
    stageName: item.stage_name,
    decision: item.decision,
    score: item.score,
    createdAt: item.created_at,
  }));

  return {
    durable: true,
    reason: recentSubmissions.length ? 'Loaded durable courtroom history.' : 'No courtroom records yet.',
    recentSubmissions,
    recentVerdicts,
    stageSummaries,
    contextBlock: buildCourtroomContext({
      recentSubmissions,
      recentVerdicts,
      stageSummaries,
    }),
  };
}

function buildCourtroomContext(memory) {
  const lines = [];
  if (memory.recentSubmissions.length) {
    lines.push('Recent courtroom submissions:');
    for (const submission of memory.recentSubmissions) {
      lines.push(`- ${submission.title}: ${submission.primaryGoal}`);
    }
  }
  if (memory.recentVerdicts.length) {
    lines.push('Recent verdicts:');
    for (const verdict of memory.recentVerdicts) {
      lines.push(`- ${verdict.verdict} (${verdict.primaryReason})`);
    }
  }
  if (memory.stageSummaries.length) {
    lines.push('Recent stage outcomes:');
    for (const stage of memory.stageSummaries.slice(0, 8)) {
      lines.push(`- ${stage.stageName}: ${stage.decision} (${stage.score})`);
    }
  }
  return lines.join('\n');
}
