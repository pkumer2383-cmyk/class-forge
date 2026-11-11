alter table public.pos_runs
  add column if not exists user_id uuid;

create index if not exists pos_runs_user_started_idx
  on public.pos_runs (user_id, started_at desc);

drop policy if exists "Authenticated users can read POS runs" on public.pos_runs;
drop policy if exists "Authenticated users can create POS runs" on public.pos_runs;
drop policy if exists "Authenticated users can read POS agent messages" on public.pos_agent_messages;
drop policy if exists "Authenticated users can create POS agent messages" on public.pos_agent_messages;
drop policy if exists "Authenticated users can read POS consensus rounds" on public.pos_consensus_rounds;
drop policy if exists "Authenticated users can create POS consensus rounds" on public.pos_consensus_rounds;
drop policy if exists "Authenticated users can read POS artifacts" on public.pos_artifacts;
drop policy if exists "Authenticated users can create POS artifacts" on public.pos_artifacts;
drop policy if exists "Authenticated users can read POS audit events" on public.pos_audit_events;
drop policy if exists "Authenticated users can create POS audit events" on public.pos_audit_events;

create policy "Users can read their own POS runs"
  on public.pos_runs for select
  to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can create their own POS runs"
  on public.pos_runs for insert
  to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can read messages for their own POS runs"
  on public.pos_agent_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_agent_messages.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can create messages for their own POS runs"
  on public.pos_agent_messages for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_agent_messages.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can read consensus for their own POS runs"
  on public.pos_consensus_rounds for select
  to authenticated
  using (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_consensus_rounds.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can create consensus for their own POS runs"
  on public.pos_consensus_rounds for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_consensus_rounds.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can read artifacts for their own POS runs"
  on public.pos_artifacts for select
  to authenticated
  using (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_artifacts.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can create artifacts for their own POS runs"
  on public.pos_artifacts for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_artifacts.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can read audit events for their own POS runs"
  on public.pos_audit_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_audit_events.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );

create policy "Users can create audit events for their own POS runs"
  on public.pos_audit_events for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pos_runs
      where pos_runs.id = pos_audit_events.run_id
        and pos_runs.user_id = (select auth.uid())
    )
  );
