import {
  runAnalystsStage,
  runDefenseCounselStage,
  runExecutionerStage,
  runGrandJuryStage,
  runProsecutionStage,
  runTribunalStage,
  runWardenStage,
} from './stages.js';

export function createCourtroomProvider(overrides = {}) {
  return {
    evaluateWarden: overrides.evaluateWarden || ((submission) => runWardenStage(submission)),
    evaluateGrandJury: overrides.evaluateGrandJury || ((submission) => runGrandJuryStage(submission)),
    evaluateProsecution: overrides.evaluateProsecution || ((submission, grandJury) => runProsecutionStage(submission, grandJury)),
    evaluateAnalysts:
      overrides.evaluateAnalysts ||
      ((submission, grandJury, prosecution) => runAnalystsStage(submission, grandJury, prosecution)),
    evaluateDefenseCounsel:
      overrides.evaluateDefenseCounsel ||
      ((submission, prosecution, analysts) => runDefenseCounselStage(submission, prosecution, analysts)),
    evaluateTribunal:
      overrides.evaluateTribunal ||
      ((submission, grandJury, prosecution, analysts, defenseCounsel) =>
        runTribunalStage(submission, grandJury, prosecution, analysts, defenseCounsel)),
    evaluateExecutioner:
      overrides.evaluateExecutioner ||
      ((submission, warden, grandJury, prosecution, analysts, defenseCounsel, tribunal) =>
        runExecutionerStage(submission, warden, grandJury, prosecution, analysts, defenseCounsel, tribunal)),
  };
}
