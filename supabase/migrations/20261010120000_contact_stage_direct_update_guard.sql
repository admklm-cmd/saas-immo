-- =============================================================================
-- AiaA — SEC-007: every change of `contacts.stage` goes through an audited path.
--
-- Problem (audit 2026-10-10, SEC-007): `20260923120000_contact_stage_change.sql`
-- protects the entry into / exit from `mandat_signe`, but every OTHER stage
-- change could still be made with a plain `UPDATE contacts SET stage = …`
-- through PostgREST, without the `contact_stage_changed` history entry that
-- `public.change_contact_stage` writes.
--
-- Rule enforced here, in the database:
--   a client session (`authenticated` or `anon` role, i.e. any request coming
--   through the Data API with the publishable key) may NEVER change
--   `contacts.stage` unless the one-shot grant of the current transaction
--   allows it (`private.has_contact_stage_grant`, see 20260923120000).
--
-- The audited paths that hold such a grant, or run as their trusted owner:
--   * humans: `public.change_contact_stage` (unchanged) — writes the
--     append-only `contact_stage_changed` activity;
--   * AI agents (Hugo, Sarah): `public.apply_agent_stage_change` (new, below)
--     — bound to a RUNNING `ai_agent_runs` row of that agent, for that contact,
--     started by the caller, which is the journal of the decision
--     (`ai_agent_runs` + `ai_agent_run_steps`). Only the documented transitions
--     of each agent are accepted; `mandat_signe` and `perdu` are never
--     reachable by an agent;
--   * the appointment workflow: `private.audit_appointment_lifecycle()` is
--     SECURITY DEFINER (runs as its owner, not as `authenticated`) and writes
--     its own `appointment_confirmed` activity in the same transaction;
--   * `service_role` (fixtures loader, test setup): a server-only secret,
--     never used in a user request path (CLAUDE.md). Not blocked here, exactly
--     like before; the `mandat_signe` guard still applies to it.
--
-- Why a role check rather than a grant everywhere: the appointment trigger
-- lives in an existing migration (never modified). A SECURITY DEFINER function
-- runs as its owner, so `current_user` is never `authenticated` there; a plain
-- PostgREST UPDATE always runs as `authenticated` (or `anon`). The check is
-- therefore exactly "the change comes straight from a client session".
--
-- Trigger order: Postgres fires BEFORE triggers alphabetically, so the
-- existing `guard_contact_mandate_stage` runs first and keeps its own,
-- more specific error for `mandat_signe` (`stage_mandate_change_requires_rpc`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Guard: no direct stage change from a client session.
--    SECURITY INVOKER on purpose: it must see the real `current_user`.
-- -----------------------------------------------------------------------------
create function private.guard_contact_stage_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage
     and current_user in ('authenticated', 'anon')
     and not private.has_contact_stage_grant(old.id) then
    raise exception 'stage_change_requires_rpc' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_contact_stage_change() from public;

create trigger guard_contact_stage_change before update on public.contacts
  for each row execute function private.guard_contact_stage_change();

-- -----------------------------------------------------------------------------
-- 2. Agent path: the only way an AI agent run moves a contact.
--
-- Returns true when the stage was changed, false when the contact is no longer
-- at `expected_stage` (optimistic lock: a human decision made while the agent
-- was working always wins). Raises a stable code otherwise.
--
-- The agent is NOT a parameter: it is read from the run row, so a caller
-- cannot claim to be Sarah with a Hugo run. Every authorisation comes from
-- `auth.uid()` and `private.member_agency_ids()`; a run of another agency is
-- indistinguishable from an unknown one.
-- -----------------------------------------------------------------------------
create function public.apply_agent_stage_change(
  target_contact uuid,
  agent_run uuid,
  expected_stage public.pipeline_stage,
  new_stage public.pipeline_stage
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  run_agency uuid;
  run_agent public.ai_agent_name;
  run_contact uuid;
  run_status public.ai_agent_run_status;
  run_owner uuid;
  current_stage public.pipeline_stage;
  takeover boolean;
  allowed boolean;
begin
  if caller is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_contact is null or agent_run is null or expected_stage is null or new_stage is null then
    raise exception 'stage_invalid_input' using errcode = '22023';
  end if;

  select r.agency_id, r.agent, r.contact_id, r.status, r.triggered_by_user_id
    into run_agency, run_agent, run_contact, run_status, run_owner
    from public.ai_agent_runs r
    where r.id = agent_run
      and r.agency_id in (select private.member_agency_ids());

  if not found
     or run_status <> 'running'
     or run_contact is distinct from target_contact
     or run_owner is distinct from caller then
    raise exception 'agent_run_invalid' using errcode = '42501';
  end if;

  -- Whitelist of transitions, per agent. Mirrors, deliberately in two places:
  --   Hugo  — features/agents-ia/hugo-qualification/decision.ts (forward only,
  --           from `nouveau`/`qualifie` to `qualifie`/`chaud`);
  --   Sarah — features/agents-ia/sarah-suivi/decision.ts (to
  --           `estimation_faite` only, from `qualifie`/`chaud`/`rdv_planifie`).
  -- Léa, Emma and Louis never move the pipeline. `mandat_signe` and `perdu`
  -- belong to a human, always.
  allowed := case run_agent
    when 'hugo' then
      (expected_stage = 'nouveau' and new_stage in ('qualifie', 'chaud'))
      or (expected_stage = 'qualifie' and new_stage = 'chaud')
    when 'sarah' then
      expected_stage in ('qualifie', 'chaud', 'rdv_planifie') and new_stage = 'estimation_faite'
    else false
  end;
  if not coalesce(allowed, false) then
    raise exception 'agent_stage_transition_forbidden' using errcode = '42501';
  end if;

  -- Kill switch, checked again at write time (the runner checked it at start).
  if exists (select 1 from public.agencies a where a.id = run_agency and a.ai_paused) then
    raise exception 'ai_paused' using errcode = 'P0001';
  end if;

  select c.stage, c.human_takeover
    into current_stage, takeover
    from public.contacts c
    where c.id = target_contact
      and c.agency_id = run_agency
    for update;

  if not found then
    raise exception 'contact_not_found' using errcode = '42501';
  end if;
  if takeover then
    raise exception 'human_takeover' using errcode = 'P0001';
  end if;
  if current_stage is distinct from expected_stage then
    return false;
  end if;

  insert into private.contact_stage_change_grants (contact_id) values (target_contact);

  update public.contacts c
    set stage = new_stage
    where c.id = target_contact;

  delete from private.contact_stage_change_grants g
    where g.tx_id = txid_current() and g.contact_id = target_contact;

  return true;
end;
$$;

revoke all on function public.apply_agent_stage_change(uuid, uuid, public.pipeline_stage, public.pipeline_stage)
  from public, anon, service_role;
grant execute on function public.apply_agent_stage_change(uuid, uuid, public.pipeline_stage, public.pipeline_stage)
  to authenticated;
