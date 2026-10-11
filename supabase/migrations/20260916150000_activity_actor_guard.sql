-- =============================================================================
-- AiaA — `activities`: the author of a history entry can no longer be forged.
--
-- Problem found by the security audit (task 7): `activities` is the APPEND-ONLY
-- CRM history, but any authenticated member could insert a row claiming
-- `actor_type = 'ai_agent'` (with the agent name of their choice) or
-- `actor_type = 'system'`, and could freely set `is_simulation = false`.
--
-- Two consequences, both unacceptable for this product:
--   * repudiation — a human action could be permanently attributed to Léa,
--     Hugo, Emma, Louis or Sarah in a journal that can never be corrected;
--   * a simulated action could be displayed WITHOUT the « simulation » badge
--     (the UI reads `is_simulation`), i.e. exactly the confusion between a
--     simulated and a real action that CLAUDE.md forbids.
--
-- Rule enforced here, for any caller that has a session (`auth.uid()` is not
-- null, i.e. every request coming from the application):
--   * `actor_type = 'user'`     → allowed (RLS already forces
--                                 `actor_user_id = auth.uid()`);
--   * `actor_type = 'ai_agent'` → allowed ONLY while a run of that same agent,
--                                 in that same agency, started by that same
--                                 user, is still open in `ai_agent_runs`.
--                                 `is_simulation` is then STAMPED FROM THE RUN,
--                                 never trusted from the client;
--   * `actor_type = 'system'`   → refused (a user is not the system).
--
-- Server-side tasks that legitimately run without a session (fixtures loader,
-- seed, future scheduled jobs — service role, `auth.uid()` is null) keep
-- writing whatever they need: they are trusted code, not a browser request.
--
-- Nothing else changes: no policy is loosened, no privilege is added.
-- =============================================================================

create function private.guard_activity_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  run_is_simulation boolean;
begin
  -- No session: trusted server-side task (service role). Nothing to bind to.
  if caller is null then
    return new;
  end if;

  if new.actor_type = 'user' then
    return new;
  end if;

  if new.actor_type <> 'ai_agent' then
    -- 'system' claimed by a human.
    raise exception 'activity_actor_forged' using errcode = '42501';
  end if;

  -- An AI entry must be backed by a real, open run of the same agent, started
  -- by the same user, for the same agency.
  select r.is_simulation
    into run_is_simulation
    from public.ai_agent_runs r
    where r.agency_id = new.agency_id
      and r.agent = new.actor_agent
      and r.status = 'running'
      and r.triggered_by_user_id = caller
    order by r.started_at desc
    limit 1;

  if run_is_simulation is null then
    raise exception 'activity_actor_forged' using errcode = '42501';
  end if;

  -- Stamped by the server from the run that is actually happening.
  new.is_simulation := run_is_simulation;
  return new;
end;
$$;

revoke all on function private.guard_activity_actor() from public;

-- Runs before `stamp_activity_insert` (alphabetical order), which is
-- independent: it only stamps `created_at` and refuses a future `occurred_at`.
create trigger guard_activity_actor before insert on public.activities
  for each row execute function private.guard_activity_actor();
