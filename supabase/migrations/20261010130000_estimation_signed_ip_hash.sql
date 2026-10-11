-- =============================================================================
-- AiaA — SEC-001: the per-IP rate limit of the public estimation request can
-- no longer be bypassed by a direct caller choosing its own bucket.
--
-- Problem (audit 2026-10-10, SEC-001): `public.submit_estimation_request`
-- (20260922120000) is executable by `anon` and received `p_ip_hash` from the
-- caller. A direct call to PostgREST with the public key could pass a new
-- value on every call and land in a fresh bucket, bypassing the
-- 3 requests / 10 minutes / IP limit (the 30 / hour / agency ceiling held, but
-- could then be exhausted to block legitimate visitors).
--
-- Fix: the database no longer trusts a value chosen by the caller.
--   * The Next.js server (features/estimation/estimation.ts) computes the IP
--     hash and SIGNS it: HMAC-SHA256(secret, 'estimation-ip:v1:<hash>:<ts>'),
--     `ts` being a Unix time in seconds (see features/estimation/ip-signature.ts).
--   * This function recomputes the HMAC with `extensions.hmac` (pgcrypto) and
--     refuses the call unless the signature matches AND `ts` is at most
--     60 seconds old (5 seconds of clock skew tolerated in the future).
--   * The secret lives in Supabase Vault (`vault.secrets`, encrypted at rest),
--     under the name `estimation_ip_hmac_secret`. It is NEVER in a migration
--     nor in Git: it is installed out of band through
--     `public.set_estimation_ip_hmac_secret()` (service role only), by the
--     local fixtures loader (`npm run db:seed`) or, in a real deployment, by
--     an administrator once. The same value is given to the Next.js server as
--     the server-only environment variable `ESTIMATION_IP_HMAC_SECRET`.
--   * No secret installed => every call is refused (`estimation_unavailable`):
--     there is no fallback that would silently restore the old behaviour.
--
-- What this does and does not cover (docs/security.md):
--   * a direct caller without the secret cannot pick a bucket, nor reuse a
--     captured signature with another hash (the hash is part of the signed
--     message), nor reuse it after 60 seconds;
--   * replaying the SAME signed hash within 60 seconds stays in the SAME
--     bucket, so the per-IP counter still applies to it;
--   * the hash is only as good as the IP the server sees: behind our own
--     reverse proxy (`TRUSTED_PROXY_HOPS`, ip-hash.ts). Without a proxy (local
--     `next dev`), `x-forwarded-for` remains declarative — a frontal
--     protection (proxy / WAF rate limit) is still required before any public
--     exposure.
--
-- Why not revoke `anon` and call with the service role instead: CLAUDE.md
-- forbids the service-role client in a path triggered by a user request. The
-- signature keeps the RPC public while taking the bucket out of the caller's
-- hands.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Secret: read from Vault (private, SECURITY DEFINER), installed out of band.
-- -----------------------------------------------------------------------------
create function private.estimation_ip_hmac_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name = 'estimation_ip_hmac_secret'
  order by s.created_at desc
  limit 1;
$$;
revoke all on function private.estimation_ip_hmac_secret() from public;

