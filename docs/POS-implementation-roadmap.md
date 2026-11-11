# POS Implementation Roadmap

## Objective

Deliver a working MVP that accepts a goal, runs specialized agents through iterative critique, and returns a final execution plan with audit trail and confidence scoring.

## Phase 0: SEO Foundation

### Outputs

- Canonical metadata
- Open Graph metadata
- Robots and sitemap support
- Structured data for the app shell
- Noindex rules for private routes

### Acceptance Criteria

- Public routes render the expected SEO head tags in the live build.
- Canonical paths are authored as relative metadata inputs, while Open Graph URLs remain absolute.

### Status

Implemented in `src/lib/seo.js`, `src/app/layout.js`, `src/app/sitemap.js`, `src/app/robots.js`, and the public route metadata exports.

## Milestone 1: Foundation

### Outputs

- Repository architecture in place
- Agent schema defined
- Goal/run data model defined
- Consensus scoring rules documented
- Audit trail format defined

### Acceptance Criteria

- We can represent a goal, an agent response, a revision, and a final consensus result.
- The schema supports versioned runs and history.

### Status

Implemented in `src/lib/pos/schemas.js`, `src/lib/pos/agents.js`, and `src/lib/pos/orchestrator.js`.

## Milestone 2: Runtime Core

### Outputs

- Orchestrator service
- Agent execution pipeline
- Consensus engine
- Iteration cap support
- Final plan generator

### Acceptance Criteria

- A single goal can flow through all required agents.
- The system can stop after a bounded number of iterations.

### Status

Implemented as a deterministic MVP runtime in `src/lib/pos/orchestrator.js` and `src/lib/pos/consensus.js`.

## Milestone 3: Persistence

### Outputs

- Run metadata stored in database
- Agent messages stored in database
- Consensus rounds stored in database
- Final plan artifacts stored in database or file storage

### Acceptance Criteria

- A previous run can be inspected after completion.
- The audit trail is reconstructable.

### Status

Migration scaffold added at `supabase/migrations/202606040001_pos_runtime_audit.sql`. The runtime writes to Supabase when configured and returns an in-memory audit packet as a local fallback.

## Milestone 4: Memory and Knowledge

### Outputs

- Working memory store
- Long-term memory index
- Obsidian note references
- Drive/GitHub/local file references

### Acceptance Criteria

- The system can reference prior decisions and project context.

### Status

Implemented. Project memory exists, and the POS runtime now emits structured telemetry plus retryable persistence behavior as part of the Phase 4 hardening pass.

### Completion Note

Phases 0 through 4 are complete in the current codebase and verified against the fresh local build.

## Milestone 5: UX and Delivery

### Outputs

- Goal submission surface
- Run status surface
- Final action plan display
- Exportable plan artifact

### Acceptance Criteria

- The MVP is usable end-to-end by a human operator.

## Suggested Build Order

1. Define the schemas and agent contracts.
2. Build the orchestrator and consensus engine.
3. Persist runs and audit logs.
4. Add the final plan output format.
5. Add memory ingestion and references.
6. Add approvals and hardening.
