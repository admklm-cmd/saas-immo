-- =============================================================================
-- AiaA — public estimation request (`/estimation`).
--
-- A visitor who is NOT signed in describes a property and explicitly chooses
-- which channels they authorise. `anon` still has NO direct privilege on any
-- business table (see 20260915120000_init.sql): the only door open to it is
-- the SECURITY DEFINER function at the bottom of this file, which writes the
-- lead and the consents it was actually given, in one transaction, and forces
-- every sensitive field itself (agency, source, status, timestamps).
--
-- Architecture note (see docs/architecture.md for the full write-up):
--   * The publishable (anon) key is PUBLIC. Anyone can call this function
--     directly over the Data API, bypassing the Next.js server action
--     entirely. Every guard rail below therefore lives IN THE FUNCTION, not
--     only in `features/estimation/actions.ts`.
--   * The target agency is resolved SERVER-SIDE from a fixed value baked into
--     `private.estimation_target_agency()` — never accepted as a parameter,
--     so a direct caller cannot redirect a submission to another agency.
--   * The exact legal text of each consent is likewise hardcoded in
--     `private.estimation_consent_text()`, not accepted as a parameter, so a
--     direct caller cannot forge what a visitor was told they agreed to.
--   * Rate limiting (per IP-hash and per agency) lives in the function and is
--     backed by `private.estimation_submissions`, a table `anon` cannot read
--     or write directly (RLS enabled, zero policies, no GRANT).
--
-- Schema change this migration makes to an EXISTING table, and why:
--   `consents.contact_id` becomes NULLABLE. A lead is not a consent (see
--   `features/agents-ia/lea-acquisition/lea.ts`), and Léa still creates the
--   contact from this lead LATER, unmodified: the consent(s) collected at
--   submission time must therefore exist before any contact does. They are
--   recorded with `contact_id = null` and a `lead_id` reference in `proof`.
--   `current_consents` is updated to exclude these pre-contact rows (a
--   "current consent" is a per-CONTACT notion); the append-only guarantee,
--   the grant-evidence check and every other invariant are untouched.
--   `private.reconcile_lead_consents()` (new trigger on `inbound_leads`)
--   copies a lead-scoped granted consent onto the contact Léa attaches the
--   lead to, the moment she does it — without any change to her code — so it
--   becomes usable by the normal send-time check in `guard_outbound_message`.
--   Until that happens (lead still `pending`, or rejected), a pre-contact
--   consent is evidence only: it does not, by itself, authorise any send.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. `consents.contact_id` becomes nullable, `current_consents` stays scoped
--    to real contacts.
-- -----------------------------------------------------------------------------
alter table public.consents alter column contact_id drop not null;

create or replace view public.current_consents
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
where c.contact_id is not null
order by
  c.agency_id, c.contact_id, c.channel,
  c.recorded_at desc, c.created_at desc, (c.status = 'withdrawn') desc, c.id;

-- -----------------------------------------------------------------------------
-- 2. Reconciliation: the moment Léa (or a human) attaches a lead to a
--    contact, any consent collected against that lead becomes attached to the
--    contact too. Pure database trigger: zero change to Léa's TypeScript.
-- -----------------------------------------------------------------------------
create function private.reconcile_lead_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `guard_inbound_lead_state` makes a processed/duplicate lead terminal, so
  -- `contact_id` can only ever move from null to a value exactly once.
  if new.contact_id is not null and old.contact_id is null then
    insert into public.consents (
      agency_id, contact_id, channel, status, presented_text, text_version, source, proof, recorded_at
    )
    select
      c.agency_id, new.contact_id, c.channel, c.status, c.presented_text, c.text_version, c.source,
      c.proof || jsonb_build_object('reconciled_from_consent_id', c.id, 'reconciled_from_lead_id', new.id),
      c.recorded_at
    from public.consents c
    where c.agency_id = new.agency_id
      and c.contact_id is null
      and c.status = 'granted'
      and c.proof ->> 'lead_id' = new.id::text;
  end if;
  return new;
end;
$$;
revoke all on function private.reconcile_lead_consents() from public;

create trigger reconcile_lead_consents after update on public.inbound_leads
  for each row execute function private.reconcile_lead_consents();

-- -----------------------------------------------------------------------------
-- 3. Rate limiting store. In `private`: no schema in the Data API exposes it,
--    and RLS is enabled with ZERO policies (defense in depth: even if a
--    future migration ever re-exposed this schema, every role is denied by
--    default). Only the SECURITY DEFINER function below touches it.
--
--    Retention (documented honestly, see docs/security.md): rows are never
--    purged automatically in this prototype. A real deployment needs a
--    scheduled job (e.g. pg_cron) deleting rows older than a few days —
--    not built here.
-- -----------------------------------------------------------------------------
create table private.estimation_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Salted SHA-256 of the visitor's IP address, never the raw address (see
  -- features/estimation/actions.ts for the salt and the algorithm).
  ip_hash text not null check (char_length(ip_hash) between 1 and 128),
  created_at timestamptz not null default now()
);
create index estimation_submissions_ip_hash_created_at_idx
  on private.estimation_submissions (ip_hash, created_at desc);
