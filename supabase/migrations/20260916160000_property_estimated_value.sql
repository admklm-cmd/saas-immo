-- =============================================================================
-- AiaA — `properties`: estimated value of the property, in euros.
--
-- Why this column is special. A figure in euros is the one piece of data that
-- COMMITS THE AGENCY in front of a seller. CLAUDE.md is explicit: an AI agent
-- never invents a missing information, and no AI agent may ever produce this
-- number. So the column carries, together with the value itself:
--   * `estimated_value_source`      — where the figure comes from ('agency' =
--     estimated by the agency, 'owner_declared' = stated by the owner);
--   * `estimated_value_recorded_at` — when it was recorded (server clock);
--   * `estimated_value_recorded_by` — which member recorded it (server-stamped,
--     never trusted from the client — same pattern as
--     `outbound_messages.validated_by` and `tasks.completed_by`).
--
-- Rule enforced by the database, not only by the code: while an AI agent run
-- started by the caller is still OPEN (`ai_agent_runs.status = 'running'`), any
-- write to `estimated_value_eur` is REFUSED. This is the same binding as
-- `private.guard_activity_actor()` (20260916150000), read the other way round:
-- there, an AI-attributed history entry REQUIRES an open run of that agent;
-- here, a euro figure REQUIRES that no run of the caller is open.
--
-- Known limit (documented on purpose, see docs/architecture.md): the binding is
-- scoped to `triggered_by_user_id = auth.uid()`, i.e. to the session the agent
-- code runs under. It therefore blocks exactly the threat modelled here (the
-- agent's own execution path writing the figure). It does not attempt to block
-- an unrelated member of the same agency who happens to be typing a value at
-- the same second as a colleague's run: refusing that would be a false positive
-- with no security benefit. Server-side, `lib/agents/` never writes this column
-- for any agent, which is the first of the two lines of defence.
--
-- Trusted server tasks without a session (fixtures loader, service role,
-- `auth.uid()` is null) keep writing whatever they need, like everywhere else.
-- =============================================================================

alter table public.properties
  add column estimated_value_eur numeric(12, 2)
    check (estimated_value_eur > 0 and estimated_value_eur <= 100000000),
  -- Closed vocabulary: who produced the figure.
  add column estimated_value_source text
    check (estimated_value_source in ('agency', 'owner_declared')),
  add column estimated_value_recorded_at timestamptz,
  -- Not a foreign key, on purpose: this column is EVIDENCE of who recorded the
  -- figure. An `ON DELETE SET NULL` would silently rewrite it when the member
  -- leaves the agency (same reasoning as `consents.recorded_by`).
  add column estimated_value_recorded_by uuid,
  -- The value and its provenance live and die together: a figure without a
  -- source or without a date could never be justified to a seller.
  add constraint properties_estimated_value_consistent check (
    (estimated_value_eur is null) = (estimated_value_source is null)
    and (estimated_value_eur is null) = (estimated_value_recorded_at is null)
  ),
  add constraint properties_estimated_value_recorded_by_consistent check (
    estimated_value_recorded_by is null or estimated_value_recorded_at is not null
  );

-- Dashboard aggregates ("valeur estimée du portefeuille") only ever look at the
-- rows that actually carry a figure: a property without a value must be
-- displayed as "non estimé", never counted as zero.
create index properties_agency_id_estimated_value_idx
  on public.properties (agency_id)
  where estimated_value_eur is not null;

-- -----------------------------------------------------------------------------
-- Guard: no AI write, server-stamped provenance, frozen evidence.
-- SECURITY DEFINER: it must read `ai_agent_runs` whatever the caller's RLS.
-- -----------------------------------------------------------------------------
create function private.guard_property_estimated_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  value_changed boolean;
begin
  value_changed := case
    when tg_op = 'INSERT' then new.estimated_value_eur is not null
    else new.estimated_value_eur is distinct from old.estimated_value_eur
  end;

  -- The figure does not move. Nothing to guard: an agent may perfectly well
  -- create or update a property (Hugo fills in the type, the city, the sector)
  -- as long as it does not touch the euro amount.
  if not value_changed then
    -- On UPDATE, the provenance of the existing figure is evidence and cannot
    -- be rewritten. Clearing `estimated_value_recorded_by` stays possible (no
    -- FK action today, but a future GDPR erasure of a member must not be
    -- blocked by this trigger).
    if tg_op = 'UPDATE' then
      new.estimated_value_source := old.estimated_value_source;
      new.estimated_value_recorded_at := old.estimated_value_recorded_at;
      if new.estimated_value_recorded_by is not null
         and new.estimated_value_recorded_by is distinct from old.estimated_value_recorded_by then
        raise exception 'estimated_value_stamp_immutable' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  -- The figure moves (set, changed or cleared). Never while an AI run of this
  -- session is open: a euro amount is not something an AI agent may produce.
  if caller is not null and exists (
    select 1
    from public.ai_agent_runs r
    where r.agency_id = new.agency_id
      and r.status = 'running'
      and r.triggered_by_user_id = caller
  ) then
    raise exception 'estimated_value_ai_write_refused' using errcode = '42501';
  end if;

  if new.estimated_value_eur is null then
    new.estimated_value_source := null;
    new.estimated_value_recorded_at := null;
    new.estimated_value_recorded_by := null;
    return new;
  end if;

  if caller is not null then
    if new.estimated_value_recorded_by is not null and new.estimated_value_recorded_by <> caller then
      raise exception 'estimated_value_recorded_by_must_be_caller' using errcode = '42501';
    end if;
    new.estimated_value_recorded_by := caller;
  end if;

  -- Always the server clock: a client-supplied date is ignored.
  new.estimated_value_recorded_at := now();
  return new;
end;
$$;

revoke all on function private.guard_property_estimated_value() from public;

create trigger guard_property_estimated_value before insert or update on public.properties
  for each row execute function private.guard_property_estimated_value();
