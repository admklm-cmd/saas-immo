-- Security hardening: immutable provenance, bounded lead payloads and atomic
-- human-decision audit entries. Service-role maintenance keeps its existing
-- privileges; the stricter rules below apply to authenticated sessions.

alter table public.inbound_leads
  add constraint inbound_leads_payload_size
  check (pg_column_size(payload) <= 65536);

alter table public.outbound_messages
  add column rejection_reason text,
  add column rejection_reason_label text,
  add column rejection_note text,
  add constraint outbound_messages_rejection_reason_allowed check (
    rejection_reason is null or rejection_reason in (
      'incorrect_information', 'inappropriate_tone', 'bad_timing',
      'consent_doubt', 'handled_by_human', 'already_contacted', 'other'
    )
  ),
  add constraint outbound_messages_rejection_note_length check (
    rejection_note is null or char_length(rejection_note) <= 300
  ),
  add constraint outbound_messages_rejection_consistent check (
    status = 'rejected' or (
      rejection_reason is null and rejection_reason_label is null and rejection_note is null
    )
  );

create function private.guard_outbound_message_state()
returns trigger language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.status = 'rejected' and new.rejection_reason is null then
      raise exception 'outbound_message_rejection_reason_required' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.agency_id is distinct from old.agency_id
     or new.contact_id is distinct from old.contact_id
     or new.channel is distinct from old.channel
     or new.created_by_agent is distinct from old.created_by_agent
     or new.is_simulation is distinct from old.is_simulation
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'outbound_message_identity_immutable' using errcode = '42501';
  end if;
  if old.status = 'pending_validation' and new.status not in ('pending_validation', 'approved', 'rejected') then
    raise exception 'outbound_message_invalid_transition' using errcode = '42501';
  elsif old.status = 'approved' and new.status not in ('approved', 'pending_validation', 'sent_simulated') then
    raise exception 'outbound_message_invalid_transition' using errcode = '42501';
  elsif old.status in ('rejected', 'sent_simulated') then
    raise exception 'outbound_message_terminal' using errcode = '42501';
  end if;
  if (new.body is distinct from old.body or new.subject is distinct from old.subject)
     and new.status <> 'pending_validation' then
    raise exception 'outbound_message_edit_requires_revalidation' using errcode = '42501';
  end if;
  if new.status = 'rejected' then
    if new.rejection_reason is null then
      raise exception 'outbound_message_rejection_reason_required' using errcode = '23514';
    end if;
    new.rejection_reason_label := case new.rejection_reason
      when 'incorrect_information' then 'Information inexacte ou absente du dossier'
      when 'inappropriate_tone' then 'Ton ou formulation inadaptés'
      when 'bad_timing' then 'Mauvais moment pour ce contact'
      when 'consent_doubt' then 'Consentement insuffisant ou douteux'
      when 'handled_by_human' then 'Dossier repris en main par un conseiller'
      when 'already_contacted' then 'Contact déjà relancé récemment'
      when 'other' then 'Autre motif'
    end;
  else
    new.rejection_reason := null; new.rejection_reason_label := null; new.rejection_note := null;
  end if;
  return new;
end; $$;
revoke all on function private.guard_outbound_message_state() from public;
create trigger guard_outbound_message_state before insert or update on public.outbound_messages
  for each row execute function private.guard_outbound_message_state();

create function private.audit_outbound_message_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  event_type text;
  event_summary text;
