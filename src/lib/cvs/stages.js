import { clampScore, normalizeString, normalizeStringArray } from '../pos/schemas.js';
import { createFinalVerdict, createStageResult, normalizeCourtroomSubmission, wordCount } from './schemas.js';

function scoreFromParts(parts) {
  const total = parts.reduce((sum, part) => sum + Number(part || 0), 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

function caseComplexity(submission) {
  return (
    submission.successMetrics.length +
    submission.knownConstraints.length +
    submission.keyAssumptions.length +
    submission.evidence.length +
    submission.stakeholders.length +
    submission.risks.length
  );
}

function contradictionSignals(submission) {
  const text = `${submission.ideaSummary} ${submission.primaryGoal} ${submission.context}`.toLowerCase();
  const constraintText = submission.knownConstraints.join(' ').toLowerCase();
  const signals = [];

  if (text.includes('instant') && constraintText.includes('manual')) {
    signals.push('The idea asks for instant results while also requiring manual review.');
  }
  if (text.includes('fully automated') && constraintText.includes('approval')) {
    signals.push('The idea promises full automation but also requires approval checkpoints.');
  }
  if (text.includes('free') && submission.budget && /low|limited|none/i.test(submission.budget)) {
    signals.push('The idea implies low cost, but the budget constraint still needs calibration.');
  }

  return signals;
}

function inferClarificationQuestions(submission) {
  const questions = [];
  if (!submission.targetAudience) questions.push('Who is the idea for, and who is the first buyer or user?');
  if (!submission.timeline) questions.push('What deadline or decision window should the court assume?');
  if (!submission.budget) questions.push('What budget or resource ceiling should be assumed?');
  if (!submission.evidence.length) questions.push('What evidence shows the idea already has pull or feasibility?');
  if (!submission.stakeholders.length) questions.push('Who owns the implementation and final decision?');
  return questions;
}

export function runWardenStage(rawSubmission) {
  const submission = normalizeCourtroomSubmission(rawSubmission);
  const missingInformation = [];

  if (!wordCount(submission.ideaSummary)) missingInformation.push('idea summary');
  if (!wordCount(submission.primaryGoal)) missingInformation.push('primary goal');
  if (!submission.successMetrics.length) missingInformation.push('success metric');

  const admitted = missingInformation.length === 0;
  const findings = admitted
    ? [
        'The submission has a defined objective, success metric, and enough structure to enter trial.',
        `The case contains ${submission.knownConstraints.length} stated constraints and ${submission.keyAssumptions.length} explicit assumptions.`,
      ]
    : [
        'The submission fails the intake floor required for trial.',
        `Missing fields: ${missingInformation.join(', ')}.`,
      ];

  return createStageResult('warden', {
    decision: admitted ? 'ADMIT' : 'DENY',
    score: admitted ? 92 : 24,
    confidence: admitted ? 0.94 : 0.89,
    findings,
    strengths: admitted ? ['Clear objective framing', 'Clear success criterion'] : [],
    weaknesses: admitted ? [] : ['Insufficient intake information'],
    missingInformation,
    keyRisks: admitted ? contradictionSignals(submission) : ['The court cannot meaningfully evaluate an under-specified idea.'],
    recommendation: admitted ? 'Proceed to grand jury review.' : 'Return the submission with the missing required fields.',
    caseId: submission.caseId,
    title: submission.title,
    ideaSummary: submission.ideaSummary,
    primaryGoal: submission.primaryGoal,
    successMetrics: submission.successMetrics,
    knownConstraints: submission.knownConstraints,
    keyAssumptions: submission.keyAssumptions,
    questions: inferClarificationQuestions(submission),
  });
}

export function runGrandJuryStage(rawSubmission) {
  const submission = normalizeCourtroomSubmission(rawSubmission);
  const signals = contradictionSignals(submission);
  const complexity = caseComplexity(submission);

  const logicScore = scoreFromParts([
    84,
    submission.primaryGoal && submission.ideaSummary ? 8 : -28,
    submission.successMetrics.length ? 6 : -20,
    signals.length ? -12 : 4,
  ]);

  const feasibilityScore = scoreFromParts([
    82,
    submission.timeline ? 4 : -6,
    submission.budget ? 4 : -6,
    submission.stakeholders.length ? 4 : -4,
    complexity > 10 ? -12 : complexity > 6 ? -6 : 0,
  ]);

  const completenessScore = scoreFromParts([
    78,
    submission.knownConstraints.length ? 6 : -10,
    submission.keyAssumptions.length ? 6 : -8,
    submission.evidence.length ? 8 : -12,
    submission.targetAudience ? 4 : -4,
    submission.timeline ? 2 : 0,
  ]);

  const averageScore = Math.round((logicScore + feasibilityScore + completenessScore) / 3);
  const decision = averageScore >= 70 ? 'PASS' : 'FAIL';

  const strengths = [
    submission.primaryGoal ? 'Primary goal is explicit.' : null,
    submission.successMetrics.length ? 'Success metrics are present.' : null,
    submission.knownConstraints.length ? 'Constraints are surfaced up front.' : null,
  ].filter(Boolean);

  const weaknesses = [
    !submission.evidence.length ? 'Evidence base is thin.' : null,
    !submission.targetAudience ? 'Target audience is not defined.' : null,
    !submission.timeline ? 'Timing pressure is not yet stated.' : null,
    complexity > 10 ? 'The idea carries a broad scope surface.' : null,
    signals.length ? 'The narrative contains tension between automation and control.' : null,
  ].filter(Boolean);

  const missingInformation = [
    !submission.evidence.length ? 'evidence' : null,
    !submission.targetAudience ? 'target audience' : null,
    !submission.timeline ? 'timeline' : null,
    !submission.budget ? 'budget' : null,
  ].filter(Boolean);

  const keyRisks = [
    ...signals,
    complexity > 9 ? 'The idea may expand into multiple subprojects before the core loop is proven.' : null,
    !submission.stakeholders.length ? 'No implementation owner is named.' : null,
  ].filter(Boolean);

  return createStageResult('grand-jury', {
    decision,
    score: averageScore,
    confidence: 0.86,
    findings: [
      `Logic score: ${logicScore}/100.`,
      `Feasibility score: ${feasibilityScore}/100.`,
      `Completeness score: ${completenessScore}/100.`,
    ],
    strengths,
    weaknesses,
    missingInformation,
    keyRisks,
    recommendation: decision === 'PASS' ? 'The idea deserves a full adversarial trial.' : 'The case needs revision before trial can be trusted.',
    logicScore,
    feasibilityScore,
    completenessScore,
    averageScore,
  });
}

export function runProsecutionStage(rawSubmission, grandJury) {
  const submission = normalizeCourtroomSubmission(rawSubmission);
  const weaknesses = [];
  const fatalRisks = [];
  const moderateRisks = [];
  const minorRisks = [];

  if (!submission.evidence.length) {
    fatalRisks.push('The idea is being advanced without evidence that it can win adoption or produce value.');
  }
  if (!submission.timeline) {
    moderateRisks.push('No delivery window is stated, so the idea may drift indefinitely.');
  }
  if (!submission.budget) {
    moderateRisks.push('Cost discipline is unknown, which weakens the feasibility claim.');
  }
  if (!submission.targetAudience) {
    minorRisks.push('The first user segment is not defined, which makes messaging and prioritization fuzzier.');
  }
  if (submission.knownConstraints.length > 4) {
    moderateRisks.push('Too many stated constraints may indicate the idea is already overloaded.');
  }
  if (submission.keyAssumptions.length > 4) {
    minorRisks.push('The idea depends on a large assumption stack.');
  }

  const complexityPenalty = Math.min(20, caseComplexity(submission) * 2);
  const juryPenalty = grandJury?.decision === 'FAIL' ? 18 : 0;
  const riskSeverityScore = Math.max(
    0,
    Math.min(100, Math.round(28 + fatalRisks.length * 22 + moderateRisks.length * 12 + minorRisks.length * 5 + complexityPenalty + juryPenalty)),
  );

  const topFailureModes = [
    {
      mode: 'Scope dilution',
      explanation: 'The idea can turn into a platform project instead of a shippable service if the division boundaries keep expanding.',
      impact: 'High',
      likelihood: caseComplexity(submission) > 8 ? 'High' : 'Medium',
    },
    {
      mode: 'Weak proof of demand',
      explanation: 'The idea may be internally compelling but still fail to attract real users or repeated usage.',
      impact: 'High',
      likelihood: submission.evidence.length ? 'Medium' : 'High',
    },
    {
      mode: 'Under-scoped ownership',
      explanation: 'The implementation owner or operating model may be too vague to survive handoff.',
      impact: 'Medium',
      likelihood: submission.stakeholders.length ? 'Low' : 'High',
    },
    {
      mode: 'Cost / maintenance creep',
      explanation: 'A reusable service can become expensive to maintain if persistence, UI, and policy layers all grow at once.',
      impact: 'Medium',
      likelihood: submission.budget ? 'Low' : 'Medium',
    },
  ];

  let recommendation = 'PROCEED';
  if (riskSeverityScore >= 70 || fatalRisks.length) recommendation = 'REJECT';
  else if (riskSeverityScore >= 35 || moderateRisks.length) recommendation = 'REVISE';

  return createStageResult('prosecution', {
    decision: recommendation,
    score: 100 - riskSeverityScore,
    confidence: 0.84,
    findings: [
      `Risk severity score: ${riskSeverityScore}/100.`,
      `${fatalRisks.length} fatal risk(s), ${moderateRisks.length} moderate risk(s), ${minorRisks.length} minor risk(s).`,
    ],
    weaknesses: topFailureModes.map((item) => item.mode),
    keyRisks: [...fatalRisks, ...moderateRisks, ...minorRisks],
    recommendation,
    fatalRisks,
    moderateRisks,
    minorRisks,
    topFailureModes,
    riskSeverityScore,
  });
}

function marketSignals(submission) {
  const reusableServiceSignal = /reusable|service|division|central operating agent|courtroom/i.test(
    `${submission.title} ${submission.ideaSummary} ${submission.primaryGoal}`,
  );
  const validationSignal = /validation|review|governance|decision/i.test(
    `${submission.title} ${submission.ideaSummary} ${submission.primaryGoal}`,
  );
  return { reusableServiceSignal, validationSignal };
}

export function runAnalystsStage(rawSubmission, grandJury, prosecution) {
  const submission = normalizeCourtroomSubmission(rawSubmission);
  const signals = marketSignals(submission);
  const riskSeverityScore = prosecution?.riskSeverityScore ?? 50;
  const juryAverage = grandJury?.averageScore ?? 50;

  const marketAnalyst = {
    name: 'Market Analyst',
    findings: [
      signals.reusableServiceSignal
        ? 'The idea has clear internal demand because it can be reused across the broader agent ecosystem.'
        : 'The idea does not yet show obvious reuse demand.',
      signals.validationSignal
        ? 'The validation problem is real: teams need structured gating to keep weak ideas from consuming execution capacity.'
        : 'The user demand signal is more indirect than direct.',
      'Competition exists from generic workflow engines and agent orchestration stacks, but the courtroom format is differentiated internally.',
    ],
    confidence: 0.81,
    majorConcerns: [
      !submission.evidence.length ? 'There is no explicit proof that a wider audience will use this repeatedly.' : null,
      'A courtroom metaphor may be memorable internally but may need a clearer product surface externally.',
    ].filter(Boolean),
    recommendation: juryAverage >= 70 ? 'APPROVE' : 'REVISE',
  };

  const technicalAnalyst = {
    name: 'Technical Analyst',
    findings: [
      'The implementation is feasible in the current Next.js + Supabase stack.',
      'The design can be delivered as a reusable service with deterministic defaults and optional provider injection.',
      'Persistence, API, and UI integration are straightforward if they reuse the existing POS patterns.',
    ],
    confidence: 0.89,
    majorConcerns: [
      caseComplexity(submission) > 10 ? 'The service may need careful abstraction boundaries to avoid becoming a second orchestration framework.' : null,
      !submission.stakeholders.length ? 'Ownership and consumer interfaces need to stay explicit.' : null,
    ].filter(Boolean),
    recommendation: riskSeverityScore < 70 ? 'APPROVE' : 'REVISE',
  };

  const financialAnalyst = {
    name: 'Financial Analyst',
    findings: [
      'Initial build cost is modest because the feature fits the repository’s existing stack.',
      'The strongest return is internal leverage: fewer weak ideas should reach execution, saving future engineering time.',
      'Ongoing cost is mainly maintenance of one deterministic service, one API route, and one persistence path.',
    ],
    confidence: 0.78,
    majorConcerns: [
      submission.budget ? null : 'No cost ceiling is defined, so the service could quietly expand if the scope grows.',
      submission.evidence.length ? null : 'ROI is easiest to justify internally; external revenue remains speculative.',
    ].filter(Boolean),
    recommendation: riskSeverityScore < 65 ? 'APPROVE' : 'REVISE',
  };

  const operationsAnalyst = {
    name: 'Operations Analyst',
    findings: [
      'Daily operations are manageable if the service stays single-purpose and the stage outputs remain structured.',
      'Maintenance burden rises if the tool becomes the default entrypoint for all idea vetting without clear intake standards.',
      'The service should be easy to support because it can run without external secrets or provider dependencies.',
    ],
    confidence: 0.86,
    majorConcerns: [
      caseComplexity(submission) > 9 ? 'High complexity submissions may need tighter intake guardrails.' : null,
      !submission.timeline ? 'Without a review cadence, the courtroom may become a dumping ground for unfinished concepts.' : null,
    ].filter(Boolean),
    recommendation: riskSeverityScore < 70 ? 'APPROVE' : 'REVISE',
  };

  const riskAnalyst = {
    name: 'Risk Analyst',
    findings: [
      'No secret handling is required for the default deterministic implementation.',
      'The Supabase path should use owner-scoped or user-scoped RLS just like the POS tables.',
      'The service should not write external side effects during validation.',
    ],
    confidence: 0.9,
    majorConcerns: [
      'If later wired to an LLM provider, the provider interface must remain injectable and secrets must stay server-side.',
      'Persisted records should be user-scoped when available to avoid cross-user leakage.',
    ],
    recommendation: riskSeverityScore < 75 ? 'APPROVE' : 'REVISE',
  };

  return createStageResult('analysts', {
    decision: 'REVISE',
    score: Math.round((marketAnalyst.confidence + technicalAnalyst.confidence + financialAnalyst.confidence + operationsAnalyst.confidence + riskAnalyst.confidence) * 20),
    confidence: 0.88,
    findings: [
      'Market, technical, financial, operations, and risk reports were produced independently.',
    ],
    strengths: [
      'Each analyst can be read independently.',
      'The service remains grounded in the current repo stack.',
    ],
    weaknesses: [
      riskSeverityScore > 70 ? 'Operational risk remains high if the court is extended too broadly.' : null,
    ].filter(Boolean),
    keyRisks: [
      ...marketAnalyst.majorConcerns,
      ...technicalAnalyst.majorConcerns,
      ...financialAnalyst.majorConcerns,
      ...operationsAnalyst.majorConcerns,
      ...riskAnalyst.majorConcerns,
    ],
    recommendation: 'Review the independent analyst reports before final judgment.',
    marketAnalyst,
    technicalAnalyst,
    financialAnalyst,
    operationsAnalyst,
    riskAnalyst,
  });
}

function counterForRisk(failureMode) {
  const mode = normalizeString(failureMode?.mode || failureMode?.failureMode).toLowerCase();
  if (mode.includes('scope')) {
    return {
      counterargument: 'The service can be constrained to one reusable validation surface and one route, which limits scope growth.',
      mitigationStrategy: 'Keep Planning, Knowledge, Execution, and Monitoring as optional future divisions rather than blocking this release on them.',
    };
  }
  if (mode.includes('demand')) {
    return {
      counterargument: 'The demand is internal and immediate: ideas already enter the system, and the court can reject weak ones earlier.',
      mitigationStrategy: 'Ship the service inside the existing app so the team uses it on real decisions, not hypothetical traffic.',
    };
  }
  if (mode.includes('ownership')) {
    return {
      counterargument: 'The service can require a named submitter and persist user references when available.',
      mitigationStrategy: 'Store `user_id` on submissions and keep ownership visible in the API payload.',
    };
  }
  return {
    counterargument: 'The failure mode is real but bounded by keeping the default implementation deterministic and local-first.',
    mitigationStrategy: 'Use the existing POS persistence and route structure, then expand only after the core path is stable.',
  };
}

export function runDefenseCounselStage(rawSubmission, prosecution, analysts) {
  const submission = normalizeCourtroomSubmission(rawSubmission);
  const topFailureModes = prosecution?.topFailureModes || [];
  const analystConfidence = [
    analysts?.marketAnalyst?.confidence,
    analysts?.technicalAnalyst?.confidence,
    analysts?.financialAnalyst?.confidence,
    analysts?.operationsAnalyst?.confidence,
    analysts?.riskAnalyst?.confidence,
  ].filter((value) => Number.isFinite(value));
  const averageAnalystConfidence = analystConfidence.length
    ? analystConfidence.reduce((sum, value) => sum + value, 0) / analystConfidence.length
    : 0.75;

  const responses = topFailureModes.map((item) => ({
    argument: item.explanation || item.mode,
    ...counterForRisk(item),
    residualRisk:
      item.mode && item.mode.toLowerCase().includes('demand')
        ? 'Medium'
        : item.mode && item.mode.toLowerCase().includes('scope')
          ? 'Medium'
          : 'Low',
  }));

  const rawScore = 52 + averageAnalystConfidence * 30 - Math.min(20, prosecution?.riskSeverityScore || 0);
  const overallDefensibilityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return createStageResult('defense-counsel', {
    decision: overallDefensibilityScore >= 70 ? 'PROCEED' : overallDefensibilityScore >= 45 ? 'REVISE' : 'REJECT',
    score: overallDefensibilityScore,
    confidence: 0.84,
    findings: [
      `${responses.length} prosecution argument(s) were answered directly.`,
      'The strongest defense is that the service is narrow, reusable, and already aligned to the current application stack.',
    ],
    strengths: [
      'The design can be implemented without new provider secrets.',
      'The service can be exercised immediately inside the current repo.',
    ],
    weaknesses: [
      prosecution?.riskSeverityScore > 70 ? 'Residual scope and maintenance risk remains significant.' : null,
    ].filter(Boolean),
    keyRisks: responses.map((response) => response.residualRisk).filter(Boolean),
    recommendation: overallDefensibilityScore >= 70 ? 'The idea is defensible enough to ship.' : 'The idea needs tightening before release.',
    responses,
    overallDefensibilityScore,
    submissionTitle: submission.title,
  });
}

function judgeVoteFromScore(score) {
  if (score >= 75) return 'APPROVE';
  if (score >= 55) return 'REVISE';
  return 'REJECT';
}

export function runTribunalStage(rawSubmission, grandJury, prosecution, analysts, defenseCounsel) {
  const judges = [
    {
      name: 'Judge 1: Strategy',
      vote: grandJury?.decision === 'PASS' && defenseCounsel?.overallDefensibilityScore >= 60 ? 'APPROVE' : 'REVISE',
      reasoning: grandJury?.decision === 'PASS'
        ? 'The idea has a coherent strategic shape and enough courtroom discipline to proceed.'
        : 'The idea still needs strategic tightening before final approval.',
      confidence: 0.9,
    },
    {
      name: 'Judge 2: Market',
      vote: analysts?.marketAnalyst?.recommendation === 'APPROVE' ? 'APPROVE' : 'REVISE',
      reasoning: 'Market demand is internally plausible, but the external audience still needs validation if the product broadens.',
      confidence: analysts?.marketAnalyst?.confidence || 0.8,
    },
    {
      name: 'Judge 3: Finance',
      vote: analysts?.financialAnalyst?.recommendation === 'APPROVE' ? 'APPROVE' : 'REVISE',
      reasoning: 'The build is cheap enough to start, but its long-term return depends on actual repeated use.',
      confidence: analysts?.financialAnalyst?.confidence || 0.8,
    },
    {
      name: 'Judge 4: Technology',
      vote: analysts?.technicalAnalyst?.recommendation === 'APPROVE' && prosecution?.riskSeverityScore < 75 ? 'APPROVE' : 'REVISE',
      reasoning: 'The current stack can support the service, but only if the implementation remains deterministic and narrow.',
      confidence: analysts?.technicalAnalyst?.confidence || 0.85,
    },
    {
      name: 'Judge 5: Operations',
      vote: analysts?.operationsAnalyst?.recommendation === 'APPROVE' && prosecution?.riskSeverityScore < 75 ? 'APPROVE' : 'REVISE',
      reasoning: 'Operations are tractable when the service stays single-purpose and user-scoped.',
      confidence: analysts?.operationsAnalyst?.confidence || 0.84,
    },
  ];

  const approveCount = judges.filter((judge) => judge.vote === 'APPROVE').length;
  const tribunalDecision =
    approveCount === 5 ? 'STRONG APPROVAL' :
    approveCount === 4 ? 'APPROVAL' :
    approveCount === 3 ? 'CONDITIONAL APPROVAL' :
    approveCount === 2 ? 'REVISE' :
    approveCount === 1 ? 'REJECT' :
    'TERMINATE';

  return createStageResult('tribunal', {
    decision: tribunalDecision,
    score: Math.round((approveCount / judges.length) * 100),
    confidence: 0.88,
    findings: [
      `${approveCount}/5 judges voted APPROVE.`,
      `Tribunal decision: ${tribunalDecision}.`,
    ],
    strengths: judges.filter((judge) => judge.vote === 'APPROVE').map((judge) => judge.name),
    weaknesses: judges.filter((judge) => judge.vote !== 'APPROVE').map((judge) => judge.name),
    keyRisks: [
      prosecution?.riskSeverityScore >= 70 ? 'High prosecution pressure remains.' : null,
    ].filter(Boolean),
    recommendation: tribunalDecision,
    judges,
    approveCount,
    tribunalDecision,
  });
}

export function runExecutionerStage(rawSubmission, warden, grandJury, prosecution, analysts, defenseCounsel, tribunal) {
  const submission = normalizeCourtroomSubmission(rawSubmission);
  const approveCount = tribunal?.approveCount ?? 0;
  const wardenDenied = warden?.decision === 'DENY';
  const grandJuryPass = grandJury?.decision === 'PASS';
  const prosecutionRecommendation = prosecution?.decision || prosecution?.recommendation;
  const tribunalDecision = tribunal?.tribunalDecision || tribunal?.decision;
  let verdict = 'REVISE';

  if (wardenDenied) {
    verdict = 'ABANDON';
  } else if (
    approveCount >= 4 &&
    grandJuryPass &&
    prosecutionRecommendation !== 'REJECT' &&
    tribunalDecision !== 'TERMINATE'
  ) {
    verdict = 'EXECUTE';
  } else if (
    approveCount >= 3 ||
    tribunalDecision === 'CONDITIONAL APPROVAL' ||
    prosecutionRecommendation === 'REVISE' ||
    (grandJury?.averageScore ?? 0) >= 65
  ) {
    verdict = 'REVISE';
  } else {
    verdict = 'ABANDON';
  }

  const confidenceScore = clampScore(
    verdict === 'EXECUTE'
      ? 0.86
      : verdict === 'REVISE'
        ? 0.74
        : 0.58,
  );

  const requiredNextActions =
    verdict === 'EXECUTE'
      ? [
          'Implement the reusable CVS service as the canonical validation entrypoint.',
          'Wire persistence and API access to the new service.',
          'Add the UI surface that lets the team submit an idea and read the verdict.',
          'Apply the database migration and verify user-scoped record writes.',
          'Keep the provider interface deterministic by default and injectable later.',
        ]
      : verdict === 'REVISE'
        ? [
            'Tighten the weak fields identified by the Warden and Grand Jury.',
            'Reduce the broadest failure modes flagged by Prosecution.',
            'Confirm the service boundary stays small and reusable.',
            'Add or refine tests that cover the missing risk edge cases.',
            'Resubmit after the revised idea has a sharper success criterion.',
          ]
        : [
            'Do not allocate implementation capacity yet.',
            'Return the idea to intake because the court cannot defend the investment.',
            'Capture the main rejection reasons for later reuse if the idea is reformulated.',
            'Keep the validation service available for future ideas with a clearer signal.',
            'Only reconsider if the submission materially changes.',
          ];

  const implementationRoadmap =
    verdict === 'EXECUTE'
      ? [
          { title: 'Service Core', detail: 'Ship the reusable courtroom service as a single callable interface with deterministic stage outputs.' },
          { title: 'Persistence', detail: 'Persist submissions, stage results, verdicts, and audit history with user-scoped records when available.' },
          { title: 'API', detail: 'Expose the service through a single route that can validate ideas and return recent history.' },
          { title: 'UI', detail: 'Add a lightweight submission screen and verdict viewer inside the app shell.' },
          { title: 'Verification', detail: 'Expand the automated tests and confirm the route and persistence paths behave correctly.' },
        ]
      : [];

  const revisionsRequired =
    verdict === 'REVISE'
      ? [
          'Provide stronger evidence or demand signals.',
          'Define the audience and implementation owner.',
          'State a concrete budget or scope boundary.',
        ]
      : [];

  return createFinalVerdict({
    verdict,
    confidenceScore,
    primaryReason:
      verdict === 'EXECUTE'
        ? 'The court found enough internal demand, technical feasibility, and operational control to justify building.'
        : verdict === 'REVISE'
          ? 'The idea is promising but still has enough unresolved risk that revision is the responsible path.'
          : 'The case fails to justify further execution capacity in its current form.',
    requiredNextActions,
    revisionsRequired,
    implementationRoadmap,
    submissionTitle: submission.title,
    submissionId: submission.caseId,
    tribunalDecision,
    analystSummary: {
      market: analysts?.marketAnalyst?.recommendation,
      technical: analysts?.technicalAnalyst?.recommendation,
      financial: analysts?.financialAnalyst?.recommendation,
      operations: analysts?.operationsAnalyst?.recommendation,
      risk: analysts?.riskAnalyst?.recommendation,
    },
  });
}
