"use server";

/**
 * Server actions of the tasks domain — a HUMAN member of the agency closes a
 * task.
 *
 * The identifier is validated with zod before anything else; the session and
 * the agency are re-resolved server-side in `data.ts`; RLS and the
 * `guard_task` trigger check everything again in the database.
 */

import { revalidatePath } from "next/cache";

import { parseUuid } from "@/lib/agents/input";
import { createClient } from "@/lib/supabase/server";
import { fail, type Result } from "@/lib/utils/result";

import { completeOpenTask } from "./data";
import { TASK_ERROR_MESSAGES, type CompletedTask } from "./types";

/**
 * Marks an open task as done (« Marquer comme faite »).
 *
 * Errors (French `error.message`, ready to display):
 *   * `task_not_found`     — unknown id, malformed id, or another agency's task;
 *   * `task_already_done`  — already closed (double click): not a failure to alarm about;
 *   * `task_cancelled`     — the task was cancelled;
 *   * `not_authenticated` / `no_agency` / `forbidden` / `unexpected_error`.
 */
export async function completeTask(taskId: string): Promise<Result<CompletedTask>> {
  const id = parseUuid(taskId);
  if (id === null) return fail<CompletedTask>("task_not_found", TASK_ERROR_MESSAGES.task_not_found);

  const client = await createClient();
  const result = await completeOpenTask(client, id);

  if (result.data) {
    revalidatePath("/taches");
    revalidatePath("/dashboard");
    if (result.data.contactId) revalidatePath(`/contacts/${result.data.contactId}`);
  }

  return result;
}
