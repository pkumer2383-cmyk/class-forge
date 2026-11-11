function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildPosRunTelemetry({
  run,
  finalPlan,
  auditEvents = [],
  consensusRounds = [],
  persistence,
  retryCount = 0,
  startedAt = null,
} = {}) {
  const eventTypes = unique(auditEvents.map((event) => event.eventType));
  const startedMs = startedAt ? Date.parse(startedAt) : NaN;
  const completedMs = finalPlan?.auditSummary?.completedAt ? Date.parse(finalPlan.auditSummary.completedAt) : NaN;
  const durationMs =
    Number.isFinite(startedMs) && Number.isFinite(completedMs)
      ? Math.max(0, completedMs - startedMs)
      : null;

  return {
    schemaVersion: 'pos-telemetry/v1',
    runId: run?.id || null,
    goalId: run?.goalId || null,
    state: run?.state || null,
    durationMs,
    iterationCount: consensusRounds.length,
    eventCount: auditEvents.length,
    eventTypes,
    taskCount: Array.isArray(finalPlan?.tasks) ? finalPlan.tasks.length : 0,
    approvalCount: Array.isArray(finalPlan?.approvalsRequired) ? finalPlan.approvalsRequired.length : 0,
    confidenceScore: finalPlan?.consensus?.confidenceScore ?? null,
    agreementScore: finalPlan?.consensus?.agreementScore ?? null,
    persistence: persistence || null,
    retryCount,
  };
}

