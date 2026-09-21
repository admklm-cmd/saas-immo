"use server";

/**
 * Server actions of Louis — rendez-vous.
 *
 * The action only builds the request-scoped Supabase client (session cookies,
 * RLS applies) and delegates to `runLouisAppointment`, which re-checks the
 * session, the agency and every guard rail server-side.
 *
 * An AI agent is never called from a client component: this is the only entry
 * point exposed to the UI.
 */

import { failWith } from "@/lib/agents/errors";
import { parseContactId, parseUuid } from "@/lib/agents/input";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { runLouisAppointment, type LouisRunResult } from "./louis";
import { confirmProposedAppointment } from "../appointment-workflow";
import type { HumanAppointmentResult } from "../types";

export async function proposeAppointment(contactId: string): Promise<Result<LouisRunResult>> {
  // A server action is a public endpoint: the argument is validated at runtime,
  // whatever its declared type. Same generic answer as "unknown contact".
  const id = parseContactId(contactId);
  if (id === null) return failWith<LouisRunResult>("contact_not_found");

  const client = await createClient();
  return runLouisAppointment(client, id);
}

/** Human confirmation of the slot proposed by Louis. */
export async function confirmAppointment(
  appointmentId: string,
): Promise<Result<HumanAppointmentResult>> {
  const id = parseUuid(appointmentId);
  if (id === null) return failWith<HumanAppointmentResult>("appointment_not_found");

  const client = await createClient();
  return confirmProposedAppointment(client, id);
}
