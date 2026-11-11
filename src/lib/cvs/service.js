import { createCourtroomProvider } from './provider.js';
import {
  createFinalVerdict,
  normalizeCourtroomSubmission,
  validateCourtroomSubmission,
} from './schemas.js';
import { createCourtroomPersistence } from './persistence.js';

export function createCourtroomValidationService(options = {}) {
  const provider = createCourtroomProvider(options.provider || {});
  const persistence = options.persistence || null;

  return {
    async validateIdea(rawInput = {}) {
      const submission = normalizeCourtroomSubmission(rawInput);
      validateCourtroomSubmission(submission);

      const activePersistence = persistence || (await createCourtroomPersistence({ userId: submission.userId || rawInput.userId || null }));
      const auditHistory = [];

      async function record(eventType, payload) {
        const event = {
          eventType,
          submissionId: submission.caseId,
          payload,
          createdAt: payload?.createdAt || new Date().toISOString(),
        };
        auditHistory.push(event);
        if (activePersistence?.recordEvent) {
          await activePersistence.recordEvent(event);
        }
      }

      await activePersistence.createSubmission(submission);
      await record('submission_created', submission);

      const stageResults = [];
      const skippedStages = [];

      const warden = provider.evaluateWarden(submission);
      stageResults.push(warden);
      await activePersistence.recordStageResult(submission, warden);
      await record('stage_completed', warden);

      if (warden.decision === 'DENY') {
        skippedStages.push('grand-jury', 'prosecution', 'analysts', 'defense-counsel', 'tribunal');
        const finalVerdict = createFinalVerdict({
          verdict: 'ABANDON',
          confidenceScore: 0.62,
          primaryReason: 'The Warden denied the case before it could enter trial.',
          requiredNextActions: [
            'Resubmit the idea with a clear success metric and primary goal.',
            'Add the missing intake information the Warden requested.',
            'Keep the next draft narrow enough for a real hearing.',
          ],
          revisionsRequired: ['Provide the missing Warden intake fields.'],
          submissionId: submission.caseId,
        });
        await activePersistence.recordFinalVerdict(submission, finalVerdict);
        await record('final_verdict_recorded', finalVerdict);

        return {
          schemaVersion: submission.schemaVersion,
          submission,
          warden,
          grandJury: null,
          prosecution: null,
          analysts: null,
          defenseCounsel: null,
          tribunal: null,
          executioner: finalVerdict,
          verdict: finalVerdict.verdict,
          stageResults,
          skippedStages,
          auditHistory,
          persistence: activePersistence.status(),
        };
      }

      const grandJury = provider.evaluateGrandJury(submission);
      stageResults.push(grandJury);
      await activePersistence.recordStageResult(submission, grandJury);
      await record('stage_completed', grandJury);

      const prosecution = provider.evaluateProsecution(submission, grandJury);
      stageResults.push(prosecution);
      await activePersistence.recordStageResult(submission, prosecution);
      await record('stage_completed', prosecution);

      const analysts = provider.evaluateAnalysts(submission, grandJury, prosecution);
      stageResults.push(analysts);
      await activePersistence.recordStageResult(submission, analysts);
      await record('stage_completed', analysts);

      const defenseCounsel = provider.evaluateDefenseCounsel(submission, prosecution, analysts);
      stageResults.push(defenseCounsel);
      await activePersistence.recordStageResult(submission, defenseCounsel);
      await record('stage_completed', defenseCounsel);

      const tribunal = provider.evaluateTribunal(submission, grandJury, prosecution, analysts, defenseCounsel);
      stageResults.push(tribunal);
      await activePersistence.recordStageResult(submission, tribunal);
      await record('stage_completed', tribunal);

      const executioner = provider.evaluateExecutioner(
        submission,
        warden,
        grandJury,
        prosecution,
        analysts,
        defenseCounsel,
        tribunal,
      );
      await activePersistence.recordFinalVerdict(submission, executioner);
      await record('final_verdict_recorded', executioner);

      return {
        schemaVersion: submission.schemaVersion,
        submission,
        warden,
        grandJury,
        prosecution,
        analysts,
        defenseCounsel,
        tribunal,
        executioner,
        verdict: executioner.verdict,
        stageResults,
        skippedStages,
        auditHistory,
        persistence: activePersistence.status(),
      };
    },
  };
}

export async function runCourtroomValidation(rawInput, options = {}) {
  const service = createCourtroomValidationService(options);
  return service.validateIdea(rawInput);
}
