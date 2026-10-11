-- =============================================================================
-- AiaA — `inbound_leads`: the front door of Léa (acquisition agent).
--
-- A raw incoming lead, entered by a MEMBER OF THE AGENCY (there is no public
-- form in this batch: `anon` still has no privilege anywhere). Léa checks the
-- source, deduplicates against the existing contacts and, when a human accepts
-- it, a contact record is created. Until then nothing is contacted: a lead is
-- material to read, not a permission to write to someone.
--
-- Legal reminder (CLAUDE.md, socle légal): a lead is NOT a consent. Whatever a
-- lead contains, no message can leave without a valid consent recorded in
-- `consents`, checked by the database at send time.
--
-- Same principles as every other business table:
--   * agency_id on the row, immutable after creation (trigger);
--   * RLS enabled, members of the agency only;
--   * `anon` has no privilege at all;
--   * composite foreign keys (agency_id, <fk>): a lead of agency A can never
--     point to a contact or to an AI run of agency B;
--   * `created_by` can only be the caller (RLS `with check`).
-- =============================================================================

create type public.inbound_lead_status as enum (
  'pending',    -- waiting to be processed (by Léa, then by a human)
  'processed',  -- a contact was created from it
  'duplicate',  -- an existing contact was found: no second record
  'rejected'    -- not exploitable (spam, out of scope, unusable)
);

create table public.inbound_leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Same closed vocabulary as `contacts.source`: where the lead comes from.
  source public.contact_source not null,
  -- Free text received with the lead: UNTRUSTED DATA for the AI agents, never
  -- instructions. Bounded, like `contacts.notes`.
  raw_text text check (char_length(raw_text) <= 5000),
  -- Structured payload of the lead (form fields, partner API body, …).
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status public.inbound_lead_status not null default 'pending',
  -- The contact created from this lead, or the duplicate that was found.
  contact_id uuid,
  -- The run of Léa that processed it (traceability of the decision).
  processed_run_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_leads_agency_id_id_key unique (agency_id, id),
  constraint inbound_leads_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete set null (contact_id),
  constraint inbound_leads_run_fkey foreign key (agency_id, processed_run_id)
    references public.ai_agent_runs (agency_id, id) on delete set null (processed_run_id),
  constraint inbound_leads_created_by_fkey foreign key (agency_id, created_by)
    references public.memberships (agency_id, user_id) on delete set null (created_by),
  -- An empty lead is not a lead: something must be readable in it.
  constraint inbound_leads_has_content check (
    raw_text is not null or payload <> '{}'::jsonb
  ),
  -- 'processed' means "a contact exists for it", 'duplicate' means "an existing
  -- contact was found": both must point at that contact.
  constraint inbound_leads_contact_consistent check (
    status not in ('processed', 'duplicate') or contact_id is not null
  )
);

create index inbound_leads_agency_id_status_idx on public.inbound_leads (agency_id, status);
create index inbound_leads_agency_id_created_at_idx on public.inbound_leads (agency_id, created_at desc);
create index inbound_leads_agency_id_contact_id_idx on public.inbound_leads (agency_id, contact_id);
create index inbound_leads_agency_id_processed_run_id_idx on public.inbound_leads (agency_id, processed_run_id);
create index inbound_leads_agency_id_created_by_idx on public.inbound_leads (agency_id, created_by);

create trigger set_updated_at before update on public.inbound_leads
  for each row execute function private.set_updated_at();
create trigger prevent_agency_id_change before update on public.inbound_leads
  for each row execute function private.prevent_agency_id_change();

-- -----------------------------------------------------------------------------
-- Privileges: nothing for anon, least privilege for authenticated.
-- -----------------------------------------------------------------------------
revoke all on table public.inbound_leads from anon, authenticated;
grant select, insert, update, delete on table public.inbound_leads to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.inbound_leads enable row level security;

create policy "inbound_leads_select_members" on public.inbound_leads
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "inbound_leads_insert_members" on public.inbound_leads
  for insert to authenticated
  with check (
    agency_id in (select private.member_agency_ids())
    and (created_by is null or created_by = (select auth.uid()))
  );
create policy "inbound_leads_update_members" on public.inbound_leads
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
create policy "inbound_leads_delete_members" on public.inbound_leads
  for delete to authenticated
  using (agency_id in (select private.member_agency_ids()));
