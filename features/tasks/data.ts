/**
 * Tasks domain — read and write implementations.
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts` /
 * `actions.ts`, a real session in the integration tests): RLS always applies,
 * the service_role client is never used here. The agency is re-resolved
 * server-side from the session (`resolveAgentContext`), never read from the
 * browser. Nothing throws: every failure is `{ data: null, error }` with a
 * French message, the technical detail being logged server-side only.
 */

import { requireExactCount } from "@/features/agents-ia/activity";
import { NO_NAME_LABEL } from "@/features/contacts/data";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected } from "@/lib/agents/errors";
import { AGENCY_TIME_ZONE } from "@/lib/agents/time";
import type { TypedClient } from "@/lib/agents/types";
import { buildPage, isRangeNotSatisfiable } from "@/lib/utils/pagination";
import { fail, ok, type Result } from "@/lib/utils/result";

import {
  OPEN_TASK_STATUS,
  TASK_ERROR_MESSAGES,
  openTasksInputSchema,
  type CompletedTask,
  type OpenTaskItem,
  type OpenTasksInput,
  type OpenTasksPage,
  type TaskErrorCode,
} from "./types";

const TASK_LIST_COLUMNS =
  "id, contact_id, type, title, due_at, assigned_user_id, created_by_agent, created_at, contacts!tasks_contact_fkey(first_name, last_name)";

function failTask<T>(code: TaskErrorCode): Result<T> {
  return fail<T>(code, TASK_ERROR_MESSAGES[code]);
}

/** PostgREST spells UTC as "+00:00"; the UI gets one stable format. */
function isoUtc(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

type ContactNameRow = { first_name: string | null; last_name: string | null };

function contactName(contact: ContactNameRow | null | undefined): string {
  const name = [contact?.first_name, contact?.last_name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
  return name.length > 0 ? name : NO_NAME_LABEL;
}

type TaskRow = {
  id: string;
  contact_id: string | null;
  type: string;
  title: string;
  due_at: string | null;
  assigned_user_id: string | null;
  created_by_agent: OpenTaskItem["createdByAgent"];
  created_at: string;
  contacts: ContactNameRow | null;
};

/**
 * A due date is an absolute instant (`timestamptz`): "overdue" is "strictly
 * before the instant of the read", which is the same in every time zone. The
 * screen displays the dates in Europe/Paris (`timeZone` of the page).
 */
export function isTaskOverdue(dueAt: string | null, now: Date): boolean {
  if (dueAt === null) return false;
  const due = Date.parse(dueAt);
  return !Number.isNaN(due) && due < now.getTime();
}

export function toOpenTaskItem(row: TaskRow, now: Date): OpenTaskItem {
  const dueAt = row.due_at ? isoUtc(row.due_at) : null;
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    dueAt,
    isOverdue: isTaskOverdue(dueAt, now),
    contactId: row.contact_id,
    contactName: row.contact_id === null ? null : contactName(row.contacts),
    assignedUserId: row.assigned_user_id,
    createdByAgent: row.created_by_agent,
    createdAt: isoUtc(row.created_at),
  };
}

/**
 * The open tasks of the caller's agency, one page at a time, with the EXACT
 * total of the chosen scope. Scope `all` counts the same rows as the
 * dashboard's `openTasks` (`agency_id` + status `open`).
 *
 * `now` is injectable for the tests; the server always uses the real instant.
 */
export async function listOpenTasks(
  client: TypedClient,
  input: OpenTasksInput = {},
  now: Date = new Date(),
): Promise<Result<OpenTasksPage>> {
  try {
    const parsed = openTasksInputSchema.safeParse(input ?? {});
    if (!parsed.success) return failTask<OpenTasksPage>("invalid_task_filter");
    const query = parsed.data;

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const { agencyId, userId } = contextResult.data;
    const nowIso = now.toISOString();

    // Built twice (page, then head count on an out-of-range page): same filter.
    const filtered = (columns: string, options: { count: "exact"; head?: boolean }) => {
      let builder = client
        .from("tasks")
        .select(columns, options)
        .eq("agency_id", agencyId)
        .eq("status", OPEN_TASK_STATUS);
      if (query.scope === "overdue") builder = builder.lt("due_at", nowIso);
      if (query.scope === "mine") builder = builder.eq("assigned_user_id", userId);
      return builder;
    };

    const response = await filtered(TASK_LIST_COLUMNS, { count: "exact" })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);

    let rows: TaskRow[];
    let totalResponse: { count: number | null; error: typeof response.error };
    if (response.error && isRangeNotSatisfiable(response.error)) {
      // Page past the end: empty page, but the total stays exact.
      rows = [];
      const head = await filtered("id", { count: "exact", head: true });
      totalResponse = { count: head.count, error: head.error };
    } else if (response.error) {
      return failFromDatabase<OpenTasksPage>("listOpenTasks", response.error);
    } else {
      rows = (response.data ?? []) as unknown as TaskRow[];
      totalResponse = { count: response.count, error: null };
    }

    const total = requireExactCount("listOpenTasks.count", totalResponse);
    if (total.error) return { data: null, error: total.error };

    const items = rows.map((row) => toOpenTaskItem(row, now));
    return ok({
      ...buildPage(items, total.data, query, nowIso),
      scope: query.scope,
      timeZone: AGENCY_TIME_ZONE as "Europe/Paris",
    });
  } catch (cause) {
    return failFromUnexpected<OpenTasksPage>("listOpenTasks", cause);
  }
}

