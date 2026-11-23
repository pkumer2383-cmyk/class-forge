"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

const DEFAULT_FORM = {
  title: 'Central Operating Agent',
  primaryGoal: 'Build a reusable service that routes ideas through Planning, Knowledge, Execution, Monitoring, and a Courtroom Validation System.',
  ideaSummary:
    'A reusable service for the broader agent ecosystem with deterministic validation stages and structured verdicts.',
  successMetrics:
    'The service can validate ideas through all stages, expose a single API, and produce EXECUTE, REVISE, or ABANDON verdicts.',
  knownConstraints:
    'Keep the default implementation deterministic; reuse the existing Next.js stack; no hardcoded secrets; no external side effects during validation.',
  keyAssumptions:
    'The current app stack can host the service; the new route can be used anywhere in the app; in-memory results are enough for MVP.',
  evidence:
    'Existing POS runtime and server route patterns already exist in the repo.',
  targetAudience: 'Forge internal operators and future agent workflows',
  timeline: 'Immediate MVP',
  budget: 'Low',
};

function splitLines(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function StageBlock({ stage }) {
  if (!stage) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-200/80">{stage.stage}</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">{stage.decision}</h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
          Score {Math.round((stage.score || 0) * 10) / 10}
        </div>
      </div>
      {Array.isArray(stage.findings) && stage.findings.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {stage.findings.map((finding, index) => (
            <li key={`${stage.stage}-finding-${index}`}>• {finding}</li>
          ))}
        </ul>
      ) : null}
      {Array.isArray(stage.keyRisks) && stage.keyRisks.length ? (
        <div className="mt-3 text-sm text-rose-200">
          <span className="font-semibold">Risks:</span> {stage.keyRisks.join(' | ')}
        </div>
      ) : null}
    </div>
  );
}

export default function CourtroomValidationClient() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cvs')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHistory(data?.history || null);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitIdea() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/cvs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          primaryGoal: form.primaryGoal,
          ideaSummary: form.ideaSummary,
          successMetrics: splitLines(form.successMetrics),
          knownConstraints: splitLines(form.knownConstraints),
          keyAssumptions: splitLines(form.keyAssumptions),
          evidence: splitLines(form.evidence),
          targetAudience: form.targetAudience,
          timeline: form.timeline,
          budget: form.budget,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Validation failed');
      setResult(data?.result || null);
      setHistory(data?.history || null);
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const verdict = result?.executioner?.verdict || result?.verdict || '';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              Courtroom Validation System
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Idea courtroom</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Submit an idea once, then review the Warden, Grand Jury, Prosecution, Analysts, Defense Counsel,
              Tribunal, and Executioner outputs in one place.
            </p>
          </div>
          <Link href="/" className="text-sm text-sky-300 hover:text-sky-200">
            Back to ClassForge
          </Link>
        </div>

        {history?.durable === false ? (
          <div className="mb-5 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Results validate here but are not saved: courtroom history is not available in the open version.
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['title', 'Title'],
                ['primaryGoal', 'Primary goal'],
                ['targetAudience', 'Target audience'],
                ['timeline', 'Timeline'],
                ['budget', 'Budget'],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <div className="mb-2 text-sm font-medium text-slate-200">{label}</div>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  />
                </label>
              ))}
            </div>

            {[
              ['ideaSummary', 'Idea summary'],
              ['successMetrics', 'Success metrics'],
              ['knownConstraints', 'Known constraints'],
              ['keyAssumptions', 'Key assumptions'],
              ['evidence', 'Evidence'],
            ].map(([key, label]) => (
              <label key={key} className="mt-4 block">
                <div className="mb-2 text-sm font-medium text-slate-200">{label}</div>
                <textarea
                  value={form[key]}
                  onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                  rows={key === 'ideaSummary' ? 5 : 4}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                />
                <div className="mt-1 text-xs text-slate-500">
                  One idea per line for best results.
                </div>
              </label>
            ))}

            <button
              onClick={submitIdea}
              disabled={loading}
              className="mt-5 inline-flex items-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Validating...' : 'Run validation'}
            </button>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Final verdict</div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-50">{verdict || 'Awaiting submission'}</h2>
                </div>
                {result?.executioner?.confidenceScore != null ? (
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Confidence {Math.round(result.executioner.confidenceScore * 100)}%
                  </div>
                ) : null}
              </div>
              {result?.executioner?.primaryReason ? (
                <p className="mt-4 text-sm leading-6 text-slate-300">{result.executioner.primaryReason}</p>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  The court has not heard the case yet.
                </p>
              )}
              {Array.isArray(result?.executioner?.requiredNextActions) && result.executioner.requiredNextActions.length ? (
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {result.executioner.requiredNextActions.map((item, index) => (
                    <li key={`next-${index}`}>• {item}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="grid gap-4">
              <StageBlock stage={result?.warden} />
              <StageBlock stage={result?.grandJury} />
              <StageBlock stage={result?.prosecution} />
              <StageBlock stage={result?.analysts} />
              <StageBlock stage={result?.defenseCounsel} />
              <StageBlock stage={result?.tribunal} />
            </div>

            {result?.analysts ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <h2 className="text-xl font-semibold text-slate-50">Analyst reports</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {['marketAnalyst', 'technicalAnalyst', 'financialAnalyst', 'operationsAnalyst', 'riskAnalyst'].map((key) => {
                    const report = result.analysts[key];
                    if (!report) return null;
                    return (
                      <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-sm font-semibold text-sky-100">{report.name}</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          Confidence {Math.round((report.confidence || 0) * 100)}%
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                          {splitLines((report.findings || []).join('\n')).map((item, index) => (
                            <li key={`${key}-finding-${index}`}>• {item}</li>
                          ))}
                        </ul>
                        {Array.isArray(report.majorConcerns) && report.majorConcerns.length ? (
                          <div className="mt-3 text-sm text-amber-200">
                            <span className="font-semibold">Concerns:</span> {report.majorConcerns.join(' | ')}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {history ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="text-sm font-semibold text-slate-100">Recent courtroom history</div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Submissions</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {(history.recentSubmissions || []).slice(0, 5).map((item) => (
                        <li key={item.id}>• {item.title}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Verdicts</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {(history.recentVerdicts || []).slice(0, 5).map((item) => (
                        <li key={item.submissionId}>• {item.verdict}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
