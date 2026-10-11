-- =============================================================================
-- list_agency_members — read-only member list of the « Paramètres » screen
-- =============================================================================
-- Plan: docs/plans/2026-09-23-complete-demo.md, milestone 4 (settings page,
-- read-only). The screen shows who belongs to the agency: e-mail, role and
-- membership date. The e-mail lives in `auth.users`, which no client role may
-- read (and must not be able to: it also holds phone numbers, metadata,
-- sign-in history, hashed passwords). Hence a narrow SECURITY DEFINER function
-- that returns ONLY these four columns:
--
--   user_id, email, role, created_at (of the membership)
--
-- Nothing else is ever returned: no metadata, no phone, no last_sign_in_at,
-- no confirmation dates.
--
-- Scope of the caller:
--   * `target_agency` is the agency the application already resolved for the
--     session (lib/agents/context.ts: the caller's oldest membership). Passing
--     it keeps the list consistent with the rest of the page for a user who
--     belongs to several agencies (no second, possibly diverging, resolution
--     in SQL). It is NOT trusted: the function re-checks that the caller is a
--     member of it (`private.is_agency_member`, based on auth.uid()), and the
--     rows are additionally filtered by `private.member_agency_ids()`.
--   * A non-member, an unknown agency and an anonymous caller all get the
--     same `forbidden` (42501): the existence of another agency is not
--     disclosed.
--   * Any member (agent or director) sees the same list: reading the team is
--     not a director privilege. Nothing here writes.
--
-- Privileges: EXECUTE for `authenticated` only. `anon` and `service_role` are
-- revoked explicitly (Supabase grants EXECUTE on new public functions to both
-- by default). A server job that needs the member list has no use for this
-- session-bound function (auth.uid() is null there anyway).
-- =============================================================================

create function public.list_agency_members(target_agency uuid)
returns table (
  user_id uuid,
  email text,
  role public.membership_role,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or target_agency is null
     or not private.is_agency_member(target_agency) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.agency_id = target_agency
      -- Defence in depth: never outside the caller's own agencies, even if
      -- the check above were changed.
      and m.agency_id in (select private.member_agency_ids())
    order by m.created_at asc, m.user_id asc;
end;
$$;

comment on function public.list_agency_members(uuid) is
  'Members of one agency of the caller (user_id, email, role, membership created_at) for the read-only settings screen. Caller must be a member; forbidden otherwise.';

revoke all on function public.list_agency_members(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_agency_members(uuid) to authenticated;