/**
 * Marks an open task of the caller's agency as done.
 *
 * * Only an `open` task is closed (conditional UPDATE): a second call — double
 *   click, two tabs — answers « Cette tâche est déjà terminée. », never a
 *   technical error, and never rewrites the closure stamp.
 * * `completed_at` and `completed_by` are stamped by the database trigger
 *   (`private.guard_task`): `now()` and `auth.uid()`. The browser sends neither.
 * * A task of another agency answers exactly like an unknown one (RLS + agency
 *   filter): « Tâche introuvable. ».
 *
 * No `activities` row is written: the contact's history already reads the
 * task itself (title + status), so a closed task shows up there as « Terminée ».
 */
export async function completeOpenTask(client: TypedClient, taskId: string): Promise<Result<CompletedTask>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const { agencyId, userId } = contextResult.data;

    const updated = await client
      .from("tasks")
      .update({ status: "done", completed_by: userId })
      .eq("id", taskId)
      .eq("agency_id", agencyId)
      .eq("status", OPEN_TASK_STATUS)
      .select("id, contact_id, status, completed_at")
      .maybeSingle();

    if (updated.error) return failFromDatabase<CompletedTask>("completeTask.update", updated.error);

    if (updated.data) {
      const row = updated.data;
      if (row.status !== "done" || row.completed_at === null) {
        console.error("[tasks] completeTask: unexpected row after update");
        return failFromUnexpected<CompletedTask>("completeTask", new Error("inconsistent closure"));
      }
      return ok({
        id: row.id,
        contactId: row.contact_id,
        status: "done",
        completedAt: isoUtc(row.completed_at),
      });
    }

    // Nothing updated: tell "already done" / "cancelled" apart from "unknown".
    const existing = await client
      .from("tasks")
      .select("id, status")
      .eq("id", taskId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (existing.error) return failFromDatabase<CompletedTask>("completeTask.lookup", existing.error);
    if (!existing.data) return failTask<CompletedTask>("task_not_found");
    if (existing.data.status === "done") return failTask<CompletedTask>("task_already_done");
    if (existing.data.status === "cancelled") return failTask<CompletedTask>("task_cancelled");

    // Still open yet not updated: not something the user can fix.
    console.error("[tasks] completeTask: open task was not updated");
    return failFromUnexpected<CompletedTask>("completeTask", new Error("open task not updated"));
  } catch (cause) {
    return failFromUnexpected<CompletedTask>("completeTask", cause);
  }
}
