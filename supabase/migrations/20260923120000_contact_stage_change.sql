-- =============================================================================
-- AiaA — human change of a contact's pipeline stage, with a database guard on
-- `mandat_signe`.
--
-- Problem: `contacts_update_members` lets any member UPDATE `contacts.stage`
-- directly (PostgREST), so anyone could declare — or silently undo — a signed
-- mandate, with no trace. CLAUDE.md: a signed mandate is ALWAYS confirmed by a
-- human, never declared by an AI agent, and its history is kept.
--
-- Rules (validated by the user, 2026-09-23):
--   * a member may move a contact of THEIR agency to any pipeline stage;
--   * entering `mandat_signe` requires an explicit human confirmation
--     (`mandate_confirmed = true`, from a checkbox ticked by the user);
--   * only a DIRECTOR may move a contact out of `mandat_signe`, with an
--     explicit confirmation AND a recorded motive (3..500 chars, no control
--     character);
--   * every change made through `public.change_contact_stage` writes an
--     append-only `activities` row (`contact_stage_changed`): human actor,
--     stage before, stage after, motive, server time.
--
-- How the guard cannot be bypassed:
--   * `private.guard_contact_mandate_stage` (BEFORE INSERT OR UPDATE on
--     contacts) refuses any transition INTO or OUT OF `mandat_signe` that is
--     not authorised by `public.change_contact_stage`, for every
--     non-superuser role — `service_role` and `postgres` included, like the
--     existing append-only guards. Only exception: an INSERT without session
--     (service role: fixtures loader, seed), which creates a row, it does not
--     move one.
--   * The authorisation is NOT a GUC flag. `set_config()` is executable by
--     PUBLIC: PostgREST does not expose it (only `public`/`graphql_public`
--     are exposed), but any role that one day gets a SQL connection could set
--     a flag. Instead, the RPC writes a one-shot grant row
--     (transaction id + contact id) into `private.contact_stage_change_grants`,
--     a table on which NO client role has any privilege. The row is removed
--     before the RPC returns, and a failed RPC rolls it back with everything
--     else. A grant is therefore only ever visible inside the transaction of
--     the RPC call itself, for the one contact it locked.
--   * The `contact_stage_changed` activity type is reserved to that same path
--     (`private.guard_stage_change_activity`): a member can no longer forge a
--     "mandat signé" entry in the history with a plain INSERT.
--
-- Why `change_contact_stage` is SECURITY DEFINER (search_path = ''):
--   it must write into the private grant table, which no client role may
--   touch. Every authorisation decision is taken inside the function from
--   `auth.uid()` and `private.member_agency_ids()` / `has_agency_role()`, never
--   from a parameter; the contact row is selected ONLY among the caller's
--   agencies, so a non-member gets the same "not found" answer as for an
--   unknown id and cannot even lock another agency's row.
--
-- Existing paths keep working: Hugo (nouveau/qualifie -> qualifie/chaud), the
-- appointment workflow (qualifie/chaud -> rdv_planifie) and Sarah
-- (-> estimation_faite) never enter nor leave `mandat_signe`, and an UPDATE of
-- other columns of a signed contact is untouched (the stage does not change).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- One-shot grants (private, no client privilege)
-- -----------------------------------------------------------------------------
create table private.contact_stage_change_grants (
  tx_id bigint not null default txid_current(),
  contact_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tx_id, contact_id)
);
alter table private.contact_stage_change_grants enable row level security;
revoke all on table private.contact_stage_change_grants from public, anon, authenticated, service_role;

-- True only inside the transaction of `change_contact_stage`, for the contact
-- it is changing. SECURITY DEFINER: reads the private grant table; returns a
-- boolean and nothing else.
create function private.has_contact_stage_grant(target_contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.contact_stage_change_grants g
    where g.tx_id = txid_current()
      and g.contact_id = target_contact
  );
