/**
 * Human bridge between Louis and Sarah.
 *
 * Louis only proposes a slot. A member confirms it, then records the completed
 * meeting and its report. PostgreSQL owns the state machine, the contact-stage
 * change and the append-only audit, so they commit or fail together.
 */

import { failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import { resolveAgentContext } from "@/lib/agents/context";
import type { AgentContext, TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  APPOINTMENT_STATUS_LABELS,
  appointmentCompletionSchema,
  type AppointmentCompletionInput,
  type HumanAppointmentResult,
} from "./types";

type AppointmentRow = {
  id: string;
  contact_id: string;
  status: "proposed" | "confirmed" | "cancelled" | "done";
  is_simulation: boolean;
};

async function loadAppointment(
  client: TypedClient,
  context: AgentContext,
  appointmentId: string,
): Promise<Result<AppointmentRow>> {
  const { data, error } = await client
    .from("appointments")
    .select("id, contact_id, status, is_simulation")
    .eq("agency_id", context.agencyId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) return failFromDatabase<AppointmentRow>("loadHumanAppointment", error);
  if (!data) return failWith<AppointmentRow>("appointment_not_found");
  return ok(data as AppointmentRow);
}

async function readContactStage(
  client: TypedClient,
  context: AgentContext,
  contactId: string,
): Promise<Result<HumanAppointmentResult["stage"]>> {
  const { data, error } = await client
    .from("contacts")
    .select("stage")
    .eq("agency_id", context.agencyId)
    .eq("id", contactId)
    .single();
  if (error || !data) {
    return error
      ? failFromDatabase<HumanAppointmentResult["stage"]>("readAppointmentContactStage", error)
      : failWith<HumanAppointmentResult["stage"]>("contact_not_found");
  }
  return ok(data.stage);
}

/** Confirms Louis's proposal and atomically moves the contact to `rdv_planifie`. */
export async function confirmProposedAppointment(
  client: TypedClient,
  appointmentId: string,
): Promise<Result<HumanAppointmentResult>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context = contextResult.data;

    const loaded = await loadAppointment(client, context, appointmentId);
    if (loaded.error) return { data: null, error: loaded.error };
    if (loaded.data.status !== "proposed") {
      return failWith<HumanAppointmentResult>("appointment_not_proposed");
    }

    const { data, error } = await client
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("agency_id", context.agencyId)
      .eq("id", appointmentId)
      .eq("status", "proposed")
      .select("id, contact_id, status, is_simulation")
      .maybeSingle();

    if (error) return failFromDatabase<HumanAppointmentResult>("confirmProposedAppointment", error);
    if (!data) return failWith<HumanAppointmentResult>("appointment_not_proposed");

    const stage = await readContactStage(client, context, data.contact_id);
    if (stage.error) return { data: null, error: stage.error };

    return ok({
      appointmentId: data.id,
      contactId: data.contact_id,
      status: "confirmed",
      statusLabel: APPOINTMENT_STATUS_LABELS.confirmed,
      stage: stage.data,
      isSimulation: data.is_simulation,
      reportRecordedAt: null,
    });
  } catch (cause) {
    return failFromUnexpected<HumanAppointmentResult>("confirmProposedAppointment", cause);
  }
}

/**
 * Marks a confirmed appointment as completed and records the human report in
 * the same statement. Sarah may be launched only after this succeeds.
 */
export async function completeConfirmedAppointment(
  client: TypedClient,
  appointmentId: string,
  input: AppointmentCompletionInput,
): Promise<Result<HumanAppointmentResult>> {
  try {
    const parsed = appointmentCompletionSchema.safeParse(input);
    if (!parsed.success) return failWith<HumanAppointmentResult>("appointment_report_invalid");

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context = contextResult.data;

    const loaded = await loadAppointment(client, context, appointmentId);
    if (loaded.error) return { data: null, error: loaded.error };
    if (loaded.data.status !== "confirmed") {
      return failWith<HumanAppointmentResult>("appointment_not_confirmed");
    }

    const { data, error } = await client
      .from("appointments")
      .update({
        status: "done",
        report_notes: parsed.data.reportNotes,
        // The existing database guard verifies and stamps the authenticated
        // author; a forged user id is rejected.
        report_recorded_by: context.userId,
      })
      .eq("agency_id", context.agencyId)
      .eq("id", appointmentId)
      .eq("status", "confirmed")
      .select("id, contact_id, status, is_simulation, report_recorded_at")
      .maybeSingle();

    if (error) return failFromDatabase<HumanAppointmentResult>("completeConfirmedAppointment", error);
    if (!data) return failWith<HumanAppointmentResult>("appointment_not_confirmed");

    const stage = await readContactStage(client, context, data.contact_id);
    if (stage.error) return { data: null, error: stage.error };

    return ok({
      appointmentId: data.id,
      contactId: data.contact_id,
      status: "done",
      statusLabel: APPOINTMENT_STATUS_LABELS.done,
      stage: stage.data,
      isSimulation: data.is_simulation,
      reportRecordedAt: data.report_recorded_at
        ? new Date(Date.parse(data.report_recorded_at)).toISOString()
        : null,
    });
  } catch (cause) {
    return failFromUnexpected<HumanAppointmentResult>("completeConfirmedAppointment", cause);
  }
}
