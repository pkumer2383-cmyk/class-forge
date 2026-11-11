create table if not exists public.cvs_idea_submissions (
  id text primary key,
  user_id uuid,
  title text not null,
  idea_summary text not null,
  primary_goal text not null,
  success_metrics jsonb not null default '[]'::jsonb,
  known_constraints jsonb not null default '[]'::jsonb,
  key_assumptions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  stakeholders jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  context text default '',
  target_audience text default '',
  timeline text default '',
  budget text default '',
  submitted_by text default '',
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.cvs_stage_results (
  id text primary key,
  submission_id text not null references public.cvs_idea_submissions(id) on delete cascade,
  user_id uuid,
  stage_name text not null,
  decision text not null,
  score numeric not null default 0,
  confidence numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (submission_id, stage_name)
);

create table if not exists public.cvs_final_verdicts (
  id text primary key,
  submission_id text not null references public.cvs_idea_submissions(id) on delete cascade,
  user_id uuid,
  verdict text not null,
  confidence_score numeric not null default 0,
  primary_reason text not null default '',
  required_next_actions jsonb not null default '[]'::jsonb,
  revisions_required jsonb not null default '[]'::jsonb,
  implementation_roadmap jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (submission_id)
);

create table if not exists public.cvs_audit_history (
  id bigint generated always as identity primary key,
  submission_id text not null references public.cvs_idea_submissions(id) on delete cascade,
  user_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cvs_idea_submissions_submitted_at_idx on public.cvs_idea_submissions (submitted_at desc);
create index if not exists cvs_idea_submissions_user_submitted_idx on public.cvs_idea_submissions (user_id, submitted_at desc);
create index if not exists cvs_stage_results_submission_stage_idx on public.cvs_stage_results (submission_id, stage_name);
create index if not exists cvs_stage_results_user_created_idx on public.cvs_stage_results (user_id, created_at desc);
create index if not exists cvs_final_verdicts_user_created_idx on public.cvs_final_verdicts (user_id, created_at desc);
create index if not exists cvs_audit_history_submission_created_idx on public.cvs_audit_history (submission_id, created_at desc);

alter table public.cvs_idea_submissions enable row level security;
alter table public.cvs_stage_results enable row level security;
alter table public.cvs_final_verdicts enable row level security;
alter table public.cvs_audit_history enable row level security;

grant select, insert on table public.cvs_idea_submissions to authenticated;
grant select, insert on table public.cvs_stage_results to authenticated;
grant select, insert on table public.cvs_final_verdicts to authenticated;
grant select, insert on table public.cvs_audit_history to authenticated;
grant usage, select on sequence public.cvs_audit_history_id_seq to authenticated;

create policy "Users can read their own CVS submissions"
  on public.cvs_idea_submissions for select
  to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can create their own CVS submissions"
  on public.cvs_idea_submissions for insert
  to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can read their own CVS stage results"
  on public.cvs_stage_results for select
  to authenticated
  using (
    exists (
      select 1
      from public.cvs_idea_submissions
      where cvs_idea_submissions.id = cvs_stage_results.submission_id
        and cvs_idea_submissions.user_id = (select auth.uid())
    )
  );

create policy "Users can create their own CVS stage results"
  on public.cvs_stage_results for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.cvs_idea_submissions
      where cvs_idea_submissions.id = cvs_stage_results.submission_id
        and cvs_idea_submissions.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own CVS final verdicts"
  on public.cvs_final_verdicts for select
  to authenticated
  using (
    exists (
      select 1
      from public.cvs_idea_submissions
      where cvs_idea_submissions.id = cvs_final_verdicts.submission_id
        and cvs_idea_submissions.user_id = (select auth.uid())
    )
  );

create policy "Users can create their own CVS final verdicts"
  on public.cvs_final_verdicts for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.cvs_idea_submissions
      where cvs_idea_submissions.id = cvs_final_verdicts.submission_id
        and cvs_idea_submissions.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own CVS audit history"
  on public.cvs_audit_history for select
  to authenticated
  using (
    exists (
      select 1
      from public.cvs_idea_submissions
      where cvs_idea_submissions.id = cvs_audit_history.submission_id
        and cvs_idea_submissions.user_id = (select auth.uid())
    )
  );

create policy "Users can create their own CVS audit history"
  on public.cvs_audit_history for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.cvs_idea_submissions
      where cvs_idea_submissions.id = cvs_audit_history.submission_id
        and cvs_idea_submissions.user_id = (select auth.uid())
    )
  );

revoke all on table public.cvs_idea_submissions from anon;
revoke all on table public.cvs_stage_results from anon;
revoke all on table public.cvs_final_verdicts from anon;
revoke all on table public.cvs_audit_history from anon;

revoke all on table public.cvs_idea_submissions from authenticated;
revoke all on table public.cvs_stage_results from authenticated;
revoke all on table public.cvs_final_verdicts from authenticated;
revoke all on table public.cvs_audit_history from authenticated;

grant select, insert on table public.cvs_idea_submissions to authenticated;
grant select, insert on table public.cvs_stage_results to authenticated;
grant select, insert on table public.cvs_final_verdicts to authenticated;
grant select, insert on table public.cvs_audit_history to authenticated;

revoke all on sequence public.cvs_audit_history_id_seq from anon;
revoke all on sequence public.cvs_audit_history_id_seq from authenticated;
grant usage, select on sequence public.cvs_audit_history_id_seq to authenticated;
