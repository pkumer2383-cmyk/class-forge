"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'forge.agent-lab.v2';
const DEFAULT_GOAL = 'Build a modular POS that accepts a goal, delegates to specialist agents, runs consensus loops, and returns an execution plan.';
const DEFAULT_CONSTITUTION = [
  '1. Keep the runtime local-first and vendor-agnostic.',
  '2. Use typed agent contracts and deterministic consensus before provider-specific model calls.',
  '3. Preserve a full audit trail for every run, agent message, consensus round, and final artifact.',
  '4. Require human approval before external writes, spending, deletion, or irreversible automation.',
  '5. Separate run-scoped working memory from durable long-term memory.',
].join('\n');

const PRESETS = [
  {
    id: 'core',
    label: 'Core loop',
    description: 'Strategist, Operator, Critic, Executor.',
  },
  {
    id: 'company',
    label: 'Company board',
    description: 'CEO, CFO, Product, Revenue, Ops, QA.',
  },
];

const ROLE_COPY = {
  'project-manager': 'Creates the roadmap, milestones, and scope boundary.',
  research: 'Anchors the run in available context and evidence.',
  critic: 'Challenges assumptions and unresolved gaps.',
  risk: 'Surfaces delivery, data, and operational risks.',
  execution: 'Turns consensus into implementation tasks.',
  knowledge: 'Separates working context from durable memory links.',
};

