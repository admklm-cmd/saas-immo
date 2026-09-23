/**
 * Tasks domain — types, input schemas and user-facing messages of the
 * `/taches` screen (the agency's open to-do list).
 *
 * A task is internal work for a human of the agency (often opened by an AI
 * agent that refused to invent a missing piece of information). The list only
 * exposes what the screen needs: no email, no phone number, no free-text
 * details (they stay on the contact file).
 */

import { z } from "zod";

import type { Enums } from "@/lib/agents/types";
import { paginationShape, type Page } from "@/lib/utils/pagination";

// -----------------------------------------------------------------------------
// Shared definition — the SAME as the dashboard's `openTasks` counter
// -----------------------------------------------------------------------------

/**
 * Status of a task still to do. `buildDashboardSummary` (`todo.openTasks`) and
 * `listOpenTasks` (scope `all`) both count `tasks` of the agency in this status,
 * so the dashboard figure equals the total of the `/taches` list.
 */
export const OPEN_TASK_STATUS = "open" as const satisfies Enums["task_status"];

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

/**
 * Which open tasks to list.
 *
 *   * `all`     — every open task of the agency (total = dashboard `openTasks`).
 *   * `overdue` — open tasks whose due date is strictly before the instant of
 *     the read (tasks without a due date are never overdue).
 *   * `mine`    — open tasks assigned to the signed-in user.
 */
export const TASK_SCOPES = ["all", "overdue", "mine"] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export const openTasksInputSchema = z
  .object({
    scope: z.enum(TASK_SCOPES).default("all"),
    ...paginationShape,
  })
  .strict();

export type OpenTasksInput = z.input<typeof openTasksInputSchema>;
export type OpenTasksQuery = z.output<typeof openTasksInputSchema>;

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/** One open task, as listed on `/taches`. Link: `/contacts/{contactId}` when set. */
export type OpenTaskItem = {
  id: string;
  title: string;
  /** Stable machine key (`missing_information`, …). */
  type: string;
  /** ISO-8601 UTC, or `null` when no due date was set. */
  dueAt: string | null;
  /** True when `dueAt` is strictly before `page.generatedAt` (computed server-side). */
  isOverdue: boolean;
  /** `null` for an agency-level task (not about one contact). */
  contactId: string | null;
  /** "Prénom Nom", "Contact sans nom", or `null` for an agency-level task. */
  contactName: string | null;
  assignedUserId: string | null;
  /** AI agent that opened the task, `null` when a human or the system did. */
  createdByAgent: Enums["ai_agent_name"] | null;
  /** ISO-8601 UTC. */
  createdAt: string;
};

/**
 * One page of open tasks. Order: earliest due date first, tasks without a due
 * date last, then oldest creation first (then id, for a stable pagination).
 */
export type OpenTasksPage = Page<OpenTaskItem> & {
  scope: TaskScope;
  /** Legal time zone of the agency: display every date in it. */
  timeZone: "Europe/Paris";
};

/** Returned by `completeTask` once the task is closed. */
export type CompletedTask = {
  id: string;
  contactId: string | null;
  status: "done";
  /** ISO-8601 UTC, stamped by the database (never by the browser). */
  completedAt: string;
};

// -----------------------------------------------------------------------------
// User-facing messages (French)
// -----------------------------------------------------------------------------

export const TASK_ERROR_MESSAGES = {
  // Deliberately identical for "unknown", "malformed id" and "belongs to
  // another agency": an error never reveals that another agency's task exists.
  task_not_found: "Tâche introuvable.",
  task_already_done: "Cette tâche est déjà terminée.",
  task_cancelled: "Cette tâche a été annulée : elle ne peut plus être marquée comme faite.",
  invalid_task_filter: "Filtre ou pagination invalide pour la liste des tâches.",
} as const;

export type TaskErrorCode = keyof typeof TASK_ERROR_MESSAGES;
