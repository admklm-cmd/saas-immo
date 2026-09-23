import { adminClient, E2E_CONTEXT as CONTEXT } from "./local-supabase";

/**
 * Replayable starting state of the `/taches` journey.
 *
 * « Marquer comme faite » is one-way: the interface can never reopen a task.
 * So the journey never completes a fixture task — it completes its own, created
 * here with a dedicated machine type, deleted then recreated before each test.
 * Local Supabase only (guards in `./local-supabase`), no secret in the code.
 */

/** Machine type of the tasks owned by this suite (tasks.type format). */
export const E2E_TASK_TYPE = "e2e_task_journey";

/** Visible title of the task the journey marks as done. Plain text, no personal data. */
export const E2E_TASK_TITLE = "Tâche E2E : rappeler le vendeur pour fixer la visite";

/**
 * Deletes every task of this suite in the agency (whatever its status), then
 * opens exactly one, already overdue so it is listed first (earliest due date)
 * and appears under « En retard ».
 */
export async function resetE2eTask(agencyId: string, contactId: string): Promise<string> {
  const admin = adminClient();

  const cleaned = await admin.from("tasks").delete().eq("agency_id", agencyId).eq("type", E2E_TASK_TYPE);
  if (cleaned.error) {
    throw new Error(`${CONTEXT}: could not clean the E2E tasks: ${cleaned.error.message}`);
  }

  const dueAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("tasks")
    .insert({
      agency_id: agencyId,
      contact_id: contactId,
      type: E2E_TASK_TYPE,
      title: E2E_TASK_TITLE,
      status: "open",
      due_at: dueAt,
      created_by_agent: "hugo",
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`${CONTEXT}: could not create the E2E task: ${error.message}`);
  }
  return data.id;
}

/** Removes the tasks of this suite, so no other journey inherits them. */
export async function clearE2eTasks(agencyId: string): Promise<void> {
  const { error } = await adminClient().from("tasks").delete().eq("agency_id", agencyId).eq("type", E2E_TASK_TYPE);
  if (error) {
    throw new Error(`${CONTEXT}: could not clean the E2E tasks: ${error.message}`);
  }
}
