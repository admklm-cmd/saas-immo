import { createClient } from "@supabase/supabase-js";

import type { PipelineStage } from "@/features/contacts/types";
import { assertLocalSupabaseUrl } from "@/lib/supabase/local-only";
import type { Database } from "@/types/database";

import { adminClient, E2E_CONTEXT as CONTEXT, loadLocalEnv } from "./local-supabase";
import { fixtureUser } from "./sign-in";

/**
 * Puts a fixture contact back on the stage the journey started from, so the
 * pipeline suite can be replayed without reloading the whole fixtures and
 * never leaks a moved card into another spec of the same run.
 *
 * The database refuses ANY direct write into or out of `mandat_signe`, even
 * with the secret key (guard trigger). So, exactly like a user would, the
 * restore goes through `change_contact_stage` signed in as the fictitious
 * director, with an explicit confirmation and a motive. Local stack only.
 */
export async function restoreContactStage(contactId: string, stage: PipelineStage): Promise<void> {
  const admin = adminClient();
  const current = await admin.from("contacts").select("stage").eq("id", contactId).single();
  if (current.error) {
    throw new Error(`${CONTEXT}: could not read the stage of ${contactId}: ${current.error.message}`);
  }
  if (current.data.stage === stage) return;

  loadLocalEnv();
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, CONTEXT);
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error(`${CONTEXT}: missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.`);

  const director = await fixtureUser("directorA");
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const session = await client.auth.signInWithPassword({ email: director.email, password: director.password });
  if (session.error) throw new Error(`${CONTEXT}: director sign-in failed: ${session.error.message}`);

  const { error } = await client.rpc("change_contact_stage", {
    target_contact: contactId,
    new_stage: stage,
    mandate_confirmed: true,
    reason: "Remise à l'état initial après les tests E2E du pipeline",
  });
  await client.auth.signOut();
  if (error) throw new Error(`${CONTEXT}: could not restore the stage of ${contactId}: ${error.message}`);
}