begin
  if caller is null then return new; end if;
  if old.status = 'pending_validation' and new.status = 'approved' then
    event_type := 'message_approved';
    event_summary := 'Message validé par un membre de l''agence. Rien n''a encore été envoyé.';
  elsif old.status = 'pending_validation' and new.status = 'rejected' then
    event_type := 'message_rejected';
    event_summary := 'Message refusé par un membre de l''agence : il ne partira pas. Motif : ' || new.rejection_reason_label || '.';
  elsif old.status = 'approved' and new.status = 'sent_simulated' then
    event_type := 'message_sent_simulated';
    event_summary := 'Message envoyé en simulation après validation humaine. Aucun envoi réel : aucun fournisseur n''est branché.';
  elsif new.status = 'pending_validation'
        and (new.body is distinct from old.body or new.subject is distinct from old.subject) then
    event_type := 'message_edited';
    event_summary := case when old.status = 'approved'
      then 'Message réécrit par un membre de l''agence : la validation précédente est annulée, il doit être validé de nouveau.'
      else 'Message réécrit par un membre de l''agence avant validation.' end;
  else return new;
  end if;
  insert into public.activities (
    agency_id, contact_id, type, summary, payload, actor_type, actor_user_id, is_simulation
  ) values (
    new.agency_id, new.contact_id, event_type, event_summary,
    jsonb_build_object('message_id', new.id, 'drafted_by_agent', new.created_by_agent,
      'rejection_reason', new.rejection_reason, 'rejection_reason_label', new.rejection_reason_label,
      'rejection_note', new.rejection_note),
    'user', caller, new.is_simulation
  );
  return new;
end; $$;
revoke all on function private.audit_outbound_message_change() from public;
create trigger audit_outbound_message_change after update on public.outbound_messages
  for each row execute function private.audit_outbound_message_change();

create function private.guard_inbound_lead_state()
returns trigger language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := caller;
    if new.status <> 'pending' or new.contact_id is not null or new.processed_run_id is not null then
      raise exception 'inbound_lead_must_start_pending' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'pending' or not private.has_agency_role(old.agency_id, 'director') then
      raise exception 'inbound_lead_delete_forbidden' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'pending' then
    raise exception 'inbound_lead_terminal' using errcode = '42501';
  end if;
  if new.source is distinct from old.source or new.raw_text is distinct from old.raw_text
     or new.payload is distinct from old.payload or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'inbound_lead_provenance_immutable' using errcode = '42501';
  end if;
  if new.status in ('processed', 'duplicate') then
    if new.contact_id is null or new.processed_run_id is null or not exists (
      select 1 from public.ai_agent_runs r where r.id = new.processed_run_id
        and r.agency_id = new.agency_id and r.agent = 'lea' and r.status = 'running'
        and r.triggered_by_user_id = caller
    ) then raise exception 'inbound_lead_invalid_processing_run' using errcode = '42501'; end if;
  elsif new.status = 'pending' and (new.contact_id is not null or new.processed_run_id is not null) then
    raise exception 'inbound_lead_pending_has_result' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function private.guard_inbound_lead_state() from public;
create trigger guard_inbound_lead_state before insert or update or delete on public.inbound_leads
  for each row execute function private.guard_inbound_lead_state();

create function private.guard_ai_agent_run_state()
returns trigger language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then return new; end if;
  if tg_op = 'INSERT' then
    new.triggered_by_user_id := caller;
    if new.status = 'running' and (new.finished_at is not null or new.output is not null
       or new.decision is not null or new.error is not null or new.input_tokens <> 0 or new.output_tokens <> 0) then
      raise exception 'ai_agent_run_invalid_initial_state' using errcode = '23514';
    end if;
    if new.status = 'blocked' and (new.error is null or new.decision is null) then
      raise exception 'ai_agent_run_block_reason_required' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.triggered_by_user_id is distinct from caller then
    raise exception 'ai_agent_run_not_owner' using errcode = '42501';
  end if;
  if old.status <> 'running' or new.status not in ('succeeded', 'failed') then
    raise exception 'ai_agent_run_invalid_transition' using errcode = '42501';
  end if;
  if new.status = 'failed' and new.error is null then
    raise exception 'ai_agent_run_failure_reason_required' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function private.guard_ai_agent_run_state() from public;
create trigger guard_ai_agent_run_state before insert or update on public.ai_agent_runs
  for each row execute function private.guard_ai_agent_run_state();
