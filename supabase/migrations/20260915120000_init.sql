-- =============================================================================
-- AiaA — initial schema (prototype)
--
-- 9 business tables, all with RLS enabled, isolated per agency:
--   agencies, memberships, contacts, properties, consents, appointments,
--   outbound_messages, activities, ai_agent_runs
--
-- Security principles (see CLAUDE.md):
--   * Row Level Security on every table; policies are based on the session
--     (auth.uid()), never on a value sent by the client.
--   * `anon` has no privilege on any table: public forms go through server code.
--   * Cross-agency integrity is enforced by composite foreign keys
--     (agency_id, <fk>) in addition to RLS (defense in depth).
--   * `agency_id` is immutable after creation.
--   * Consents and activities are append-only (UPDATE/DELETE/TRUNCATE refused
--     by triggers for all non-superuser roles, service_role included; only the
--     cascade from deleting the whole agency is accepted).
--   * Double booking of an advisor is impossible (exclusion constraint).
--   * Kill switch (agencies.ai_paused) and daily AI run limit are enforced by
--     the database when an AI run starts.
--   * Outbound messages: consent checked at (simulated) send time, first
--     contact human-validated, validation stamped by the server, sent
--     messages immutable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Private schema: helper and trigger functions. Not exposed by the Data API
-- (PostgREST only exposes `public` and `graphql_public`), so SECURITY DEFINER
-- helpers here cannot be called over HTTP.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Defense in depth for future objects: nothing created later by `postgres`
-- in `public` is reachable by `anon` without an explicit GRANT.
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- -----------------------------------------------------------------------------
-- Enum types (ASCII values; accented labels are rendered by the UI)
-- -----------------------------------------------------------------------------
create type public.pipeline_stage as enum (
  'nouveau', 'qualifie', 'chaud', 'rdv_planifie', 'estimation_faite', 'mandat_signe', 'perdu'
);
create type public.membership_role as enum ('agent', 'director');
create type public.consent_channel as enum ('email', 'sms', 'whatsapp', 'phone');
create type public.consent_status as enum ('granted', 'withdrawn');
create type public.ai_agent_name as enum ('lea', 'hugo', 'emma', 'louis', 'sarah');
create type public.contact_source as enum (
  'estimation_form', 'website_form', 'manual_entry', 'inbound_call',
  'inbound_email', 'referral', 'partner_api', 'software_import'
);
create type public.property_type as enum ('apartment', 'house', 'land', 'commercial', 'other');
create type public.appointment_status as enum ('proposed', 'confirmed', 'cancelled', 'done');
create type public.outbound_message_status as enum (
  'pending_validation', 'approved', 'rejected', 'sent_simulated'
);
create type public.activity_actor_type as enum ('user', 'ai_agent', 'system');
create type public.ai_agent_run_status as enum ('running', 'succeeded', 'failed', 'blocked');

-- =============================================================================
-- Tables
-- =============================================================================

-- agencies --------------------------------------------------------------------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  city text check (char_length(city) <= 120),
  sector text check (char_length(sector) <= 200),
  -- Kill switch: when true, no AI agent run can start for this agency.
  ai_paused boolean not null default false,
  -- Volume limit: max AI runs started per calendar day (Europe/Paris).
  ai_daily_run_limit integer not null default 100 check (ai_daily_run_limit between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- memberships -----------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null default 'agent',
  created_at timestamptz not null default now(),
  constraint memberships_agency_user_key unique (agency_id, user_id)
);
create index memberships_user_id_agency_id_idx on public.memberships (user_id, agency_id);