export default function AgentLab() {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [context, setContext] = useState('Preference: small team, fast execution, clear ownership, auditable decisions.');
  const [constitution, setConstitution] = useState(DEFAULT_CONSTITUTION);
  const [preset, setPreset] = useState('core');
  const [rounds, setRounds] = useState(2);
  const [autoLoop, setAutoLoop] = useState(true);
  const [maxCycles, setMaxCycles] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState([]);
  const [projectMemory, setProjectMemory] = useState(null);
  const [operatingStatus, setOperatingStatus] = useState(null);
  const [memory, setMemory] = useState({
    companyName: 'Unassigned',
    mission: '',
    principles: [],
    openQuestions: [],
    durableDecisions: [],
  });

  const agentCards = useMemo(
    () => [
      { id: 'project-manager', name: 'Project Manager', accent: 'from-sky-400 to-cyan-300' },
      { id: 'research', name: 'Research', accent: 'from-emerald-400 to-lime-300' },
      { id: 'critic', name: 'Critic', accent: 'from-amber-400 to-orange-300' },
      { id: 'risk', name: 'Risk', accent: 'from-rose-400 to-pink-300' },
      { id: 'execution', name: 'Execution', accent: 'from-violet-400 to-fuchsia-300' },
      { id: 'knowledge', name: 'Knowledge', accent: 'from-teal-400 to-cyan-300' },
    ],
    [],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.goal) setGoal(parsed.goal);
      if (parsed?.context) setContext(parsed.context);
      if (parsed?.constitution) setConstitution(parsed.constitution);
      if (parsed?.preset) setPreset(parsed.preset);
      if (Number.isFinite(parsed?.rounds)) setRounds(parsed.rounds);
      if (typeof parsed?.autoLoop === 'boolean') setAutoLoop(parsed.autoLoop);
      if (Number.isFinite(parsed?.maxCycles)) setMaxCycles(parsed.maxCycles);
      if (Array.isArray(parsed?.turns)) setTurns(parsed.turns);
      if (parsed?.memory && typeof parsed.memory === 'object') setMemory(parsed.memory);
      if (parsed?.result) setResult(parsed.result);
    } catch {
      // Ignore corrupt local state and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ goal, context, constitution, preset, rounds, autoLoop, maxCycles, turns, memory, result }),
      );
    } catch {
      // Ignore storage errors in private mode or blocked storage.
    }
  }, [goal, context, constitution, preset, rounds, autoLoop, maxCycles, turns, memory, result]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch('/api/pos/runs').then((res) => res.json()),
      fetch('/api/pos/status').then((res) => (res.ok ? res.json() : null)),
    ]).then(([memoryResult, statusResult]) => {
      if (cancelled) return;
      if (memoryResult.status === 'fulfilled') setProjectMemory(memoryResult.value?.projectMemory || null);
      else setProjectMemory(null);
      if (statusResult.status === 'fulfilled') setOperatingStatus(statusResult.value?.status || null);
      else setOperatingStatus(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runOrchestration() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          goal,
          context: [context, constitution].filter(Boolean).join('\n\nConstitution:\n'),
          preset,
          maxIterations: autoLoop ? maxCycles : rounds,
          approvalMode: 'checkpoint',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Orchestration failed');
      setResult(data);
      setTurns(flattenTurns(data.rounds));
      setMemory(mergeMemory(memory, data.memoryUpdate));
      if (data.projectMemory) setProjectMemory(data.projectMemory);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function exportDecisionLog() {
    if (!result) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      goal,
      context,
      constitution,
      preset,
      roundsRequested: rounds,
      autoLoop,
      maxCycles,
      consensus: result.consensus,
      summary: result.summary,
      decisions: result.decisions || [],
      risks: result.risks || [],
      nextActions: result.nextActions || [],
      finalPlan: result.finalPlan || null,
      audit: result.audit || null,
      memory,
      rounds: result.rounds || [],
      turns,
      model: result.model,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forge-decision-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function resetState() {
    setGoal(DEFAULT_GOAL);
    setContext('Preference: small team, fast execution, clear ownership, auditable decisions.');
    setConstitution(DEFAULT_CONSTITUTION);
    setPreset('core');
    setRounds(2);
    setAutoLoop(true);
    setMaxCycles(3);
    setTurns([]);
    setMemory({
      companyName: 'Unassigned',
      mission: '',
      principles: [],
            openQuestions: [],
            durableDecisions: [],
    });
    setResult(null);
  }

  return (
    <main
      className="min-h-screen text-slate-100"
      style={{
        background:
          'radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 35%), linear-gradient(180deg, #030712 0%, #0f172a 55%, #020617 100%)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              POS runtime MVP
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Agent consensus control room</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Goal intake, specialist delegation, deterministic consensus, final plan generation, and an auditable run
              packet are now wired into the app.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link href="/" className="text-sky-300 hover:text-sky-200">
              Back to ClassForge
            </Link>
            <Link href="/cvs" className="text-sky-300 hover:text-sky-200">
              Open Courtroom Validation System
            </Link>
          </div>
        </div>

        {projectMemory && !projectMemory.durable ? (
          <div className="mb-5 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Guest mode: agent runs work in memory, but durable history and audit storage require sign-in.
            <Link href="/login?next=%2Fagents" className="ml-2 font-semibold text-sky-200 hover:text-white">
              Sign in
            </Link>
          </div>
        ) : null}

        <ChiefOperatingStatusPanel status={operatingStatus} />

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Goal">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                />
              </Field>
              <Field label="Context">
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Company constitution">
                <textarea
                  value={constitution}
                  onChange={(e) => setConstitution(e.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Preset">
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none"
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rounds">
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-2 text-sm text-slate-300">{rounds} minimum round(s)</div>
              </Field>
              <Field label="Memory">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
                  {memory.companyName || 'Unassigned'}
                  <div className="mt-1 text-slate-400">{memory.mission || 'No mission yet'}</div>
                  <div className="mt-2 text-slate-500">
                    {projectMemory?.durable
                      ? `${projectMemory.recentRuns?.length || 0} prior run(s) loaded`
                      : 'Guest memory only'}
                  </div>
                </div>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={autoLoop}
                  onChange={(e) => setAutoLoop(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-800"
                />
                Run bounded consensus loop
              </label>
              <label className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Max cycles</div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={maxCycles}
                  onChange={(e) => setMaxCycles(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="mt-2 text-sm text-slate-300">{maxCycles} iteration cap</div>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runOrchestration}
                disabled={loading || !goal.trim()}
                className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Running agents...' : 'Run POS'}
              </button>
              <button
                type="button"
                onClick={resetState}
                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/5"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={exportDecisionLog}
                disabled={!result}
                className="rounded-full border border-sky-400/30 px-5 py-2.5 text-sm text-sky-200 transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export decision log
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {agentCards.map((agent) => (
                <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${agent.accent}`} />
                  <div className="mt-3 text-sm font-semibold">{agent.name}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{ROLE_COPY[agent.id]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">System output</div>
            {result ? (
              <div className="mt-4 space-y-4">
                <KeyValue title="Consensus" value={result.consensus} />
                <KeyValue title="Project memory" value={projectMemory?.reason || 'Not loaded'} />
                <KeyValue
                  title="Confidence"
                  value={
                    result.finalPlan?.consensus?.confidenceScore
                      ? `${Math.round(result.finalPlan.consensus.confidenceScore * 100)}%`
                      : 'Unknown'
                  }
                />
                <KeyValue title="Audit" value={result.audit?.persistence?.durable ? 'Supabase persisted' : 'Memory fallback'} />
                <OutputBlock title="Summary" value={result.summary} />
                <FinalPlanBlock plan={result.finalPlan} />
                <ListBlock title="Decisions" items={result.decisions} />
                <ListBlock title="Risks" items={result.risks} />
                <ListBlock title="Next actions" items={result.nextActions} />
                <MemoryBlock memory={memory} />
                <ProjectMemoryBlock projectMemory={projectMemory} />
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Run the first POS pass to see the final execution plan.
              </p>
            )}
          </div>
        </section>

        {result?.rounds?.length ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Agent conversation</div>
              <div className="text-xs text-slate-500">Runtime: {result.model}</div>
            </div>
            <div className="mt-4 space-y-5">
              {result.rounds.map((round, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Round {round.round || idx + 1}</div>
                  <div className="mt-3 grid gap-3">
                    {round.turns?.map((turn, turnIdx) => (
                      <div key={turnIdx} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-slate-100">{turn.agentName || turn.agentId}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            handoff to {turn.handoffTo || 'none'}
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{turn.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function flattenTurns(rounds) {
  if (!Array.isArray(rounds)) return [];
  return rounds.flatMap((round) => (Array.isArray(round?.turns) ? round.turns : []));
}

function mergeMemory(prev, update) {
  const next = { ...prev };
  if (!update || typeof update !== 'object') return next;
  if (typeof update.companyName === 'string') next.companyName = update.companyName;
  if (typeof update.mission === 'string') next.mission = update.mission;
  if (Array.isArray(update.principles)) next.principles = update.principles;
  if (Array.isArray(update.openQuestions)) next.openQuestions = update.openQuestions;
  if (Array.isArray(update.durableDecisions)) next.durableDecisions = update.durableDecisions;
  return next;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function KeyValue({ title, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
        {value || 'Unknown'}
      </div>
    </div>
  );
}

function OutputBlock({ title, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function FinalPlanBlock({ plan }) {
  if (!plan) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Final plan</div>
      <div className="mt-2 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm leading-6 text-slate-200">
          {plan.scopeStatement}
        </div>
        {Array.isArray(plan.milestones) && plan.milestones.length ? (
          <div className="grid gap-2">
            {plan.milestones.slice(0, 4).map((milestone) => (
              <div key={milestone.id} className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                <div className="text-sm font-semibold text-slate-100">{milestone.title}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{milestone.phase}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListBlock({ title, items }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm leading-6 text-slate-200">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemoryBlock({ memory }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Persistent memory</div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
        <div>Company: {memory.companyName || 'Unassigned'}</div>
        <div className="mt-1">Mission: {memory.mission || 'Unset'}</div>
        <div className="mt-1">Principles: {(memory.principles || []).join(', ') || 'None'}</div>
        <div className="mt-1">Decisions: {(memory.durableDecisions || []).join(', ') || 'None'}</div>
        <div className="mt-1">Open questions: {(memory.openQuestions || []).join(', ') || 'None'}</div>
      </div>
    </div>
  );
}

function ProjectMemoryBlock({ projectMemory }) {
  if (!projectMemory) return null;
  const hasMemory =
    projectMemory.durable &&
    ((projectMemory.recentRuns || []).length ||
      (projectMemory.durableDecisions || []).length ||
      (projectMemory.nextActions || []).length ||
      (projectMemory.risks || []).length ||
      (projectMemory.openQuestions || []).length);

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Run history</div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
        <div>{projectMemory.reason || 'No durable project memory loaded.'}</div>
        {hasMemory ? (
          <div className="mt-3 space-y-3">
            <MiniList
              title="Recent runs"
              items={(projectMemory.recentRuns || []).map((run) => `${run.goal} (${run.state})`)}
            />
            <MiniList title="Durable decisions" items={projectMemory.durableDecisions} />
            <MiniList title="Next actions" items={projectMemory.nextActions} />
            <MiniList title="Risks" items={projectMemory.risks} />
            <MiniList title="Open questions" items={projectMemory.openQuestions} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniList({ title, items }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-1 space-y-1">
        {items.slice(0, 4).map((item, idx) => (
          <li key={idx} className="text-xs leading-5 text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChiefOperatingStatusPanel({ status }) {
  if (!status) return null;
  const activeProject = status.activeProjects?.[0];
  const topActions = status.recommendedNextActions || [];
  const decisions = status.decisionsNeeded || [];
  const codexTasks = status.codexReadyTasks || [];

  return (
    <section className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Chief Operating Agent
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {activeProject?.name || 'Operating dashboard'}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-emerald-50/90">{status.executiveSummary}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Phase</div>
          <div className="mt-1 font-semibold">{activeProject?.currentPhase || 'Unknown'}</div>
          <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Project manager</div>
          <div className="mt-1 font-semibold">
            {activeProject?.projectManagerAgent || activeProject?.ownerAgent || 'Unassigned'}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <StatusColumn
          title="Next actions"
          items={topActions.slice(0, 3).map((item) => `${item.rank}. ${item.action}`)}
        />
        <StatusColumn
          title="Decisions needed"
          items={decisions.slice(0, 3).map((item) => item.decision || item)}
        />
        <StatusColumn
          title="Codex-ready"
          items={codexTasks.slice(0, 3).map((item) => item.title || item)}
        />
      </div>
      <div className="mt-4">
        <StatusColumn
          title="Specialists under project manager"
          items={(activeProject?.specialistAgents || []).slice(0, 5).map((agent) => agent.ownerAgent)}
        />
      </div>
    </section>
  );
}

function StatusColumn({ title, items }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <ul className="mt-3 space-y-2">
        {(items || []).map((item, index) => (
          <li key={index} className="text-sm leading-6 text-slate-200">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