create index estimation_submissions_agency_id_created_at_idx
  on private.estimation_submissions (agency_id, created_at desc);

alter table private.estimation_submissions enable row level security;
revoke all on table private.estimation_submissions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Fixed configuration, resolved server-side (never from the browser, never
--    from a parameter of the function below — see the file header).
-- -----------------------------------------------------------------------------

-- The single agency this prototype's public site publishes an estimation form
-- for. Value = FIXTURE_AGENCY_IDS.a in fixtures/fixture-ids.ts ("Calanques
-- Immobilier (fictive)"), i.e. fixtureUuid("agency:calanques-immobilier").
-- Reloading the fixtures reproduces this exact id, so it survives
-- `npm run db:reset`. A real multi-agency deployment would resolve the target
-- agency from the request's site/domain configuration instead of one
-- hardcoded id (out of scope of this prototype).
create function private.estimation_target_agency()
returns uuid
language sql
immutable
set search_path = ''
as $$
  select '1047d80d-6998-4883-bbbc-ad026708d2af'::uuid;
$$;
revoke all on function private.estimation_target_agency() from public;

-- Exact legal text for a channel, at the version this migration ships.
-- Hardcoded here (never a function parameter) so a caller cannot forge what a
-- visitor was told they were agreeing to. Mirrored, byte for byte, in
-- features/estimation/consent-texts.ts for display — read that file's header
-- comment before changing either one, and bump the version in both places.
create function private.estimation_consent_text(target_channel public.consent_channel)
returns text
language sql
immutable
set search_path = ''
as $$
  select case target_channel
    when 'email' then
      'J''accepte d''être recontacté(e) par l''agence par email au sujet de ma demande d''estimation. ' ||
      'Je peux retirer mon consentement à tout moment via le lien de désinscription présent dans chaque message.'
    when 'sms' then
      'J''accepte d''être recontacté(e) par l''agence par SMS au sujet de ma demande d''estimation. ' ||
      'Je peux retirer mon consentement à tout moment en répondant STOP.'
    when 'whatsapp' then
      'J''accepte d''échanger avec l''agence via WhatsApp au sujet de ma demande d''estimation. ' ||
      'Je peux retirer mon consentement à tout moment en répondant STOP.'
    when 'phone' then
      'J''accepte d''être appelé(e) par l''agence au sujet de ma demande d''estimation, aux horaires ' ||
      'autorisés par la loi (du lundi au vendredi, hors jours fériés, de 10h à 13h et de 14h à 20h). ' ||
      'Je peux retirer mon consentement à tout moment.'
  end;
$$;
revoke all on function private.estimation_consent_text(public.consent_channel) from public;

-- -----------------------------------------------------------------------------
-- 5. The public entry point. Reachable by `anon` (see grants at the bottom):
--    every guard rail a direct, non-UI caller could bypass MUST be enforced
--    here, not only in the Next.js server action.
-- -----------------------------------------------------------------------------
create function public.submit_estimation_request(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_property_type public.property_type,
  p_city text,
  p_postal_code text,
  p_surface_m2 numeric,
  p_rooms smallint,
  p_message text,
  p_consent_email boolean,
  p_consent_sms boolean,
  p_consent_whatsapp boolean,
  p_consent_phone boolean,
  p_ip_hash text,
  p_user_agent text,
  -- Invisible honeypot field: a real visitor never fills it. Not a strong
  -- defence against a targeted attacker calling this function directly (they
  -- simply omit it), but it stops naive scripts that fill every form field.
  p_website text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_agency uuid := private.estimation_target_agency();
  lead_id uuid;
  ip_count integer;
  agency_count integer;
  channel_row record;
  -- Rate limits (documented in docs/security.md; not configurable per agency
  -- yet — a single fixed prototype agency does not need it).
  ip_window interval := interval '10 minutes';
  ip_limit integer := 3;
  agency_window interval := interval '1 hour';
  agency_limit integer := 30;
begin
  -- Honeypot: reject exactly like an ordinary validation failure, so a script
  -- cannot distinguish "caught by the trap" from "sent bad data".
  if p_website is not null and length(btrim(p_website)) > 0 then
    raise exception 'estimation_request_invalid' using errcode = 'P0001';
  end if;

  -- The IP hash must come from the server (see actions.ts): refuse to
  -- proceed without one rather than silently skip rate limiting.
  if p_ip_hash is null or length(btrim(p_ip_hash)) = 0 or length(p_ip_hash) > 128 then
    raise exception 'estimation_request_invalid' using errcode = 'P0001';
  end if;

  -- Field bounds and consent/coordinates coherence, defense in depth: the
  -- server action already validates all of this with zod, but this function
  -- is reachable directly with the public key. Validated fully BEFORE any
  -- write, so a rejected call here writes nothing at all (see
  -- docs/architecture.md for why this makes the whole call atomic).
  if p_first_name is null or length(btrim(p_first_name)) < 1 or length(p_first_name) > 100
     or p_last_name is null or length(btrim(p_last_name)) < 1 or length(p_last_name) > 100
     or p_city is null or length(btrim(p_city)) < 1 or length(p_city) > 120
     or p_postal_code is null or p_postal_code !~ '^[0-9]{5}$'
     or (p_email is not null and (
           length(p_email) > 320 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
         ))
     or (p_phone is not null and (length(p_phone) < 6 or length(p_phone) > 30))
     or (p_surface_m2 is not null and (p_surface_m2 <= 0 or p_surface_m2 > 100000))
     or (p_rooms is not null and (p_rooms <= 0 or p_rooms > 50))
     or (p_message is not null and length(p_message) > 2000)
     or (p_user_agent is not null and length(p_user_agent) > 500)
     or (p_email is null and p_phone is null)
     or (p_consent_email and p_email is null)
     or ((p_consent_sms or p_consent_whatsapp or p_consent_phone) and p_phone is null)
     or not (p_consent_email or p_consent_sms or p_consent_whatsapp or p_consent_phone)
  then
    raise exception 'estimation_request_invalid' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.agencies a where a.id = target_agency) then
    -- Prototype-only failure mode (fixtures not loaded yet): a clear code
    -- rather than a raw foreign-key error leaking table structure.
    raise exception 'estimation_agency_unavailable' using errcode = 'P0001';
  end if;

  -- Rate limiting: per IP-hash first (stops one source from flooding), then
  -- per agency (bounds the total even if an attacker varies the IP-hash).
  -- See docs/security.md for what this does and does not protect against.
  select count(*) into ip_count
    from private.estimation_submissions
    where ip_hash = p_ip_hash and created_at >= now() - ip_window;
  if ip_count >= ip_limit then
    raise exception 'estimation_rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into agency_count
    from private.estimation_submissions
    where agency_id = target_agency and created_at >= now() - agency_window;
  if agency_count >= agency_limit then
    raise exception 'estimation_rate_limited' using errcode = 'P0001';
  end if;

  insert into private.estimation_submissions (agency_id, ip_hash) values (target_agency, p_ip_hash);

  -- The lead: `raw_text` is the prospect's own free words (untrusted data for
  -- the AI agents), `payload` is the structured, reliable part Léa reads
  -- (same field names as every other source: first_name, last_name, email,
  -- phone — see features/agents-ia/lea-acquisition/lea.ts). No price, no
  -- estimate: the database has no such field here and never will.
  insert into public.inbound_leads (agency_id, source, raw_text, payload, status)
  values (
    target_agency,
    'estimation_form',
    nullif(btrim(coalesce(p_message, '')), ''),
    jsonb_build_object(
      'first_name', btrim(p_first_name),
      'last_name', btrim(p_last_name),
      'email', p_email,
      'phone', p_phone,
      'property_type', p_property_type,
      'city', btrim(p_city),
      'postal_code', p_postal_code,
      'surface_m2', p_surface_m2,
      'rooms', p_rooms
    ),
    'pending'
  )
  returning id into lead_id;

  -- One row per CHECKED channel only. An unchecked box creates no row at all
  -- (never a `granted` row that should not exist, never a forged refusal).
  for channel_row in
    select v.channel, v.granted from (values
      ('email'::public.consent_channel, p_consent_email),
      ('sms'::public.consent_channel, p_consent_sms),
      ('whatsapp'::public.consent_channel, p_consent_whatsapp),
      ('phone'::public.consent_channel, p_consent_phone)
    ) as v(channel, granted)
    where v.granted
  loop
    insert into public.consents (
      agency_id, contact_id, channel, status, presented_text, text_version, source, proof, recorded_at
    ) values (
      target_agency,
      null,
      channel_row.channel,
      'granted',
      private.estimation_consent_text(channel_row.channel),
      'estimation-2026-09-v1',
      'estimation_form',
      jsonb_build_object(
        'lead_id', lead_id,
        'ip_hash', p_ip_hash,
        'user_agent', left(coalesce(p_user_agent, ''), 300)
      ),
      now()
    );
  end loop;
end;
$$;

revoke all on function public.submit_estimation_request(
  text, text, text, text, public.property_type, text, text, numeric, smallint, text,
  boolean, boolean, boolean, boolean, text, text, text
) from public;
grant execute on function public.submit_estimation_request(
  text, text, text, text, public.property_type, text, text, numeric, smallint, text,
  boolean, boolean, boolean, boolean, text, text, text
) to anon, authenticated;
