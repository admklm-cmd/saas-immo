-- =============================================================================
-- AiaA — `appointments`: report of the estimation meeting (input of Sarah).
--
-- Sarah (suivi) works from what REALLY happened during the appointment. The
-- report is written by a human of the agency; Sarah only reads it and prepares
-- the follow-up. A mandate is never auto-declared by an AI agent (CLAUDE.md).
--
-- `report_recorded_by` and `report_recorded_at` are EVIDENCE: they are stamped
-- by the server and never accepted from the client. This is the pattern the
-- security audit asked to reuse systematically for any column that proves who
-- did something (`outbound_messages.validated_by`, `tasks.completed_by`,
-- `activities.is_simulation`, `properties.estimated_value_recorded_by`).
--
-- Consistency: the three columns are filled together or absent together.
-- `report_recorded_by` is deliberately NOT a foreign key — an `ON DELETE SET
-- NULL` would silently erase the evidence when the member leaves the agency,
-- and would break the all-or-nothing constraint. Same reasoning, and same
-- trade-off, as `consents.recorded_by`.
-- =============================================================================

alter table public.appointments
  add column report_notes text check (char_length(report_notes) between 1 and 5000),
  add column report_recorded_by uuid,
  add column report_recorded_at timestamptz,
  add constraint appointments_report_consistent check (
    (report_notes is null and report_recorded_by is null and report_recorded_at is null)
    or (report_notes is not null and report_recorded_by is not null and report_recorded_at is not null)
  );

-- "Les rendez-vous dont le compte-rendu est écrit / manquant", per agency.
create index appointments_agency_id_report_recorded_at_idx
  on public.appointments (agency_id, report_recorded_at desc)
  where report_notes is not null;

-- -----------------------------------------------------------------------------
-- Guard: the server stamps who wrote the report and when.
-- -----------------------------------------------------------------------------
create function private.guard_appointment_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  notes_changed boolean;
begin
  notes_changed := case
    when tg_op = 'INSERT' then new.report_notes is not null
    else new.report_notes is distinct from old.report_notes
  end;

  -- Untouched report: its stamps are evidence, they cannot be rewritten.
  if tg_op = 'UPDATE' and not notes_changed then
    new.report_recorded_by := old.report_recorded_by;
    new.report_recorded_at := old.report_recorded_at;
    return new;
  end if;

  if new.report_notes is null then
    new.report_recorded_by := null;
    new.report_recorded_at := null;
    return new;
  end if;

  if caller is not null then
    if new.report_recorded_by is not null and new.report_recorded_by <> caller then
      raise exception 'report_recorded_by_must_be_caller' using errcode = '42501';
    end if;
    new.report_recorded_by := caller;
  elsif new.report_recorded_by is null then
    -- Trusted server task without a session (fixtures loader, service role):
    -- it must still say who wrote the report, the constraint requires it.
    raise exception 'report_recorded_by_required' using errcode = '23514';
  end if;

  -- Always the server clock: a client-supplied date is ignored.
  new.report_recorded_at := now();
  return new;
end;
$$;

revoke all on function private.guard_appointment_report() from public;

create trigger guard_appointment_report before insert or update on public.appointments
  for each row execute function private.guard_appointment_report();
