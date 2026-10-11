-- =============================================================================
-- Agent activity summary — EXACT counters for the "Agents IA" screen
-- =============================================================================
-- CLAUDE.md: "statistiques calculées à partir des données réellement
-- enregistrées, jamais inventées."
--
-- The first implementation of the screen read the 500 most recent runs of the
-- agency and derived every figure from that sample. For any agency above that
-- volume the figures were silently WRONG: `runsToday` was under-counted while
-- being displayed next to `ai_daily_run_limit` (which can be raised to 10 000
-- runs per day), so an agency could believe it still had quota when it had
-- none. That is a false number presented as a true one.
--
-- Aggregating in SQL fixes it properly:
--   * exact counts, with no bound and no sample;
--   * one round trip instead of 5 agents x 2 windows x 5 statuses count
--     queries;
--   * the same `status <> 'blocked'` + `started_at >= <Paris day start>` filter
--     the run guard uses for the daily limit (private.guard_ai_agent_run), so
--     the number shown is the number the limit is actually counted on.
--
-- SECURITY INVOKER (the default, spelled out here on purpose): the row-level
-- security policies of `ai_agent_runs` are evaluated for the CALLER, so a
-- member of another agency gets an empty result exactly as with a direct
-- select. `target_agency` is filtered explicitly as well — defence in depth,
-- same pattern as every query of the application.
--
-- The window boundaries are passed by the caller rather than computed here:
-- the Europe/Paris day arithmetic lives in one single tested place
-- (lib/agents/time.ts) and is shared with the runner.

create function public.agent_activity_summary(
  target_agency uuid,
  day_start timestamptz,
  window_start timestamptz
)
returns table (
  agent_name public.ai_agent_name,
  today_total bigint,
  today_succeeded bigint,
  today_failed bigint,
  today_blocked bigint,
  today_running bigint,
  today_input_tokens bigint,
  today_output_tokens bigint,
  window_total bigint,
  window_succeeded bigint,
  window_failed bigint,
  window_blocked bigint,
  window_running bigint,
  window_input_tokens bigint,
  window_output_tokens bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.agent,
    count(*) filter (where r.started_at >= day_start),
    count(*) filter (where r.started_at >= day_start and r.status = 'succeeded'),
    count(*) filter (where r.started_at >= day_start and r.status = 'failed'),
    count(*) filter (where r.started_at >= day_start and r.status = 'blocked'),
    count(*) filter (where r.started_at >= day_start and r.status = 'running'),
    coalesce(sum(r.input_tokens) filter (where r.started_at >= day_start), 0),
    coalesce(sum(r.output_tokens) filter (where r.started_at >= day_start), 0),
    count(*),
    count(*) filter (where r.status = 'succeeded'),
    count(*) filter (where r.status = 'failed'),
    count(*) filter (where r.status = 'blocked'),
    count(*) filter (where r.status = 'running'),
    coalesce(sum(r.input_tokens), 0),
    coalesce(sum(r.output_tokens), 0)
  from public.ai_agent_runs r
  where r.agency_id = target_agency
    -- `least` keeps the function honest even if the caller inverts the two
    -- boundaries: the "today" figures are then a subset of the window ones.
    and r.started_at >= least(window_start, day_start)
  group by r.agent;
$$;

comment on function public.agent_activity_summary(uuid, timestamptz, timestamptz) is
  'Exact per-agent run counters of one agency over two windows (current Paris day, and a wider window). RLS of ai_agent_runs applies to the caller.';

revoke all on function public.agent_activity_summary(uuid, timestamptz, timestamptz) from public;
grant execute on function public.agent_activity_summary(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

-- Supports the per-agent reads of the screen: "last run of agent X" and "last
-- errors of agent X", which are dedicated queries (never a truncated scan).
create index ai_agent_runs_agency_id_agent_started_at_idx
  on public.ai_agent_runs (agency_id, agent, started_at desc);
