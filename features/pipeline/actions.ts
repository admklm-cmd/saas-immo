"use server";

/**
 * Server actions of the pipeline — a HUMAN member of the agency moves a
 * contact to another stage.
 *
 * Builds the request-scoped Supabase client (session cookies, RLS applies —
 * never the service-role client) and delegates to `stage-change.ts`, which
 * validates the input with zod and calls `public.change_contact_stage`. The
 * database enforces the mandate rules and writes the append-only trace.
 */

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { changeStage } from "./stage-change";
import type { ChangeContactStageInput, ContactStageChange } from "./types";

/**
 * Moves a contact of the caller's agency to `input.stage`.
 *
 * - `mandat_signe` requires `mandateConfirmed: true` (checkbox ticked by the user);
 * - leaving `mandat_signe` requires a director, `mandateConfirmed: true` and a
 *   `reason` (3..500 characters).
 */
export async function changeContactStage(input: ChangeContactStageInput): Promise<Result<ContactStageChange>> {
  const client = await createClient();
  const result = await changeStage(client, input);

  if (result.data) {
    revalidatePath("/pipeline");
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${result.data.contactId}`);
    revalidatePath("/dashboard");
  }

  return result;
}
