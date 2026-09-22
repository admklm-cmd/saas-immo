import { adminClient, E2E_CONTEXT as CONTEXT } from "./local-supabase";

/**
 * E2E-only helpers that flip an agency flag (the AI kill switch) or prepare a
 * replayable starting state directly in the LOCAL database, so a journey can be
 * tested against a real refused action.
 *
 * Same safety rules as the fixtures loader: local Supabase only, never a
 * production environment, no hard-coded secret (everything comes from the
 * environment). The client and its guards live in `./local-supabase`.
 */

/**
 * Removes what a previous Louis run created for a contact (proposed
 * appointment + draft message), so the journey can be replayed without
 * reloading the whole fixtures. Fixture rows are left untouched: only the
 * `louis-<runId>` idempotency keys are deleted.
 */
export async function clearLouisArtefacts(contactId: string): Promise<void> {
  const admin = adminClient();

  const messages = await admin
    .from("outbound_messages")
    .delete()
    .eq("contact_id", contactId)
    .like("idempotency_key", "louis-%");
  if (messages.error) {
    throw new Error(`${CONTEXT}: could not clean outbound messages of ${contactId}: ${messages.error.message}`);
  }

  const appointments = await admin
    .from("appointments")
    .delete()
    .eq("contact_id", contactId)
    .eq("status", "proposed");
  if (appointments.error) {
    throw new Error(`${CONTEXT}: could not clean appointments of ${contactId}: ${appointments.error.message}`);
  }
}

/**
 * Removes what a previous Emma run created for a contact (the follow-up
 * draft), so the "relances" journey can be replayed without reloading the
 * whole fixtures. Emma's idempotency key is `emma-<contactId>-<Paris day>`,
 * one per contact per calendar day: without this cleanup, a second run the
 * same day would be refused by the database as a duplicate. Fixture rows are
 * left untouched.
 */
export async function clearEmmaArtefacts(contactId: string): Promise<void> {
  const admin = adminClient();

  const { error } = await admin
    .from("outbound_messages")
    .delete()
    .eq("contact_id", contactId)
    .like("idempotency_key", "emma-%");
  if (error) {
    throw new Error(`${CONTEXT}: could not clean Emma's drafts of ${contactId}: ${error.message}`);
  }
}

/** Idempotency prefix of the drafts this suite creates and cleans up itself. */
const E2E_DRAFT_PREFIX = "e2e-validation";

/**
 * Puts a known number of drafts in the « à valider » queue.
 *
 * The journey consumes drafts (validating, sending and refusing are one-way
 * transitions), so it cannot rely on the fixture rows: it would only be
 * replayable once. Rows created here carry their own idempotency keys, are
 * deleted before being recreated, and never touch the fixture messages.
 */
export async function resetValidationQueue(
  agencyId: string,
  contactId: string,
  count: number,
): Promise<void> {
  const admin = adminClient();

  const cleaned = await admin
    .from("outbound_messages")
    .delete()
    .eq("agency_id", agencyId)
    .like("idempotency_key", `${E2E_DRAFT_PREFIX}-%`);
  if (cleaned.error) {
    throw new Error(`${CONTEXT}: could not clean the validation queue: ${cleaned.error.message}`);
  }

  const drafts = Array.from({ length: count }, (_, index) => ({
    agency_id: agencyId,
    contact_id: contactId,
    channel: "email" as const,
    subject: `Brouillon de test ${index + 1}`,
    body:
      `Bonjour,\n\nBrouillon fictif numéro ${index + 1} préparé pour les tests de bout en bout.\n\n` +
      "Calanques Immobilier (fictive)\n\nPour ne plus recevoir nos messages, répondez STOP.",
    status: "pending_validation" as const,
    is_simulation: true,
    created_by_agent: "emma" as const,
    idempotency_key: `${E2E_DRAFT_PREFIX}-${index + 1}`,
  }));

  const { error } = await admin.from("outbound_messages").insert(drafts);
  if (error) {
    throw new Error(`${CONTEXT}: could not seed the validation queue: ${error.message}`);
  }
}

/** Turns the agency-wide AI kill switch on or off. */
export async function setAiPaused(agencyId: string, paused: boolean): Promise<void> {
  const { error } = await adminClient().from("agencies").update({ ai_paused: paused }).eq("id", agencyId);
  if (error) {
    throw new Error(`${CONTEXT}: could not set ai_paused=${paused} on ${agencyId}: ${error.message}`);
  }
}