-- contacts --------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  first_name text check (char_length(first_name) <= 100),
  last_name text check (char_length(last_name) <= 100),
  email text check (char_length(email) <= 320 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  phone text check (phone ~ '^\+?[0-9 .()-]{6,25}$'),
  source public.contact_source not null,
  stage public.pipeline_stage not null default 'nouveau',
  -- Free text written by the prospect: UNTRUSTED DATA for AI agents, never instructions.
  notes text check (char_length(notes) <= 10000),
  -- Qualification fields (filled by Hugo or a human). NULL = unknown, never guessed.
  sale_motivation text check (char_length(sale_motivation) <= 500),
  sale_timeline text check (char_length(sale_timeline) <= 200),
  assigned_user_id uuid,
  -- Human takeover: automatic follow-ups must stop.
  human_takeover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_agency_id_id_key unique (agency_id, id),
  constraint contacts_assigned_user_fkey foreign key (agency_id, assigned_user_id)
    references public.memberships (agency_id, user_id) on delete set null (assigned_user_id)
);
create index contacts_agency_id_stage_idx on public.contacts (agency_id, stage);
create index contacts_agency_id_assigned_user_id_idx on public.contacts (agency_id, assigned_user_id);
-- Deduplication lookups (Lea): not unique, a human decides on merges.
create index contacts_agency_id_email_idx on public.contacts (agency_id, lower(email)) where email is not null;
create index contacts_agency_id_phone_idx on public.contacts (agency_id, phone) where phone is not null;

-- properties ------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid not null,
  property_type public.property_type,
  address text check (char_length(address) <= 300),
  postal_code text check (postal_code ~ '^[0-9]{5}$'),
  city text check (char_length(city) <= 120),
  sector text check (char_length(sector) <= 200),
  surface_m2 numeric(8, 2) check (surface_m2 > 0),
  rooms smallint check (rooms > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_agency_id_id_key unique (agency_id, id),
  constraint properties_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete cascade
);
create index properties_agency_id_contact_id_idx on public.properties (agency_id, contact_id);

-- consents (append-only) --------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid not null,
  channel public.consent_channel not null,
  status public.consent_status not null,
  -- Exact text shown to the contact and its version (required for a grant).
  presented_text text check (char_length(presented_text) <= 5000),
  text_version text check (char_length(text_version) <= 50),
  source text not null check (char_length(source) between 1 and 200),
  -- Proof: e.g. {"ip": "...", "form_id": "...", "user_agent": "..."} (required for a grant).
  proof jsonb not null default '{}'::jsonb check (jsonb_typeof(proof) = 'object'),
  -- When the consent was given / withdrawn (may be earlier than insertion).
  recorded_at timestamptz not null default now(),
  -- User who recorded it (NULL = system / public form). Not a FK: append-only
  -- rows must never be rewritten by ON DELETE SET NULL.
  recorded_by uuid,
  created_at timestamptz not null default now(),
  constraint consents_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete no action,
  constraint consents_grant_has_evidence check (
    status <> 'granted'
    or (presented_text is not null and text_version is not null and proof <> '{}'::jsonb)
  )
);
create index consents_current_idx
  on public.consents (agency_id, contact_id, channel, recorded_at desc, created_at desc);

-- Current consent = most recent row per (contact, channel). Respects RLS.
-- Ordering: business date, then insertion time (clock_timestamp, so rows of a
-- same transaction stay ordered), then 'withdrawn' first on an exact tie
-- (the safe interpretation), then id for determinism.
-- Keep in sync with private.guard_outbound_message().
create view public.current_consents
with (security_invoker = true) as
select distinct on (c.agency_id, c.contact_id, c.channel)
  c.id,
  c.agency_id,
  c.contact_id,
  c.channel,
  c.status,
  c.text_version,
  c.source,
  c.recorded_at,
  c.created_at
from public.consents c
order by
  c.agency_id, c.contact_id, c.channel,
  c.recorded_at desc, c.created_at desc, (c.status = 'withdrawn') desc, c.id;

-- appointments ----------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid not null,
  property_id uuid,
  assigned_user_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'proposed',
  is_simulation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_range check (ends_at > starts_at),
  constraint appointments_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete cascade,
  constraint appointments_property_fkey foreign key (agency_id, property_id)
    references public.properties (agency_id, id) on delete set null (property_id),
  constraint appointments_assigned_user_fkey foreign key (agency_id, assigned_user_id)
    references public.memberships (agency_id, user_id) on delete no action,
  -- No double booking: two active appointments of the same advisor cannot overlap.
  constraint appointments_no_overlap exclude using gist (
    agency_id extensions.gist_uuid_ops with =,
    assigned_user_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('proposed', 'confirmed'))
);
create index appointments_agency_id_starts_at_idx on public.appointments (agency_id, starts_at);
create index appointments_agency_id_contact_id_idx on public.appointments (agency_id, contact_id);
create index appointments_agency_id_property_id_idx on public.appointments (agency_id, property_id);

