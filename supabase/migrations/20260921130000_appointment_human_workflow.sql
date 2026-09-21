-- Human appointment workflow: Louis proposes, a member confirms, then a
-- member records the completed meeting before Sarah may use its report.
--
-- The lifecycle, CRM stage and append-only audit are kept in one database
-- transaction. An authenticated client therefore cannot change only one part
-- of the business event, even if it bypasses the server action.

create function private.guard_appointment_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  contact_stage public.pipeline_stage;
begin
  -- Trusted fixture loaders and server maintenance use the service role and
  -- have no auth.uid(). Application requests always have one.
  if caller is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'proposed'
       or new.report_notes is not null
       or new.report_recorded_by is not null
       or new.report_recorded_at is not null then
      raise exception 'appointment_must_start_proposed' using errcode = '42501';
    end if;
    if not new.is_simulation then
      raise exception 'appointment_must_be_simulation' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.agency_id is distinct from old.agency_id
     or new.contact_id is distinct from old.contact_id
     or new.property_id is distinct from old.property_id
     or new.assigned_user_id is distinct from old.assigned_user_id
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.is_simulation is distinct from old.is_simulation
     or new.created_at is distinct from old.created_at then
    raise exception 'appointment_identity_immutable' using errcode = '42501';
  end if;

  if old.status = 'proposed' and new.status not in ('proposed', 'confirmed', 'cancelled') then
    raise exception 'appointment_invalid_transition' using errcode = '42501';
  elsif old.status = 'confirmed' and new.status not in ('confirmed', 'done', 'cancelled') then
    raise exception 'appointment_invalid_transition' using errcode = '42501';
  elsif old.status in ('cancelled', 'done') then
    raise exception 'appointment_terminal' using errcode = '42501';
  end if;

  -- A report is evidence of a completed appointment. It is recorded in the
  -- same UPDATE as the `confirmed -> done` transition, never before or after.
  if new.status = 'done' then
    if old.status <> 'confirmed' or new.report_notes is null
       or char_length(btrim(new.report_notes)) = 0 then
      raise exception 'appointment_report_required_for_completion' using errcode = '23514';
    end if;
    new.report_notes := btrim(new.report_notes);
  elsif new.report_notes is distinct from old.report_notes then
    raise exception 'appointment_report_only_on_completion' using errcode = '42501';
  end if;

  if old.status = 'proposed' and new.status = 'confirmed' then
    select c.stage into contact_stage
    from public.contacts c
    where c.agency_id = new.agency_id and c.id = new.contact_id
    for update;

    if contact_stage not in ('qualifie', 'chaud', 'rdv_planifie') then
      raise exception 'appointment_contact_stage_not_confirmable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_appointment_lifecycle() from public;

-- Alphabetically before guard_appointment_report: lifecycle validation sees
-- the human text, then the existing report guard stamps its author and time.
create trigger guard_appointment_lifecycle
before insert or update on public.appointments
for each row execute function private.guard_appointment_lifecycle();

create function private.audit_appointment_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or new.status = old.status then
    return new;
  end if;

  if old.status = 'proposed' and new.status = 'confirmed' then
    update public.contacts
      set stage = 'rdv_planifie'
      where agency_id = new.agency_id
        and id = new.contact_id
        and stage in ('qualifie', 'chaud');

    insert into public.activities (
      agency_id, contact_id, type, summary, payload,
      actor_type, actor_user_id, is_simulation
    ) values (
      new.agency_id, new.contact_id, 'appointment_confirmed',
      'Rendez-vous d''estimation confirmé par un membre de l''agence.',
      jsonb_build_object('appointment_id', new.id, 'status', new.status),
      'user', caller, new.is_simulation
    );
  elsif old.status = 'confirmed' and new.status = 'done' then
    insert into public.activities (
      agency_id, contact_id, type, summary, payload,
      actor_type, actor_user_id, is_simulation
    ) values (
      new.agency_id, new.contact_id, 'appointment_completed',
      'Rendez-vous d''estimation réalisé et compte-rendu saisi par un membre de l''agence.',
      jsonb_build_object(
        'appointment_id', new.id,
        'status', new.status,
        'report_recorded_by', new.report_recorded_by,
        'report_chars', char_length(new.report_notes)
      ),
      'user', caller, new.is_simulation
    );
  elsif new.status = 'cancelled' then
    insert into public.activities (
      agency_id, contact_id, type, summary, payload,
      actor_type, actor_user_id, is_simulation
    ) values (
      new.agency_id, new.contact_id, 'appointment_cancelled',
      'Rendez-vous d''estimation annulé par un membre de l''agence.',
      jsonb_build_object('appointment_id', new.id, 'previous_status', old.status),
      'user', caller, new.is_simulation
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_appointment_lifecycle() from public;

create trigger audit_appointment_lifecycle
after update on public.appointments
for each row execute function private.audit_appointment_lifecycle();
