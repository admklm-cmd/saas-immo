-- =============================================================================
-- AiaA — `ai_agent_run_steps`: the detailed, REAL journal of one AI run.
--
-- Why this table exists. The agency must be able to WATCH its agents work, step
-- by step, and not only read a final verdict. The UI replays an execution in an
-- animated way — and that replay is only acceptable if it is built on steps
-- that were ACTUALLY recorded, with timestamps that were ACTUALLY measured.
-- Fabricating a progress bar or inventing durations in the browser would be
-- staging, i.e. exactly the confusion between the simulated and the real that
-- CLAUDE.md forbids. The simulator is not fake: its inputs, its outputs and the
-- time it takes are all measurable, and that is what is stored here.
--
-- `duration_ms` is therefore NEVER taken from the client: it is computed by the
-- database from `started_at` and `finished_at` (trigger below).
--
-- Phases mirror what the code really does (see lib/agents/runner.ts):
--   guardrails → context_loaded → prompt_built → ai_call → output_validated
--   → decision → persisted
-- A blocked run (kill switch, daily limit, human takeover) produces at least
-- one `guardrails` step with status `blocked` and the reason: the user must see
-- WHY it stopped.
--
-- Same principles as every other business table:
--   * agency_id on the row, immutable after creation (trigger);
--   * RLS enabled, members of the agency only;
--   * `anon` has no privilege at all;
--   * cross-agency integrity via the composite foreign key (agency_id, run_id);
--   * APPEND-ONLY, like `consents` and `activities`: UPDATE, DELETE and
--     TRUNCATE are refused to every non-superuser role, service_role included.
--     A journal that can be rewritten is not a journal.
-- =============================================================================

-- Required by the composite foreign key below: a step of agency A can only ever
-- point to a run of agency A, even if RLS were misconfigured.
alter table public.ai_agent_runs
  add constraint ai_agent_runs_agency_id_id_key unique (agency_id, id);

create type public.ai_agent_run_phase as enum (
  'guardrails',        -- kill switch, daily volume, human takeover, ownership
  'context_loaded',    -- CRM data read
  'prompt_built',      -- prompt assembled, untrusted prospect text isolated
  'ai_call',           -- call to the AI provider (today: the simulator)
  'output_validated',  -- zod schema accepted or rejected the output
  'decision',          -- decision taken BY THE CODE
  'persisted'          -- writes performed
);

create type public.ai_agent_run_step_status as enum ('ok', 'blocked', 'failed', 'skipped');

create table public.ai_agent_run_steps (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  run_id uuid not null,
  -- Position in the run, 0-based. Unique per run: no two steps can claim the
  -- same rank, so the replay order is unambiguous.
  step_index smallint not null check (step_index between 0 and 200),
  phase public.ai_agent_run_phase not null,
  -- Short French label, meant to be displayed as-is by the UI.
  label text not null check (char_length(label) between 1 and 200),
  status public.ai_agent_run_step_status not null,
  -- Displayable summary of the step: counts, codes, flags. Never the prospect's
  -- free text (personal data), same rule as `ai_agent_runs.input`.
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  -- Computed by the database from the two timestamps above (trigger).
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  constraint ai_agent_run_steps_run_fkey foreign key (agency_id, run_id)
    references public.ai_agent_runs (agency_id, id) on delete cascade,
  constraint ai_agent_run_steps_index_key unique (run_id, step_index),
  constraint ai_agent_run_steps_time_range check (
    finished_at >= started_at and finished_at <= started_at + interval '1 hour'
  )
);

create index ai_agent_run_steps_run_idx
  on public.ai_agent_run_steps (agency_id, run_id, step_index);
create index ai_agent_run_steps_agency_id_started_at_idx
  on public.ai_agent_run_steps (agency_id, started_at desc);

-- -----------------------------------------------------------------------------
-- Insert stamp: the duration is measured, never declared.
-- -----------------------------------------------------------------------------
create function private.stamp_ai_agent_run_step()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := clock_timestamp();

  -- A step cannot be dated in the future (5-minute tolerance for clock skew
  -- between the application server and the database, same as activities).
  if new.finished_at > now() + interval '5 minutes' then
    raise exception 'ai_agent_run_step_in_future' using errcode = '23514';
  end if;

  -- Whatever the client sent is discarded: the duration IS the measurement.
  new.duration_ms := greatest(
    0,
    floor(extract(epoch from (new.finished_at - new.started_at)) * 1000)::integer
  );
  return new;
end;
$$;

revoke all on function private.stamp_ai_agent_run_step() from public;

create trigger stamp_ai_agent_run_step before insert on public.ai_agent_run_steps
  for each row execute function private.stamp_ai_agent_run_step();

create trigger prevent_agency_id_change before update on public.ai_agent_run_steps
  for each row execute function private.prevent_agency_id_change();

-- Append-only, exactly like consents and activities.
create trigger ai_agent_run_steps_append_only before update or delete on public.ai_agent_run_steps
  for each row execute function private.prevent_append_only_change();
create trigger ai_agent_run_steps_no_truncate before truncate on public.ai_agent_run_steps
  for each statement execute function private.prevent_truncate();

-- -----------------------------------------------------------------------------
-- Privileges: nothing for anon, read + append for authenticated.
-- -----------------------------------------------------------------------------
revoke all on table public.ai_agent_run_steps from anon, authenticated;
grant select, insert on table public.ai_agent_run_steps to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.ai_agent_run_steps enable row level security;

create policy "ai_agent_run_steps_select_members" on public.ai_agent_run_steps
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "ai_agent_run_steps_insert_members" on public.ai_agent_run_steps
  for insert to authenticated
  with check (agency_id in (select private.member_agency_ids()));
