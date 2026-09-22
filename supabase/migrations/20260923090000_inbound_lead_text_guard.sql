-- =============================================================================
-- AiaA — refuse raw control characters in an inbound lead.
--
-- Why a NEW migration (20260922120000 is applied and is never edited):
-- `public.submit_estimation_request` is granted to `anon`, so ANY caller with
-- the public publishable key can call it directly, bypassing
-- `features/estimation/types.ts` entirely. That zod schema now refuses control
-- characters and refuses line breaks inside a name — this migration makes the
-- database refuse the same thing, so the rule holds on the path an attacker
-- actually uses, not only on the path a browser uses.
--
-- Concretely, what this stops (audit of 2026-09-23, agent `cybersecurite`):
--   * `payload -> 'first_name'` = 'Jean\r\nBcc: attaquant@evil.test' was
--     accepted and stored verbatim. Léa copies that payload field into
--     `contacts.first_name`, and CRM values end up inside the messages the
--     agents assemble: a `\r\n` in a name is the classic way to smuggle an
--     extra email header the day a real provider is connected.
--   * ESC / DEL / other C0 bytes in `raw_text` or in a payload value, which
--     make a log line, a terminal or a CSV export show something other than
--     what is stored.
--
-- Deliberately NOT rejected: tab, LF and CR inside `raw_text` (a visitor's
-- free-text message legitimately contains line breaks — same allowed set as
-- `CONTROL_CHARACTER_PATTERN` in `lib/claude/schemas.ts`). Line breaks are only
-- refused in the structured identity/address fields of `payload`, where no
-- legitimate value ever contains one.
--
-- The exception rolls the whole submission back (the estimation function has
-- no `EXCEPTION WHEN` block): no lead, no consent, no rate-limit row.
-- =============================================================================

create function private.guard_inbound_lead_text()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Built with chr() rather than a regex escape so the class is unambiguous
  -- and this file stays plain ASCII text (a control byte written raw in a
  -- source file makes it unreviewable — see docs/security.md §2.4).
  -- NUL is absent on purpose: Postgres text can never contain it.
  control_class constant text :=
    '[' || chr(1) || '-' || chr(8) || chr(11) || chr(12) || chr(14) || '-' || chr(31) || chr(127) || ']';
  -- Tab, LF, CR — refused only in the structured identity keys below.
  line_break_class constant text := '[' || chr(9) || chr(10) || chr(13) || ']';
  -- Payload keys that must stay on a single line: they become a contact's
  -- identity, and from there a message header or a CSV column.
  single_line_keys constant text[] := array['first_name', 'last_name', 'email', 'phone', 'city', 'postal_code'];
begin
  if coalesce(new.raw_text, '') ~ control_class then
    raise exception 'inbound_lead_unsafe_text' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_each_text(new.payload) as entry(key, value)
    where entry.value ~ control_class
       or (entry.key = any (single_line_keys) and entry.value ~ line_break_class)
  ) then
    raise exception 'inbound_lead_unsafe_text' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_inbound_lead_text() from public;

create trigger guard_inbound_lead_text before insert or update on public.inbound_leads
  for each row execute function private.guard_inbound_lead_text();
