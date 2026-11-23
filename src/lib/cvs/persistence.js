const OPEN_VERSION_REASON = 'Courtroom history is not saved in the open version; results stay in memory.';

function serialize(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryCourtroomPersistence(reason = OPEN_VERSION_REASON) {
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

// The open version has no database: courtroom results always stay in memory
// for the length of the request.
export async function createCourtroomPersistence() {
  return createMemoryCourtroomPersistence(OPEN_VERSION_REASON);
}

export function createGuestCourtroomHistory(reason = OPEN_VERSION_REASON) {
  return {
    durable: false,
    reason,
    recentSubmissions: [],
    recentVerdicts: [],
    stageSummaries: [],
    contextBlock: '',
  };
}

export async function loadCourtroomHistory() {
  return createGuestCourtroomHistory();
}
