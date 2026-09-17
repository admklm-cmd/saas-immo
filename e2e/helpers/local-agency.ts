import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertLocalSupabaseUrl, assertNotProduction } from "@/lib/supabase/local-only";
import type { Database } from "@/types/database";

/**
 * E2E-only helper to flip an agency flag (the AI kill switch) directly in the
 * LOCAL database, so the journey can be tested against a real refused action.
 *
 * Same safety rules as the fixtures loader: local Supabase only, never a
 * production environment, no hard-coded secret (everything comes from the
 * environment).
 */

const CONTEXT = "E2E tests";
/** Playwright always runs from the project root. */
const ROOT = process.cwd();

let loaded = false;

function loadEnvFiles(): void {
  if (loaded) return;
  // `process.loadEnvFile` never overwrites an already-defined variable:
  // shell environment > .env.local > .env (same precedence as Next.js).
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      // Missing file: the variables may already come from the shell.
    }
  }
  loaded = true;
}

function adminClient(): SupabaseClient<Database> {
  loadEnvFiles();
  assertNotProduction(CONTEXT);
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, CONTEXT);
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(`${CONTEXT}: missing SUPABASE_SECRET_KEY (see .env.example, \`npx supabase status\`).`);
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

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