-- outbound_messages -----------------------------------------------------------
create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid not null,
  channel public.consent_channel not null check (channel <> 'phone'),
  subject text check (char_length(subject) <= 300),
  body text not null check (char_length(body) between 1 and 5000),
  status public.outbound_message_status not null default 'pending_validation',
  is_simulation boolean not null default true,
  created_by_agent public.ai_agent_name,
  validated_by uuid,
  validated_at timestamptz,
  sent_at timestamptz,
  -- Anti double send: one key per logical message, unique within the agency.
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_messages_idempotency_key unique (agency_id, idempotency_key),
  constraint outbound_messages_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete cascade,
  constraint outbound_messages_validated_by_fkey foreign key (agency_id, validated_by)
    references public.memberships (agency_id, user_id) on delete set null (validated_by),
  -- validated_by implies validated_at. The reverse is not required: when the
  -- validating member leaves the agency, validated_by is set to NULL by the FK
  -- but validated_at stays as evidence of the human validation.
  constraint outbound_messages_validation_complete check (
    validated_by is null or validated_at is not null
  ),
  constraint outbound_messages_decision_validated check (
    status not in ('approved', 'rejected') or validated_at is not null
  ),
  constraint outbound_messages_sent_at_consistent check (
    (status = 'sent_simulated') = (sent_at is not null)
  ),
  -- Prototype: no real sending provider exists, a sent message is always simulated.
  constraint outbound_messages_sent_is_simulation check (
    status <> 'sent_simulated' or is_simulation
  )
);
create index outbound_messages_agency_id_contact_id_idx on public.outbound_messages (agency_id, contact_id);
create index outbound_messages_agency_id_status_idx on public.outbound_messages (agency_id, status);
create index outbound_messages_agency_id_validated_by_idx on public.outbound_messages (agency_id, validated_by);

-- activities (append-only CRM history) --------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- NULL for agency-level events (e.g. kill switch toggled).
  contact_id uuid,
  type text not null check (type ~ '^[a-z][a-z0-9_]{1,63}$'),
  summary text not null check (char_length(summary) between 1 and 1000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  actor_type public.activity_actor_type not null,
  actor_agent public.ai_agent_name,
  -- Not a FK: append-only rows must never be rewritten by ON DELETE SET NULL.
  actor_user_id uuid,
  is_simulation boolean not null,
  -- When the event happened (may be earlier than insertion, never in the future).
  occurred_at timestamptz not null default now(),
  -- Insertion time, always set by the server (trigger).
  created_at timestamptz not null default now(),
  constraint activities_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete no action,
  constraint activities_actor_consistent check (
    (actor_type = 'ai_agent' and actor_agent is not null and actor_user_id is null)
    or (actor_type = 'user' and actor_agent is null and actor_user_id is not null)
    or (actor_type = 'system' and actor_agent is null and actor_user_id is null)
  )
);
create index activities_agency_id_contact_id_occurred_at_idx
  on public.activities (agency_id, contact_id, occurred_at desc);
create index activities_agency_id_occurred_at_idx on public.activities (agency_id, occurred_at desc);

-- ai_agent_runs (AI agents journal) -------------------------------------------------
create table public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  agent public.ai_agent_name not null,
  contact_id uuid,
  triggered_by_user_id uuid,
  status public.ai_agent_run_status not null default 'running',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  decision text check (char_length(decision) <= 2000),
  error text check (char_length(error) <= 2000),
  provider text not null default 'simulator' check (char_length(provider) between 1 and 50),
  model text check (char_length(model) <= 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  is_simulation boolean not null default true,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_agent_runs_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete no action,
  constraint ai_agent_runs_triggered_by_fkey foreign key (agency_id, triggered_by_user_id)
    references public.memberships (agency_id, user_id) on delete no action,
  constraint ai_agent_runs_finished_consistent check (
    (status = 'running') = (finished_at is null)
  ),
  constraint ai_agent_runs_finished_after_start check (finished_at is null or finished_at >= started_at)
);
create index ai_agent_runs_agency_id_started_at_idx on public.ai_agent_runs (agency_id, started_at desc);
create index ai_agent_runs_agency_id_contact_id_idx on public.ai_agent_runs (agency_id, contact_id);
create index ai_agent_runs_agency_id_triggered_by_idx on public.ai_agent_runs (agency_id, triggered_by_user_id);

