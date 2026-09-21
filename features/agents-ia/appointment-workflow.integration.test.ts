import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { listAppointmentsToFollowThrough } from "./data";
import {
  completeConfirmedAppointment,
  confirmProposedAppointment,
} from "./appointment-workflow";

const REPORT =
  "Estimation réalisée sur place. Le vendeur souhaite relire l'avis de valeur et transmettre les diagnostics.";

let env: TestEnv;
let agentA: TypedClient;
let appointmentOffset = 0;

async function createProposedAppointment(label: string): Promise<{ id: string; contactId: string }> {
  const contact = await env.admin
    .from("contacts")
    .insert({
      agency_id: env.agencyA.agencyId,
      first_name: "Parcours",
      last_name: label,
      source: "manual_entry",
      stage: "chaud",
      assigned_user_id: env.users.agentA.id,
    })
    .select("id")
    .single();
  if (contact.error || !contact.data) throw new Error(contact.error?.message ?? "contact missing");

  const offset = appointmentOffset++;
  const startsAt = new Date(Date.UTC(2031, 0, 1, 8, 0) + offset * 3_600_000);
  const appointment = await env.admin
    .from("appointments")
    .insert({
      agency_id: env.agencyA.agencyId,
      contact_id: contact.data.id,
      assigned_user_id: env.users.agentA.id,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString(),
      status: "proposed",
      is_simulation: true,
    })
    .select("id")
    .single();
  if (appointment.error || !appointment.data) {
    throw new Error(appointment.error?.message ?? "appointment missing");
  }
  return { id: appointment.data.id, contactId: contact.data.id };
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("parcours humain Louis → Sarah", () => {
  it("confirme puis clôture avec un rapport estampillé et un audit atomique", async () => {
    const appointment = await createProposedAppointment("complet");

    const confirmed = await confirmProposedAppointment(agentA, appointment.id);
    expect(confirmed.error).toBeNull();
    expect(confirmed.data).toMatchObject({
      appointmentId: appointment.id,
      contactId: appointment.contactId,
      status: "confirmed",
      stage: "rdv_planifie",
      isSimulation: true,
    });

    const completed = await completeConfirmedAppointment(agentA, appointment.id, {
      reportNotes: `  ${REPORT}\u0000  `,
    });
    expect(completed.error).toBeNull();
    expect(completed.data).toMatchObject({ status: "done", stage: "rdv_planifie" });
    expect(completed.data!.reportRecordedAt).toBeTruthy();

    const stored = await env.admin
      .from("appointments")
      .select("status, report_notes, report_recorded_by, report_recorded_at")
      .eq("id", appointment.id)
      .single();
    expect(stored.error).toBeNull();
    expect(stored.data).toMatchObject({
      status: "done",
      report_notes: REPORT.replace("réalisée", "réalisée"),
      report_recorded_by: env.users.agentA.id,
    });
    expect(stored.data!.report_recorded_at).toBeTruthy();

    const audit = await env.admin
      .from("activities")
      .select("type, actor_type, actor_user_id, is_simulation")
      .eq("contact_id", appointment.contactId)
      .order("occurred_at", { ascending: true });
    expect(audit.error).toBeNull();
    expect(audit.data).toEqual([
      {
        type: "appointment_confirmed",
        actor_type: "user",
        actor_user_id: env.users.agentA.id,
        is_simulation: true,
      },
      {
        type: "appointment_completed",
        actor_type: "user",
        actor_user_id: env.users.agentA.id,
        is_simulation: true,
      },
    ]);
  });

  it("refuse de clôturer avant confirmation et ne laisse aucune écriture partielle", async () => {
    const appointment = await createProposedAppointment("trop-tot");
    const completed = await completeConfirmedAppointment(agentA, appointment.id, {
      reportNotes: REPORT,
    });
    expect(completed.data).toBeNull();
    expect(completed.error?.code).toBe("appointment_not_confirmed");

    const stored = await env.admin
      .from("appointments")
      .select("status, report_notes, report_recorded_by, report_recorded_at")
      .eq("id", appointment.id)
      .single();
    expect(stored.data).toEqual({
      status: "proposed",
      report_notes: null,
      report_recorded_by: null,
      report_recorded_at: null,
    });
  });

  it("cache les rendez-vous d'une autre agence", async () => {
    const result = await confirmProposedAppointment(agentA, env.agencyB.appointmentId);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("appointment_not_found");
  });

  it("expose les trois états et leurs actions humaines au frontend", async () => {
    const proposed = await createProposedAppointment("liste-propose");
    const confirmed = await createProposedAppointment("liste-confirme");
    const done = await createProposedAppointment("liste-realise");
    expect((await confirmProposedAppointment(agentA, confirmed.id)).error).toBeNull();
    expect((await confirmProposedAppointment(agentA, done.id)).error).toBeNull();
    expect(
      (await completeConfirmedAppointment(agentA, done.id, { reportNotes: REPORT })).error,
    ).toBeNull();

    const listed = await listAppointmentsToFollowThrough(agentA);
    expect(listed.error).toBeNull();
    const byId = new Map(listed.data!.map((row) => [row.id, row]));
    expect(byId.get(proposed.id)).toMatchObject({
      status: "proposed",
      statusLabel: "Proposé",
      canBeConfirmed: true,
      canBeCompleted: false,
      canBeFollowedThrough: false,
    });
    expect(byId.get(confirmed.id)).toMatchObject({
      status: "confirmed",
      statusLabel: "Confirmé",
      canBeConfirmed: false,
      canBeCompleted: true,
      canBeFollowedThrough: false,
    });
    expect(byId.get(done.id)).toMatchObject({
      status: "done",
      statusLabel: "Réalisé",
      canBeConfirmed: false,
      canBeCompleted: false,
      canBeFollowedThrough: true,
    });
  });

  it("la base refuse les contournements et les états terminaux", async () => {
    const appointment = await createProposedAppointment("garde-base");

    const skipped = await agentA
      .from("appointments")
      .update({ status: "done", report_notes: REPORT })
      .eq("id", appointment.id);
    expect(skipped.error?.message).toBe("appointment_invalid_transition");

    expect((await confirmProposedAppointment(agentA, appointment.id)).error).toBeNull();
    expect(
      (await completeConfirmedAppointment(agentA, appointment.id, { reportNotes: REPORT })).error,
    ).toBeNull();

    const rewritten = await agentA
      .from("appointments")
      .update({ report_notes: "Compte-rendu remplacé." })
      .eq("id", appointment.id);
    expect(rewritten.error?.message).toBe("appointment_terminal");
  });

  it("interdit à un membre de supprimer un rendez-vous proposé ou réalisé", async () => {
    const proposed = await createProposedAppointment("suppression-interdite");

    const proposedDelete = await agentA.from("appointments").delete().eq("id", proposed.id);
    expect(proposedDelete.error?.code).toBe("42501");

    expect((await confirmProposedAppointment(agentA, proposed.id)).error).toBeNull();
    expect(
      (await completeConfirmedAppointment(agentA, proposed.id, { reportNotes: REPORT })).error,
    ).toBeNull();

    const doneDelete = await agentA.from("appointments").delete().eq("id", proposed.id);
    expect(doneDelete.error?.code).toBe("42501");

    const stored = await env.admin.from("appointments").select("status").eq("id", proposed.id).single();
    expect(stored.data?.status).toBe("done");
  });

  it("conserve la cascade RGPD quand un directeur supprime le contact", async () => {
    const proposed = await createProposedAppointment("cascade-rgpd");

    const removed = await env.users.directorA.client
      .from("contacts")
      .delete()
      .eq("agency_id", env.agencyA.agencyId)
      .eq("id", proposed.contactId);
    expect(removed.error).toBeNull();

    const appointment = await env.admin
      .from("appointments")
      .select("id")
      .eq("id", proposed.id)
      .maybeSingle();
    expect(appointment.error).toBeNull();
    expect(appointment.data).toBeNull();
  });
});
