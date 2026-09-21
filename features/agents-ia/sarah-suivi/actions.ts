"use server";

/**
 * Server actions of Sarah — suivi.
 *
 * The action only builds the request-scoped Supabase client (session cookies,
 * RLS applies) and delegates to `runSarahFollowThrough`, which re-checks the
 * session, the agency and every guard rail server-side.
 *
 * An AI agent is never called from a client component: this is the only entry
 * point exposed to the UI.
 */

import { failWith } from "@/lib/agents/errors";
import { parseUuid } from "@/lib/agents/input";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { runSarahFollowThrough, type SarahRunResult } from "./sarah";
import { completeConfirmedAppointment } from "../appointment-workflow";
import type { AppointmentCompletionInput, HumanAppointmentResult } from "../types";

/** Records the completed meeting and its human-written report before Sarah. */
export async function completeAppointment(
  appointmentId: string,
  input: AppointmentCompletionInput,
): Promise<Result<HumanAppointmentResult>> {
  const id = parseUuid(appointmentId);
  if (id === null) return failWith<HumanAppointmentResult>("appointment_not_found");

  const client = await createClient();
  return completeConfirmedAppointment(client, id, input);
}

export async function followThroughAppointment(
  appointmentId: string,
): Promise<Result<SarahRunResult>> {
  // A server action is a public endpoint: the argument is validated at runtime,
  // whatever its declared type. Same generic answer as "unknown appointment".
  const id = parseUuid(appointmentId);
  if (id === null) return failWith<SarahRunResult>("appointment_not_found");

  const client = await createClient();
  return runSarahFollowThrough(client, id);
}