-- =============================================================================
-- Helper functions (private schema)
-- =============================================================================

-- Agencies the current session user belongs to. Used by RLS policies as
-- `agency_id in (select private.member_agency_ids())` (evaluated once per
-- statement, Supabase-recommended pattern). SECURITY DEFINER avoids recursive
-- RLS evaluation on memberships.
create function private.member_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.agency_id
  from public.memberships m
  where m.user_id = (select auth.uid());
$$;

create function private.director_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.agency_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.role = 'director';
$$;

create function private.is_agency_member(target_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.agency_id = target_agency
      and m.user_id = (select auth.uid())
  );
$$;

create function private.has_agency_role(target_agency uuid, required_role public.membership_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.agency_id = target_agency
      and m.user_id = (select auth.uid())
      and m.role = required_role
  );
$$;

revoke all on function private.member_agency_ids() from public;
revoke all on function private.director_agency_ids() from public;
revoke all on function private.is_agency_member(uuid) from public;
revoke all on function private.has_agency_role(uuid, public.membership_role) from public;
grant execute on function private.member_agency_ids() to authenticated, service_role;
grant execute on function private.director_agency_ids() to authenticated, service_role;
grant execute on function private.is_agency_member(uuid) to authenticated, service_role;
grant execute on function private.has_agency_role(uuid, public.membership_role) to authenticated, service_role;

-- =============================================================================
-- Trigger functions
-- =============================================================================

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.prevent_agency_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.agency_id is distinct from old.agency_id then
    raise exception 'agency_id_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Append-only guard. Refuses UPDATE and DELETE for every non-superuser role
-- (service_role and postgres included). Single exception: DELETE cascading
-- from the deletion of the whole agency (account closure, service role only,
-- since no user can delete an agency).
create function private.prevent_append_only_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_superuser boolean;
begin
  select r.rolsuper into is_superuser from pg_catalog.pg_roles r where r.rolname = current_user;
  if coalesce(is_superuser, false) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE'
     and not exists (select 1 from public.agencies a where a.id = old.agency_id) then
    return old;
  end if;

  raise exception '%_append_only', tg_table_name using errcode = '42501';
end;
$$;

-- Append-only INSERT stamp: created_at is always the server time, and the
-- business date (consents.recorded_at / activities.occurred_at) cannot be in
-- the future (a future-dated grant would override a later withdrawal).
-- A 5-minute tolerance absorbs clock skew between app server and database.
create function private.stamp_consent_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := clock_timestamp();
  if new.recorded_at > now() + interval '5 minutes' then
    raise exception 'consent_recorded_at_in_future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.stamp_activity_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := clock_timestamp();
  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'activity_occurred_at_in_future' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- AI run guard (SECURITY DEFINER: must read and lock the agency row).
-- INSERT: a run starts as 'running' (kill switch + daily limit checked under a
-- row lock on the agency, so concurrent starts cannot exceed the limit) or is
-- journaled directly as 'blocked'. started_at is set by the server clock.
-- UPDATE: only running -> succeeded|failed; identity columns are immutable.
create function private.guard_ai_agent_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  agency_paused boolean;
  daily_limit integer;
  runs_today integer;
  paris_day_start timestamptz;