-- Installs or rotates the secret. Service role only (fixtures loader, an
-- administrator): never reachable by `anon` or `authenticated`. Returns
-- nothing, so the value is never echoed back.
create function public.set_estimation_ip_hmac_secret(p_secret text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  if p_secret is null or char_length(btrim(p_secret)) < 32 or char_length(p_secret) > 512 then
    raise exception 'estimation_secret_invalid' using errcode = '22023';
  end if;

  select s.id into existing from vault.secrets s where s.name = 'estimation_ip_hmac_secret' limit 1;
  if existing is null then
    perform vault.create_secret(
      btrim(p_secret),
      'estimation_ip_hmac_secret',
      'HMAC key signing the IP hash of public estimation requests (SEC-001).'
    );
  else
    perform vault.update_secret(existing, btrim(p_secret));
  end if;
end;
$$;
revoke all on function public.set_estimation_ip_hmac_secret(text) from public, anon, authenticated;
grant execute on function public.set_estimation_ip_hmac_secret(text) to service_role;

-- -----------------------------------------------------------------------------
-- 2. Signature check. Private, returns a boolean and nothing else.
-- -----------------------------------------------------------------------------
create function private.estimation_ip_signature_valid(
  p_ip_hash text,
  p_issued_at bigint,
  p_signature text,
  p_secret text
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  max_age constant integer := 60;
  max_future_skew constant integer := 5;
  now_seconds bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  expected text;
begin
  if p_ip_hash is null or p_issued_at is null or p_signature is null or p_secret is null then
    return false;
  end if;
  if p_signature !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  if p_issued_at < now_seconds - max_age or p_issued_at > now_seconds + max_future_skew then
    return false;
  end if;
  expected := encode(
    extensions.hmac(
      convert_to('estimation-ip:v1:' || p_ip_hash || ':' || p_issued_at::text, 'UTF8'),
      convert_to(p_secret, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  -- Double-HMAC comparison: Postgres has no constant-time equality, and a
  -- plain `expected = p_signature` stops at the first differing byte. Both
  -- sides are re-keyed with the secret first, so the timing of the final
  -- comparison depends on values an attacker can neither predict nor steer
  -- byte by byte: no prefix of the expected signature can be learnt.
  return extensions.hmac(convert_to(expected, 'UTF8'), convert_to(p_secret, 'UTF8'), 'sha256')
       = extensions.hmac(convert_to(p_signature, 'UTF8'), convert_to(p_secret, 'UTF8'), 'sha256');
end;
$$;
revoke all on function private.estimation_ip_signature_valid(text, bigint, text, text) from public;

-- -----------------------------------------------------------------------------
-- 3. The public entry point, replaced: the old signature (caller-chosen
--    `p_ip_hash`, no proof) is DROPPED, so it can no longer be called at all.
--    Body identical to 20260922120000 except the signature check marked SEC-001.
-- -----------------------------------------------------------------------------
drop function public.submit_estimation_request(
  text, text, text, text, public.property_type, text, text, numeric, smallint, text,
  boolean, boolean, boolean, boolean, text, text, text
);

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
  p_website text,
  -- SEC-001: proof that `p_ip_hash` was computed by the Next.js server.
  p_ip_hash_issued_at bigint,
  p_ip_hash_signature text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_agency uuid := private.estimation_target_agency();
  signing_secret text;
  lead_id uuid;
  ip_count integer;
  agency_count integer;
  channel_row record;
  ip_window interval := interval '10 minutes';
  ip_limit integer := 3;
  agency_window interval := interval '1 hour';
  agency_limit integer := 30;
begin
  if p_website is not null and length(btrim(p_website)) > 0 then
    raise exception 'estimation_request_invalid' using errcode = 'P0001';
  end if;

  if p_ip_hash is null or length(btrim(p_ip_hash)) = 0 or length(p_ip_hash) > 128 then
    raise exception 'estimation_request_invalid' using errcode = 'P0001';
  end if;

  -- SEC-001: the bucket must be signed by the server, recently. Checked
  -- before anything else is read or written.
  signing_secret := private.estimation_ip_hmac_secret();
  if signing_secret is null or char_length(signing_secret) < 32 then
    raise exception 'estimation_unavailable' using errcode = 'P0001';
  end if;
  if not private.estimation_ip_signature_valid(p_ip_hash, p_ip_hash_issued_at, p_ip_hash_signature, signing_secret) then
    raise exception 'estimation_signature_invalid' using errcode = 'P0001';
  end if;

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
    raise exception 'estimation_agency_unavailable' using errcode = 'P0001';
  end if;

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
  boolean, boolean, boolean, boolean, text, text, text, bigint, text
) from public;
grant execute on function public.submit_estimation_request(
  text, text, text, text, public.property_type, text, text, numeric, smallint, text,
  boolean, boolean, boolean, boolean, text, text, text, bigint, text
) to anon, authenticated;
