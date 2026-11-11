import { clampScore, isoNow } from './schemas.js';

const RISK_PENALTIES = {
  low: 0,
  medium: 0.06,
  high: 0.14,
};

function average(values, fallback = 0) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function weightedAverage(outputs, selector, fallback = 0.5) {
  const weighted = outputs
    .map((output) => {
      const weight = Number(output.weight || output.agentWeight || 1);
      const value = selector(output);
      return Number.isFinite(value) ? { value, weight } : null;
    })
    .filter(Boolean);

  const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (!weightTotal) return fallback;
  return weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / weightTotal;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export function computeConsensusRound({
  runId,
  roundNumber,
  outputs,
  settings,
}) {
  const enriched = outputs.map((output) => ({
    ...output,
    agentWeight: Number(output.agentWeight || output.weight || 1),
  }));
  const confidence = weightedAverage(enriched, (output) => output.scores.confidence);
  const evidenceStrength = weightedAverage(enriched, (output) => output.scores.evidenceStrength);
  const executionReadiness = weightedAverage(enriched, (output) => output.scores.executionReadiness);
  const disagreementIndex = weightedAverage(enriched, (output) => output.scores.disagreementIndex);
  const agreementScore = clampScore(1 - disagreementIndex);
  const riskPenalty = average(
    enriched.map((output) => RISK_PENALTIES[output.scores.riskLevel] ?? RISK_PENALTIES.medium),
  );
  const confidenceScore = clampScore(confidence * 0.48 + evidenceStrength * 0.18 + executionReadiness * 0.24 + agreementScore * 0.1 - riskPenalty);

  const concerns = unique(enriched.flatMap((output) => output.concerns || []));
  const questions = unique(enriched.flatMap((output) => output.questions || []));
  const approvalsRequired = unique(enriched.flatMap((output) => output.approvalsRequired || []));
  const highRiskAgents = enriched
    .filter((output) => output.scores.riskLevel === 'high')
    .map((output) => output.agentName);

  const disagreementHotspots = [
    ...concerns.slice(0, 6),
    ...questions.slice(0, 3).map((question) => `Open question: ${question}`),
    ...highRiskAgents.map((agentName) => `High risk signal from ${agentName}`),
  ];

  const revisionRequired =
    confidenceScore < settings.confidenceThreshold ||
    agreementScore < settings.agreementThreshold ||
    highRiskAgents.length > 0;

  return {
    id: `${runId}_round_${roundNumber}`,
    runId,
    roundNumber,
    status: revisionRequired ? 'revision_required' : 'aligned',
    confidenceScore,
    agreementScore,
    evidenceStrength: clampScore(evidenceStrength),
    executionReadiness: clampScore(executionReadiness),
    riskPenalty: clampScore(riskPenalty),
    disagreementIndex: clampScore(disagreementIndex),
    disagreementHotspots,
    approvalsRequired,
    createdAt: isoNow(),
  };
}

export function shouldContinueConsensus({ round, iteration, settings }) {
  if (iteration >= settings.maxIterations) return false;
  if (settings.requireRevisionRound && iteration < 2) return true;
  return round.status === 'revision_required';
}
