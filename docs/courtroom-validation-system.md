# Courtroom Validation System

Date: 2026-06-06
Status: implemented as a reusable service

## Purpose

The Courtroom Validation System validates ideas through a structured adversarial pipeline:

1. Warden
2. Grand Jury
3. Prosecution
4. Analysts
5. Defense Counsel
6. Tribunal
7. Executioner

The service returns structured outputs at each stage and a final verdict of `EXECUTE`, `REVISE`, or `ABANDON`.

## Service Surface

- `src/lib/cvs/service.js`
  - `createCourtroomValidationService(options)`
  - `runCourtroomValidation(input, options)`

- `src/app/api/cvs/route.js`
  - `POST /api/cvs` validates an idea and returns the stage outputs plus the final verdict.
  - `GET /api/cvs` returns recent courtroom history.

- `src/app/cvs/page.js`
  - UI entrypoint for submitting and reviewing ideas.

## Persistence Model

The service persists:

- Idea submissions
- Stage results
- Final verdicts
- Audit history

When an authenticated user is available, records are user-scoped. When no user is available, the service runs in memory and still returns a complete validation result.

## Provider Interface

The service is deterministic by default, but it exposes an injectable provider interface so future LLM-backed or policy-backed evaluators can be swapped in without rewriting the pipeline.

## Implementation Notes

The CVS reuses the repo’s existing Next.js + Supabase patterns:

- server route handlers under `src/app/api`
- service modules under `src/lib`
- node:test unit coverage
- Supabase migrations under `supabase/migrations`