$$;
revoke all on function private.has_contact_stage_grant(uuid) from public;
grant execute on function private.has_contact_stage_grant(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Guard on contacts: no entry into / exit from `mandat_signe` outside the RPC.
-- SECURITY INVOKER on purpose: the superuser check must see the real caller
-- (same pattern as private.prevent_append_only_change).
-- -----------------------------------------------------------------------------
create function private.guard_contact_mandate_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_superuser boolean;
begin
  select r.rolsuper into is_superuser from pg_catalog.pg_roles r where r.rolname = current_user;
  if coalesce(is_superuser, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A session may never create a contact already "signed". A trusted
    -- server task without session (fixtures loader) creates rows, it does
    -- not move a file through the pipeline.
    if new.stage = 'mandat_signe' and (select auth.uid()) is not null then
      raise exception 'stage_mandate_change_requires_rpc' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.stage is distinct from old.stage
     and (new.stage = 'mandat_signe' or old.stage = 'mandat_signe')
     and not private.has_contact_stage_grant(old.id) then
    raise exception 'stage_mandate_change_requires_rpc' using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_contact_mandate_stage() from public;

create trigger guard_contact_mandate_stage before insert or update on public.contacts
  for each row execute function private.guard_contact_mandate_stage();

-- -----------------------------------------------------------------------------
-- Guard on activities: the stage-change trace can only be written by the RPC.
-- -----------------------------------------------------------------------------
create function private.guard_stage_change_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_superuser boolean;
begin
  if new.type <> 'contact_stage_changed' then
    return new;
  end if;

  select r.rolsuper into is_superuser from pg_catalog.pg_roles r where r.rolname = current_user;
  if coalesce(is_superuser, false) then
    return new;
  end if;

  if new.contact_id is null or not private.has_contact_stage_grant(new.contact_id) then
    raise exception 'activity_type_reserved' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_stage_change_activity() from public;

create trigger guard_stage_change_activity before insert on public.activities
  for each row execute function private.guard_stage_change_activity();

-- -----------------------------------------------------------------------------
-- RPC: the only way to enter or leave `mandat_signe`.
-- -----------------------------------------------------------------------------
create function public.change_contact_stage(
  target_contact uuid,
  new_stage public.pipeline_stage,
  mandate_confirmed boolean default false,
  reason text default null
)
returns table (
  contact_id uuid,
  previous_stage public.pipeline_stage,
  current_stage public.pipeline_stage,
  activity_id uuid,
  changed_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  contact_agency uuid;
  old_stage public.pipeline_stage;
  clean_reason text;
  caller_role public.membership_role;
  entry_summary text;
  new_activity uuid;
  -- Same allowed set as CONTROL_CHARACTER_PATTERN (lib/claude/schemas.ts):
  -- tab, LF and CR are tolerated in a motive typed in a text area, every
  -- other C0 byte and DEL is refused. Built with chr() so this file stays
  -- plain, reviewable ASCII (see 20260923090000_inbound_lead_text_guard.sql).
  control_class constant text :=
    '[' || chr(1) || '-' || chr(8) || chr(11) || chr(12) || chr(14) || '-' || chr(31) || chr(127) || ']';
  stage_labels constant jsonb := jsonb_build_object(
    'nouveau', 'Nouveau',
    'qualifie', 'Qualifié',
    'chaud', 'Chaud',
    'rdv_planifie', 'RDV planifié',
    'estimation_faite', 'Estimation faite',
    'mandat_signe', 'Mandat signé',
    'perdu', 'Perdu'
  );
begin
  if caller is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_contact is null or new_stage is null then
    raise exception 'stage_invalid_input' using errcode = '22023';
  end if;

  -- Only among the caller's agencies: a contact of another agency is
  -- indistinguishable from an unknown one, and is never locked.
  -- FOR UPDATE: two concurrent calls (double click) are serialised; the
  -- second one sees the new stage and stops on `stage_unchanged`.
  select c.agency_id, c.stage
    into contact_agency, old_stage
    from public.contacts c
    where c.id = target_contact
      and c.agency_id in (select private.member_agency_ids())
    for update;

  if not found then
    raise exception 'contact_not_found' using errcode = '42501';
  end if;

  select m.role into caller_role
    from public.memberships m
    where m.agency_id = contact_agency and m.user_id = caller;

  if old_stage = new_stage then
    raise exception 'stage_unchanged' using errcode = 'P0001';
  end if;

  -- Motive: optional, trimmed, 3..500 characters, no control character.
  if reason is not null then
    clean_reason := btrim(reason);
    if clean_reason = '' then
      clean_reason := null;
    elsif clean_reason ~ control_class or char_length(clean_reason) not between 3 and 500 then
      raise exception 'stage_reason_invalid' using errcode = '22023';
    end if;
  end if;

  if new_stage = 'mandat_signe' and mandate_confirmed is not true then
    raise exception 'stage_mandate_confirmation_required' using errcode = 'P0001';
  end if;

  if old_stage = 'mandat_signe' then
    if not private.has_agency_role(contact_agency, 'director') then
      raise exception 'stage_mandate_exit_director_only' using errcode = '42501';
    end if;
    if mandate_confirmed is not true then
      raise exception 'stage_mandate_exit_confirmation_required' using errcode = 'P0001';
    end if;
    if clean_reason is null then
      raise exception 'stage_reason_required' using errcode = 'P0001';
    end if;
  end if;

  -- One-shot authorisation for the guard triggers, scoped to this
  -- transaction and this contact, removed before returning.
  insert into private.contact_stage_change_grants (contact_id) values (target_contact);

  update public.contacts c
    set stage = new_stage
    where c.id = target_contact;

  entry_summary := case
    when new_stage = 'mandat_signe' then
      'Mandat signé confirmé par un membre de l''agence (' || (stage_labels ->> old_stage::text)
      || ' → Mandat signé).'
    when old_stage = 'mandat_signe' then
      'Dossier sorti de « Mandat signé » par un directeur (→ ' || (stage_labels ->> new_stage::text)
      || '). Motif : ' || clean_reason
    else
      'Étape du pipeline modifiée par un membre de l''agence : ' || (stage_labels ->> old_stage::text)
      || ' → ' || (stage_labels ->> new_stage::text) || '.'
  end;

  insert into public.activities (
    agency_id, contact_id, type, summary, payload, actor_type, actor_user_id, is_simulation
  ) values (
    contact_agency,
    target_contact,
    'contact_stage_changed',
    entry_summary,
    jsonb_build_object(
      'previous_stage', old_stage,
      'stage', new_stage,
      'mandate_confirmed', coalesce(mandate_confirmed, false),
      'reason', clean_reason,
      'actor_role', caller_role
    ),
    'user',
    caller,
    -- A human CRM decision: nothing is sent, nothing is simulated.
    false
  )
  returning id into new_activity;

  delete from private.contact_stage_change_grants g
    where g.tx_id = txid_current() and g.contact_id = target_contact;

  return query select target_contact, old_stage, new_stage, new_activity, now();
end;
$$;

revoke all on function public.change_contact_stage(uuid, public.pipeline_stage, boolean, text)
  from public, anon, service_role;
grant execute on function public.change_contact_stage(uuid, public.pipeline_stage, boolean, text)
  to authenticated;
