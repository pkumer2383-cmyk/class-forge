revoke all on table public.pos_runs from anon;
revoke all on table public.pos_agent_messages from anon;
revoke all on table public.pos_consensus_rounds from anon;
revoke all on table public.pos_artifacts from anon;
revoke all on table public.pos_audit_events from anon;

revoke all on table public.pos_runs from authenticated;
revoke all on table public.pos_agent_messages from authenticated;
revoke all on table public.pos_consensus_rounds from authenticated;
revoke all on table public.pos_artifacts from authenticated;
revoke all on table public.pos_audit_events from authenticated;

grant select, insert on table public.pos_runs to authenticated;
grant select, insert on table public.pos_agent_messages to authenticated;
grant select, insert on table public.pos_consensus_rounds to authenticated;
grant select, insert on table public.pos_artifacts to authenticated;
grant select, insert on table public.pos_audit_events to authenticated;

revoke all on sequence public.pos_audit_events_id_seq from anon;
revoke all on sequence public.pos_audit_events_id_seq from authenticated;
grant usage, select on sequence public.pos_audit_events_id_seq to authenticated;
