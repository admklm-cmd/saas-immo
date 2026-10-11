-- =============================================================================
-- AiaA — `tasks`: human to-do list of the agency.
--
-- Why a dedicated table (and not `activities`): `activities` is the append-only
-- CRM history (an event happened, it can never be closed). A task is a piece of
-- work that has a lifecycle: open -> done | cancelled. Two product rules need it:
--   * Hugo must never invent a missing piece of information: he opens a
--     "missing information" task for a human instead.
--   * Any invalid AI output falls back safely to "no action + task for a human".
--
-- Same principles as every other business table (see 20260915120000_init.sql):
--   * agency_id on the row, immutable after creation (trigger).
--   * RLS enabled, SELECT/INSERT/UPDATE/DELETE restricted to agency members.
--   * `anon` has no privilege at all.
--   * Cross-agency integrity via composite foreign keys (agency_id, <fk>).
--   * Closure stamps (completed_at / completed_by) are set by the server, never
--     trusted from the client — same approach as outbound_messages.validated_*.
-- =============================================================================

create type public.task_status as enum ('open', 'done', 'cancelled');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- NULL for an agency-level task (e.g. "review the kill switch").
  contact_id uuid,
  -- Same shape as activities.type: a stable machine-readable key.
  type text not null check (type ~ '^[a-z][a-z0-9_]{1,63}$'),
  title text not null check (char_length(title) between 1 and 200),
  details text check (char_length(details) <= 5000),
  status public.task_status not null default 'open',
  due_at timestamptz,
  assigned_user_id uuid,
  -- Which AI agent opened the task (NULL when a human or the system did).
  created_by_agent public.ai_agent_name,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_contact_fkey foreign key (agency_id, contact_id)
    references public.contacts (agency_id, id) on delete cascade,
  constraint tasks_assigned_user_fkey foreign key (agency_id, assigned_user_id)
    references public.memberships (agency_id, user_id) on delete set null (assigned_user_id),
  constraint tasks_completed_by_fkey foreign key (agency_id, completed_by)
    references public.memberships (agency_id, user_id) on delete set null (completed_by),
  -- A task is completed if and only if it is 'done'.
  constraint tasks_completed_at_consistent check ((status = 'done') = (completed_at is not null)),
  -- completed_by implies completed_at. The reverse is not required: when the
  -- member who closed the task leaves the agency, completed_by is set to NULL
  -- by the FK but completed_at stays as evidence of the closure.
  constraint tasks_completed_by_consistent check (completed_by is null or completed_at is not null)
);

create index tasks_agency_id_status_idx on public.tasks (agency_id, status);
create index tasks_agency_id_contact_id_idx on public.tasks (agency_id, contact_id);
create index tasks_agency_id_assigned_user_id_idx on public.tasks (agency_id, assigned_user_id);
create index tasks_agency_id_due_at_idx on public.tasks (agency_id, due_at) where status = 'open';
create index tasks_agency_id_completed_by_idx on public.tasks (agency_id, completed_by);

-- Anti-duplicate. A task is identified by what it is about: (contact, type).
-- Rerunning Hugo on the same contact, or two different agents reaching the same
-- conclusion, must not pile up identical open tasks in the agency's inbox.
-- The uniqueness is deliberately NOT scoped to created_by_agent: "information
-- manquante pour ce contact" is one job to do, whoever noticed it. Closing or
-- cancelling the task frees the slot, so the same task can legitimately be
-- opened again later.
-- Agency-level tasks (contact_id IS NULL) are not deduplicated: NULLs are
-- distinct in a unique index, and those tasks are rare and human-created.
create unique index tasks_open_contact_type_key
  on public.tasks (agency_id, contact_id, type)
  where status = 'open' and contact_id is not null;

-- -----------------------------------------------------------------------------
-- Closure guard: the server stamps who closed the task and when.
-- -----------------------------------------------------------------------------
create function private.guard_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
    return new;
  end if;

  if tg_op = 'INSERT' or old.status <> 'done' then
    new.completed_at := now();
    if caller is not null then
      if new.completed_by is not null and new.completed_by <> caller then
        raise exception 'completed_by_must_be_caller' using errcode = '42501';
      end if;
      new.completed_by := caller;
    end if;
    return new;
  end if;

  -- Already done: the closure stamp is evidence, it cannot be rewritten.
  -- Only clearing completed_by is accepted (FK action ON DELETE SET NULL).
  new.completed_at := old.completed_at;
  if new.completed_by is not null and new.completed_by is distinct from old.completed_by then
    raise exception 'task_completion_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_task() from public;

create trigger set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger prevent_agency_id_change before update on public.tasks
  for each row execute function private.prevent_agency_id_change();
create trigger guard_task before insert or update on public.tasks
  for each row execute function private.guard_task();

-- -----------------------------------------------------------------------------
-- Privileges: nothing for anon, least privilege for authenticated.
-- -----------------------------------------------------------------------------
revoke all on table public.tasks from anon, authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.tasks enable row level security;

create policy "tasks_select_members" on public.tasks
  for select to authenticated
  using (agency_id in (select private.member_agency_ids()));
create policy "tasks_insert_members" on public.tasks
  for insert to authenticated
  with check (agency_id in (select private.member_agency_ids()));
create policy "tasks_update_members" on public.tasks
  for update to authenticated
  using (agency_id in (select private.member_agency_ids()))
  with check (agency_id in (select private.member_agency_ids()));
create policy "tasks_delete_members" on public.tasks
  for delete to authenticated
  using (agency_id in (select private.member_agency_ids()));