begin
  -- BEFORE triggers run before RLS WITH CHECK: never reveal another agency's
  -- state (kill switch, volume) to a non-member. Service role has no auth.uid().
  if (select auth.uid()) is not null and not private.is_agency_member(new.agency_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.started_at := now();

    if new.status = 'blocked' then
      new.finished_at := now();
      return new;
    end if;

    if new.status <> 'running' then
      raise exception 'ai_agent_run_must_start_running' using errcode = '23514';
    end if;
    new.finished_at := null;

    select a.ai_paused, a.ai_daily_run_limit
      into agency_paused, daily_limit
      from public.agencies a
      where a.id = new.agency_id
      for update;

    if agency_paused then
      raise exception 'ai_paused' using errcode = 'P0001';
    end if;

    paris_day_start := (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
    select count(*) into runs_today
      from public.ai_agent_runs r
      where r.agency_id = new.agency_id
        and r.status <> 'blocked'
        and r.started_at >= paris_day_start;

    if runs_today >= daily_limit then
      raise exception 'ai_daily_run_limit_reached' using errcode = 'P0001';
    end if;

    return new;
  end if;

  -- UPDATE
  if old.status <> 'running' then
    raise exception 'ai_agent_run_already_finished' using errcode = '42501';
  end if;
  if new.status not in ('running', 'succeeded', 'failed') then
    raise exception 'ai_agent_run_invalid_transition' using errcode = '23514';
  end if;
  if new.agent is distinct from old.agent
     or new.contact_id is distinct from old.contact_id
     or new.triggered_by_user_id is distinct from old.triggered_by_user_id
     or new.input is distinct from old.input
     or new.started_at is distinct from old.started_at
     or new.provider is distinct from old.provider
     or new.is_simulation is distinct from old.is_simulation
     or new.created_at is distinct from old.created_at then
    raise exception 'ai_agent_run_immutable_fields' using errcode = '42501';
  end if;
  if new.status in ('succeeded', 'failed') and new.finished_at is null then
    new.finished_at := now();
  end if;
  return new;
end;
$$;

-- Outbound message guard (SECURITY DEFINER: reads agency, consents, contact).
-- * An AI-drafted message cannot be created while the kill switch is on.
-- * Human validation is stamped by the server: validated_by can only be the
--   calling user and validated_at is the server time. Going back to
--   'pending_validation' clears the validation; editing the content of an
--   approved message requires going back to 'pending_validation'.
-- * A sent message is immutable (only the FK action ON DELETE SET NULL on
--   validated_by is accepted).
-- * A message can only become 'sent_simulated' if:
--     - the current consent for its channel is 'granted' (checked at send time),
--     - it is human-validated when it is the first message sent to the contact,
--     - for an unvalidated AI message: kill switch off and no human takeover.
create function private.guard_outbound_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  agency_paused boolean;
  takeover boolean;
  consent_state public.consent_status;
begin
  -- BEFORE triggers run before RLS WITH CHECK: never reveal another agency's
  -- state (kill switch, consents) to a non-member. Service role has no auth.uid().
  if caller is not null and not private.is_agency_member(new.agency_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status = 'sent_simulated' then
    if (to_jsonb(new) - 'validated_by' - 'updated_at') is distinct from (to_jsonb(old) - 'validated_by' - 'updated_at')
       or (new.validated_by is not null and new.validated_by is distinct from old.validated_by) then
      raise exception 'outbound_message_already_sent' using errcode = '42501';
    end if;
    return new;
  end if;

  select a.ai_paused into agency_paused from public.agencies a where a.id = new.agency_id;

  if tg_op = 'INSERT' and new.created_by_agent is not null and agency_paused then
    raise exception 'ai_paused' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'approved'
     and new.status <> 'pending_validation'
     and (new.body is distinct from old.body
          or new.subject is distinct from old.subject
          or new.channel is distinct from old.channel
          or new.contact_id is distinct from old.contact_id) then
    raise exception 'outbound_message_edit_requires_revalidation' using errcode = '42501';
  end if;

  -- Validation stamp (never trusted from the client).
  if new.status = 'pending_validation' then
    new.validated_by := null;
    new.validated_at := null;
  elsif new.validated_by is not null
        and (tg_op = 'INSERT' or new.validated_by is distinct from old.validated_by) then
    if caller is not null and new.validated_by <> caller then
      raise exception 'validated_by_must_be_caller' using errcode = '42501';
    end if;
    new.validated_at := now();
  elsif tg_op = 'INSERT' then
    new.validated_at := null;
  else
    new.validated_at := old.validated_at;
  end if;

  if new.status <> 'sent_simulated' then
    new.sent_at := null;
    return new;
  end if;

  -- Transition to 'sent_simulated'.
  new.sent_at := now();

  select cc.status into consent_state
    from public.consents cc
    where cc.agency_id = new.agency_id
      and cc.contact_id = new.contact_id
      and cc.channel = new.channel
    order by cc.recorded_at desc, cc.created_at desc, (cc.status = 'withdrawn') desc, cc.id
    limit 1;

  if consent_state is distinct from 'granted' then
    raise exception 'consent_not_granted' using errcode = 'P0001';
  end if;

  if new.validated_by is null then
    if not exists (
      select 1 from public.outbound_messages m
      where m.agency_id = new.agency_id
        and m.contact_id = new.contact_id
        and m.status = 'sent_simulated'
        and m.id <> new.id
    ) then
      raise exception 'first_contact_requires_human_validation' using errcode = 'P0001';
    end if;

    select c.human_takeover into takeover
      from public.contacts c
      where c.agency_id = new.agency_id and c.id = new.contact_id;

    if new.created_by_agent is not null and (agency_paused or takeover) then
      raise exception 'automatic_follow_up_not_allowed' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- TRUNCATE ignores row triggers and RLS: refuse it on append-only tables for
-- every non-superuser role (service_role and postgres included).
create function private.prevent_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_superuser boolean;
begin
  select r.rolsuper into is_superuser from pg_catalog.pg_roles r where r.rolname = current_user;
  if coalesce(is_superuser, false) then
    return null;
  end if;
  raise exception '%_append_only', tg_table_name using errcode = '42501';
end;
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.prevent_agency_id_change() from public;
revoke all on function private.prevent_append_only_change() from public;
revoke all on function private.guard_ai_agent_run() from public;
revoke all on function private.guard_outbound_message() from public;
revoke all on function private.prevent_truncate() from public;
revoke all on function private.stamp_consent_insert() from public;
revoke all on function private.stamp_activity_insert() from public;

-- =============================================================================
-- Triggers
-- =============================================================================

-- updated_at
create trigger set_updated_at before update on public.agencies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.properties
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.outbound_messages
  for each row execute function private.set_updated_at();

-- agency_id immutable
create trigger prevent_agency_id_change before update on public.memberships
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.contacts
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.properties
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.consents
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.appointments
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.outbound_messages
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.activities
  for each row execute function private.prevent_agency_id_change();
create trigger prevent_agency_id_change before update on public.ai_agent_runs
  for each row execute function private.prevent_agency_id_change();

-- append-only
create trigger consents_append_only before update or delete on public.consents
  for each row execute function private.prevent_append_only_change();
create trigger activities_append_only before update or delete on public.activities
  for each row execute function private.prevent_append_only_change();
create trigger consents_no_truncate before truncate on public.consents
  for each statement execute function private.prevent_truncate();
create trigger activities_no_truncate before truncate on public.activities
  for each statement execute function private.prevent_truncate();

create trigger stamp_consent_insert before insert on public.consents
  for each row execute function private.stamp_consent_insert();
create trigger stamp_activity_insert before insert on public.activities
  for each row execute function private.stamp_activity_insert();

-- AI guards
create trigger guard_ai_agent_run before insert or update on public.ai_agent_runs
  for each row execute function private.guard_ai_agent_run();
create trigger guard_outbound_message before insert or update on public.outbound_messages
  for each row execute function private.guard_outbound_message();

-- =============================================================================
-- Kill switch RPC (public, callable by authenticated users only)
-- Any member can pause; only a director can resume.
-- =============================================================================
create function public.set_ai_paused(target_agency uuid, paused boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  previous boolean;
begin
  if current_user_id is null or paused is null
     or not private.is_agency_member(target_agency) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not paused and not private.has_agency_role(target_agency, 'director') then
    raise exception 'only_director_can_resume_ai' using errcode = '42501';
  end if;

  select a.ai_paused into previous from public.agencies a where a.id = target_agency for update;

  if previous is distinct from paused then
    update public.agencies set ai_paused = paused where id = target_agency;

    insert into public.activities (agency_id, contact_id, type, summary, payload, actor_type, actor_user_id, is_simulation)
    values (
      target_agency,
      null,
      case when paused then 'ai_paused' else 'ai_resumed' end,
      case when paused then 'Agents IA suspendus (coupe-circuit)' else 'Agents IA réactivés' end,
      jsonb_build_object('previous', previous, 'paused', paused),
      'user',
      current_user_id,
      false
    );
  end if;

  return paused;
end;
$$;

revoke all on function public.set_ai_paused(uuid, boolean) from public, anon;
grant execute on function public.set_ai_paused(uuid, boolean) to authenticated;

-- =============================================================================
-- Privileges: no access for anon; least privilege for authenticated.
-- (Supabase grants ALL — including TRUNCATE, which ignores RLS — by default.)
-- =============================================================================
revoke all on table
  public.agencies, public.memberships, public.contacts, public.properties, public.consents,
  public.appointments, public.outbound_messages, public.activities, public.ai_agent_runs,
  public.current_consents
from anon, authenticated;

grant select on table public.agencies to authenticated;
grant select on table public.memberships to authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update, delete on table public.properties to authenticated;
grant select, insert on table public.consents to authenticated;
grant select on table public.current_consents to authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;
grant select, insert, update, delete on table public.outbound_messages to authenticated;
grant select, insert on table public.activities to authenticated;
grant select, insert, update on table public.ai_agent_runs to authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.agencies enable row level security;
alter table public.memberships enable row level security;
alter table public.contacts enable row level security;
alter table public.properties enable row level security;
alter table public.consents enable row level security;
alter table public.appointments enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.activities enable row level security;
alter table public.ai_agent_runs enable row level security;

-- agencies: read only (writes: service role, or set_ai_paused)
create policy "agencies_select_members" on public.agencies
  for select to authenticated
  using (id in (select private.member_agency_ids()));

-- memberships: members see the members of their agencies; no user writes
create policy "memberships_select_same_agency" on public.memberships
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));

-- contacts: CRUD for members; DELETE for directors only (GDPR erasure)
create policy "contacts_select_members" on public.contacts
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "contacts_insert_members" on public.contacts
  for insert to authenticated
  with check (agency_id in (select private.member_agency_ids()));
create policy "contacts_update_members" on public.contacts
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
create policy "contacts_delete_directors" on public.contacts
  for delete to authenticated
  using (agency_id in (select private.director_agency_ids()));

-- properties: CRUD for members
create policy "properties_select_members" on public.properties
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "properties_insert_members" on public.properties
  for insert to authenticated
  with check (agency_id in (select private.member_agency_ids()));
create policy "properties_update_members" on public.properties
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
create policy "properties_delete_members" on public.properties
  for delete to authenticated
  using (agency_id in (select private.member_agency_ids()));

-- consents: read + append for members (recorded_by must be the caller or NULL)
create policy "consents_select_members" on public.consents
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "consents_insert_members" on public.consents
  for insert to authenticated
  with check (
    agency_id in (select private.member_agency_ids())
    and (recorded_by is null or recorded_by = (select auth.uid()))
  );

-- appointments: CRUD for members
create policy "appointments_select_members" on public.appointments
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "appointments_insert_members" on public.appointments
  for insert to authenticated
  with check (agency_id in (select private.member_agency_ids()));
create policy "appointments_update_members" on public.appointments
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
create policy "appointments_delete_members" on public.appointments
  for delete to authenticated
  using (agency_id in (select private.member_agency_ids()));

-- outbound_messages: CRUD for members
create policy "outbound_messages_select_members" on public.outbound_messages
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "outbound_messages_insert_members" on public.outbound_messages
  for insert to authenticated
  with check (agency_id in (select private.member_agency_ids()));
create policy "outbound_messages_update_members" on public.outbound_messages
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
-- A sent message is part of the history: users cannot delete it.
create policy "outbound_messages_delete_members" on public.outbound_messages
  for delete to authenticated
  using (agency_id in (select private.member_agency_ids()) and status <> 'sent_simulated');

-- activities: read + append for members (actor_user_id must be the caller or NULL)
create policy "activities_select_members" on public.activities
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "activities_insert_members" on public.activities
  for insert to authenticated
  with check (
    agency_id in (select private.member_agency_ids())
    and (actor_user_id is null or actor_user_id = (select auth.uid()))
  );

-- ai_agent_runs: read, start, finish for members; no delete
create policy "ai_agent_runs_select_members" on public.ai_agent_runs
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "ai_agent_runs_insert_members" on public.ai_agent_runs
  for insert to authenticated
  with check (
    agency_id in (select private.member_agency_ids())
    and (triggered_by_user_id is null or triggered_by_user_id = (select auth.uid()))
  );
create policy "ai_agent_runs_update_members" on public.ai_agent_runs
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
