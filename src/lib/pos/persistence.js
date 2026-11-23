const OPEN_VERSION_REASON = 'POS records are not saved in the open version; they stay in memory.';

function serialize(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryPersistence(reason = OPEN_VERSION_REASON) {
  const events = [];
  const runs = [];
  const outputs = [];
  const rounds = [];
  const plans = [];

  return {
    async createRun(run) {
      runs.push(serialize(run));
    },
    async recordAgentOutput(run, output) {
      outputs.push({ runId: run.id, output: serialize(output) });
    },
    async recordConsensusRound(run, round) {
      rounds.push({ runId: run.id, round: serialize(round) });
    },
    async recordFinalPlan(run, finalPlan) {
      plans.push({ run: serialize(run), finalPlan: serialize(finalPlan) });
    },
    async recordEvent(event) {
      events.push(serialize(event));
    },
    status() {
      return {
        mode: 'memory',
        durable: false,
        reason,
        retryCount: 0,
        counts: {
          runs: runs.length,
          outputs: outputs.length,
          rounds: rounds.length,
          plans: plans.length,
          events: events.length,
        },
      };
    },
  };
}

// The open version has no database: POS audit records always stay in memory.
export async function createPosPersistence() {
  return createMemoryPersistence(OPEN_VERSION_REASON);
}

export function createGuestProjectMemory(reason = OPEN_VERSION_REASON) {
  return {
    durable: false,
    reason,
    recentRuns: [],
    durableDecisions: [],
    openQuestions: [],
    risks: [],
    nextActions: [],
    contextBlock: '',
  };
}

export async function loadPosProjectMemory() {
  return createGuestProjectMemory();
}
