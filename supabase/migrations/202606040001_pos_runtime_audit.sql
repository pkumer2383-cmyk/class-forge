create table if not exists public.pos_runs (
  id text primary key,
  goal_id text not null,
  state text not null,
  goal text not null,
  context text default '',
  constraints jsonb not null default '[]'::jsonb,
  agents jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.pos_agent_messages (
  id text primary key,
  run_id text not null references public.pos_runs(id) on delete cascade,
  agent_id text not null,
  agent_type text not null,
  iteration integer not null,
  role text not null,
  content text not null,
  payload jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_consensus_rounds (
  id text primary key,
  run_id text not null references public.pos_runs(id) on delete cascade,
  round_number integer not null,
  status text not null,
  confidence_score numeric not null default 0,
  agreement_score numeric not null default 0,
  disagreements jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, round_number)
);

create table if not exists public.pos_artifacts (
  id text primary key,
  run_id text not null references public.pos_runs(id) on delete cascade,
  artifact_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_audit_events (
  id bigint generated always as identity primary key,
  run_id text not null references public.pos_runs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pos_runs_started_at_idx on public.pos_runs (started_at desc);
create index if not exists pos_agent_messages_run_iteration_idx on public.pos_agent_messages (run_id, iteration);
create index if not exists pos_consensus_rounds_run_round_idx on public.pos_consensus_rounds (run_id, round_number);
create index if not exists pos_artifacts_run_type_idx on public.pos_artifacts (run_id, artifact_type);
create index if not exists pos_audit_events_run_created_idx on public.pos_audit_events (run_id, created_at);

alter table public.pos_runs enable row level security;
alter table public.pos_agent_messages enable row level security;
alter table public.pos_consensus_rounds enable row level security;
alter table public.pos_artifacts enable row level security;
alter table public.pos_audit_events enable row level security;

grant select, insert on table public.pos_runs to authenticated;
grant select, insert on table public.pos_agent_messages to authenticated;
grant select, insert on table public.pos_consensus_rounds to authenticated;
grant select, insert on table public.pos_artifacts to authenticated;
grant select, insert on table public.pos_audit_events to authenticated;
grant usage, select on sequence public.pos_audit_events_id_seq to authenticated;

create policy "Authenticated users can read POS runs"
  on public.pos_runs for select
  to authenticated
  using (true);

create policy "Authenticated users can create POS runs"
  on public.pos_runs for insert
  to authenticated
  with check (true);

create policy "Authenticated users can read POS agent messages"
  on public.pos_agent_messages for select
  to authenticated
  using (true);

create policy "Authenticated users can create POS agent messages"
  on public.pos_agent_messages for insert
  to authenticated
  with check (true);

create policy "Authenticated users can read POS consensus rounds"
  on public.pos_consensus_rounds for select
  to authenticated
  using (true);

create policy "Authenticated users can create POS consensus rounds"
  on public.pos_consensus_rounds for insert
  to authenticated
  with check (true);

create policy "Authenticated users can read POS artifacts"
  on public.pos_artifacts for select
  to authenticated
  using (true);

create policy "Authenticated users can create POS artifacts"
  on public.pos_artifacts for insert
  to authenticated
  with check (true);

create policy "Authenticated users can read POS audit events"
  on public.pos_audit_events for select
  to authenticated
  using (true);

create policy "Authenticated users can create POS audit events"
  on public.pos_audit_events for insert
  to authenticated
  with check (true);
