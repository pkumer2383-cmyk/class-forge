# POS Runtime MVP

Status: implemented and Phase 4 hardening complete
Date: 2026-06-04

## Persistence Decision

Use Supabase Postgres as the MVP audit trail because the app already has Supabase SSR clients and the architecture calls for a Postgres-backed system of record.

The runtime uses a graceful fallback:

- If Supabase environment variables or tables are missing, the run still completes with an in-memory audit packet in the API response.
- If Supabase inserts succeed, the response reports `persistence.durable: true`.
- The migration in `supabase/migrations/202606040001_pos_runtime_audit.sql` creates run, agent message, consensus round, artifact, and audit event tables with RLS enabled.

## Implemented Runtime

- `src/lib/pos/schemas.js`: run model, agent output contract, score normalization, and final plan validation.
- `src/lib/pos/agents.js`: deterministic specialist agents for project management, research, critique, risk, execution, and knowledge.
- `src/lib/pos/consensus.js`: weighted confidence, agreement, risk penalty, disagreement hotspots, and stop rules.
- `src/lib/pos/orchestrator.js`: bounded run loop, agent delegation, consensus rounds, final plan generation, and audit event recording.
- `src/lib/pos/persistence.js`: Supabase audit adapter with memory fallback.
- `src/app/api/pos/runs/route.js`: canonical POS run API.
- `src/app/api/agents/route.js`: compatibility route for the existing Agent Lab.

## Human Approval Checkpoints

The MVP marks the run `approval_required` when the final plan includes approval checkpoints. Current checkpoint triggers include external writes, irreversible actions, spending, deletion, or explicit agent approval requirements.

## Next Step

Move into Phase 5 productionization work: authentication hardening, deployment strategy, environment separation, backups, retention, and broader test coverage.
