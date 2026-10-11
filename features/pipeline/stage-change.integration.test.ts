import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PipelineStage } from "@/lib/agents/types";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { changeStage } from "./stage-change";

/**
 * Human stage change against the LOCAL Supabase stack, with two fictitious
 * agencies (A: director + agent, B: one director). Every guard is exercised
 * through a real session (RLS applies), and the direct-UPDATE bypasses are
 * attempted with the same sessions and with the service role.
 */

let env: TestEnv;
let directorA: TypedClient;
let agentA: TypedClient;
let userB: TypedClient;

async function createContact(label: string, stage: PipelineStage = "nouveau", agency: "A" | "B" = "A"): Promise<string> {
  const agencyId = agency === "A" ? env.agencyA.agencyId : env.agencyB.agencyId;
  const inserted = await env.admin
    .from("contacts")
    .insert({ agency_id: agencyId, first_name: "Étape", last_name: label, source: "manual_entry", stage })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "contact missing");
  return inserted.data.id;
}

async function stageOf(contactId: string): Promise<PipelineStage> {
  const row = await env.admin.from("contacts").select("stage").eq("id", contactId).single();
  if (row.error || !row.data) throw new Error(row.error?.message ?? "contact missing");
  return row.data.stage;
}

async function tracesOf(contactId: string) {
  const rows = await env.admin
    .from("activities")
    .select("id, type, summary, payload, actor_type, actor_user_id, actor_agent, is_simulation, occurred_at")
    .eq("contact_id", contactId)
    .eq("type", "contact_stage_changed")
    .order("created_at", { ascending: true });
  if (rows.error) throw new Error(rows.error.message);
  return rows.data ?? [];
}

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("changement d'étape simple", () => {
  it("un agent change l'étape d'un contact de son agence, avec une trace en ajout seul", async () => {
    const contactId = await createContact("simple");

    const result = await changeStage(agentA, { contactId, stage: "qualifie", mandateConfirmed: false });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ contactId, previousStage: "nouveau", stage: "qualifie" });
    expect(await stageOf(contactId)).toBe("qualifie");

    const traces = await tracesOf(contactId);
    expect(traces).toHaveLength(1);
    expect(traces[0]!).toMatchObject({
      id: result.data!.activityId,
      actor_type: "user",
      actor_user_id: env.users.agentA.id,
      actor_agent: null,
      is_simulation: false,
      payload: { previous_stage: "nouveau", stage: "qualifie", reason: null, actor_role: "agent" },
    });
    expect(traces[0]!.summary).toContain("Nouveau → Qualifié");
  });

  it("vers « perdu » aussi, et même étape => stage_unchanged sans nouvelle trace", async () => {
    const contactId = await createContact("perdu", "chaud");
    expect((await changeStage(agentA, { contactId, stage: "perdu", mandateConfirmed: false })).error).toBeNull();

    const again = await changeStage(agentA, { contactId, stage: "perdu", mandateConfirmed: false });
    expect(again.error?.code).toBe("stage_unchanged");
    expect(await tracesOf(contactId)).toHaveLength(1);
  });

  it("double clic concurrent : une seule transition, une seule trace", async () => {
    const contactId = await createContact("concurrent", "qualifie");
    const [first, second] = await Promise.all([
      changeStage(agentA, { contactId, stage: "chaud", mandateConfirmed: false }),
      changeStage(directorA, { contactId, stage: "chaud", mandateConfirmed: false }),
    ]);
    const codes = [first.error?.code ?? "ok", second.error?.code ?? "ok"].sort();
    expect(codes).toEqual(["ok", "stage_unchanged"]);
    expect(await tracesOf(contactId)).toHaveLength(1);
  });

  it("un motif invalide est refusé par la base même en appel direct de la RPC", async () => {
    const contactId = await createContact("motif-direct", "chaud");
    const direct = await agentA.rpc("change_contact_stage", {
      target_contact: contactId,
      new_stage: "perdu",
      mandate_confirmed: false,
      reason: `Motif ${String.fromCharCode(27)} piégé`,
    });
    expect(direct.error?.message).toContain("stage_reason_invalid");
    expect(await stageOf(contactId)).toBe("chaud");
  });
});

describe("entrée en « Mandat signé »", () => {
  it("refusée sans confirmation explicite (étape et historique intacts)", async () => {
    const contactId = await createContact("sans-confirmation", "estimation_faite");

    const result = await changeStage(agentA, { contactId, stage: "mandat_signe", mandateConfirmed: false });

    expect(result.error?.code).toBe("stage_mandate_confirmation_required");
    expect(await stageOf(contactId)).toBe("estimation_faite");
    expect(await tracesOf(contactId)).toHaveLength(0);
  });

  it("acceptée avec confirmation, trace de la signature écrite", async () => {
    const contactId = await createContact("signature", "estimation_faite");

    const result = await changeStage(agentA, { contactId, stage: "mandat_signe", mandateConfirmed: true });

    expect(result.error).toBeNull();
    expect(await stageOf(contactId)).toBe("mandat_signe");
    const traces = await tracesOf(contactId);
    expect(traces).toHaveLength(1);
    expect(traces[0]!).toMatchObject({
      actor_type: "user",
      actor_user_id: env.users.agentA.id,
      payload: { previous_stage: "estimation_faite", stage: "mandat_signe", mandate_confirmed: true },
    });
    expect(traces[0]!.summary).toContain("Mandat signé confirmé");
  });

  it("UPDATE direct vers mandat_signe refusé par le trigger (agent, directeur, service role)", async () => {
    const contactId = await createContact("update-direct", "estimation_faite");

    for (const client of [agentA, directorA, env.admin]) {
      const direct = await client.from("contacts").update({ stage: "mandat_signe" }).eq("id", contactId);
      expect(direct.error?.message).toContain("stage_mandate_change_requires_rpc");
    }
    expect(await stageOf(contactId)).toBe("estimation_faite");
  });

  it("INSERT direct d'un contact déjà « signé » refusé pour une session", async () => {
    const inserted = await agentA.from("contacts").insert({
      agency_id: env.agencyA.agencyId,
      first_name: "Faux",
      last_name: "Mandat",
      source: "manual_entry",
      stage: "mandat_signe",
    });
    expect(inserted.error?.message).toContain("stage_mandate_change_requires_rpc");
  });

  it("UPSERT (INSERT … ON CONFLICT DO UPDATE) vers ou depuis mandat_signe refusé (audit sécurité)", async () => {
    // Security review 2026-09-23: the upsert path fires the BEFORE UPDATE
    // guard too; it must not be a way around the RPC.
    const entering = await createContact("upsert-entree", "estimation_faite");
    const signed = await createContact("upsert-sortie", "mandat_signe");
    const base = { agency_id: env.agencyA.agencyId, source: "manual_entry" as const };

    for (const client of [agentA, directorA]) {
      const into = await client
        .from("contacts")
        .upsert({ ...base, id: entering, stage: "mandat_signe" }, { onConflict: "id" });
      expect(into.error?.message).toContain("stage_mandate_change_requires_rpc");

      const outOf = await client.from("contacts").upsert({ ...base, id: signed, stage: "chaud" }, { onConflict: "id" });
      expect(outOf.error?.message).toContain("stage_mandate_change_requires_rpc");
    }
    expect(await stageOf(entering)).toBe("estimation_faite");
    expect(await stageOf(signed)).toBe("mandat_signe");
    expect(await tracesOf(entering)).toHaveLength(0);
    expect(await tracesOf(signed)).toHaveLength(0);
  });

  it("une trace « contact_stage_changed » ne peut pas être forgée par INSERT direct", async () => {
    const contactId = await createContact("trace-forgee", "estimation_faite");
    for (const client of [agentA, env.admin]) {
      const forged = await client.from("activities").insert({
        agency_id: env.agencyA.agencyId,
        contact_id: contactId,
        type: "contact_stage_changed",
        summary: "Mandat signé confirmé (faux).",
        payload: { previous_stage: "estimation_faite", stage: "mandat_signe" },
        actor_type: "user",
        actor_user_id: env.users.agentA.id,
        is_simulation: false,
      });
      expect(forged.error?.message).toContain("activity_type_reserved");
    }
    expect(await tracesOf(contactId)).toHaveLength(0);
  });

  it("les autres colonnes d'un contact signé restent modifiables", async () => {
    const contactId = await createContact("signe-notes", "mandat_signe");
    const updated = await agentA.from("contacts").update({ notes: "Clés remises à l'agence." }).eq("id", contactId);
    expect(updated.error).toBeNull();
    expect(await stageOf(contactId)).toBe("mandat_signe");
  });
});

describe("sortie de « Mandat signé »", () => {
  let signedContactId: string;

  beforeAll(async () => {
    signedContactId = await createContact("sortie", "estimation_faite");
    const signed = await changeStage(agentA, { contactId: signedContactId, stage: "mandat_signe", mandateConfirmed: true });
    if (signed.error) throw new Error(signed.error.message);
  });

  it("UPDATE direct de sortie refusé (directeur et service role)", async () => {
    for (const client of [directorA, env.admin]) {
      const direct = await client.from("contacts").update({ stage: "perdu" }).eq("id", signedContactId);
      expect(direct.error?.message).toContain("stage_mandate_change_requires_rpc");
    }
    expect(await stageOf(signedContactId)).toBe("mandat_signe");
  });

  it("refusée à un agent, même avec confirmation et motif", async () => {
    const result = await changeStage(agentA, {
      contactId: signedContactId,
      stage: "perdu",
      mandateConfirmed: true,
      reason: "Le vendeur a retiré son bien.",
    });
    expect(result.error?.code).toBe("stage_mandate_exit_director_only");
    expect(await stageOf(signedContactId)).toBe("mandat_signe");
  });

  it("refusée à un directeur sans motif", async () => {
    const result = await changeStage(directorA, { contactId: signedContactId, stage: "perdu", mandateConfirmed: true });
    expect(result.error?.code).toBe("stage_reason_required");
    expect(await stageOf(signedContactId)).toBe("mandat_signe");
  });

  it("refusée à un directeur sans confirmation explicite", async () => {
    const result = await changeStage(directorA, {
      contactId: signedContactId,
      stage: "perdu",
      mandateConfirmed: false,
      reason: "Le vendeur a retiré son bien.",
    });
    expect(result.error?.code).toBe("stage_mandate_exit_confirmation_required");
    expect(await stageOf(signedContactId)).toBe("mandat_signe");
  });

  it("acceptée pour un directeur avec confirmation et motif ; la trace de signature est conservée", async () => {
    const result = await changeStage(directorA, {
      contactId: signedContactId,
      stage: "estimation_faite",
      mandateConfirmed: true,
      reason: "  Mandat saisi par erreur sur le mauvais dossier.  ",
    });
    expect(result.error).toBeNull();
    expect(await stageOf(signedContactId)).toBe("estimation_faite");

    const traces = await tracesOf(signedContactId);
    expect(traces).toHaveLength(2);
    expect(traces[0]!.payload).toMatchObject({ previous_stage: "estimation_faite", stage: "mandat_signe" });
    expect(traces[1]!).toMatchObject({
      actor_user_id: env.users.directorA.id,
      payload: {
        previous_stage: "mandat_signe",
        stage: "estimation_faite",
        reason: "Mandat saisi par erreur sur le mauvais dossier.",
        actor_role: "director",
      },
    });
    expect(traces[1]!.summary).toContain("Motif : Mandat saisi par erreur sur le mauvais dossier.");
  });

  it("la trace est en ajout seul : ni modifiable ni supprimable, même par le service role", async () => {
    const signature = (await tracesOf(signedContactId))[0]!;
    const updated = await env.admin.from("activities").update({ summary: "effacé" }).eq("id", signature.id);
    expect(updated.error?.message).toContain("activities_append_only");
    const deleted = await env.admin.from("activities").delete().eq("id", signature.id);
    expect(deleted.error?.message).toContain("activities_append_only");
    expect(await tracesOf(signedContactId)).toHaveLength(2);
  });
});

describe("isolation entre agences et accès anonyme", () => {
  it("l'agence B ne peut ni changer l'étape d'un contact de A ni lire sa trace", async () => {
    const contactId = await createContact("isolation", "estimation_faite");
    const signed = await changeStage(agentA, { contactId, stage: "mandat_signe", mandateConfirmed: true });
    expect(signed.error).toBeNull();

    const attempt = await changeStage(userB, {
      contactId,
      stage: "perdu",
      mandateConfirmed: true,
      reason: "Tentative depuis une autre agence.",
    });
    expect(attempt.error?.code).toBe("contact_not_found");

    const direct = await userB.rpc("change_contact_stage", {
      target_contact: contactId,
      new_stage: "chaud",
      mandate_confirmed: false,
    });
    expect(direct.error?.message).toContain("contact_not_found");
    expect(await stageOf(contactId)).toBe("mandat_signe");

    const visible = await userB.from("activities").select("id").eq("contact_id", contactId);
    expect(visible.error).toBeNull();
    expect(visible.data).toEqual([]);
  });

  it("identifiant inconnu : même réponse qu'un contact d'une autre agence", async () => {
    const result = await changeStage(agentA, {
      contactId: "00000000-0000-4000-8000-000000000000",
      stage: "chaud",
      mandateConfirmed: false,
    });
    expect(result.error?.code).toBe("contact_not_found");
  });

  it("anonyme : la RPC n'est pas exécutable", async () => {
    const contactId = await createContact("anonyme", "chaud");
    const anon = await env.anon.rpc("change_contact_stage", {
      target_contact: contactId,
      new_stage: "mandat_signe",
      mandate_confirmed: true,
    });
    expect(anon.error).not.toBeNull();
    expect(await stageOf(contactId)).toBe("chaud");

    const anonResult = await changeStage(env.anon, { contactId, stage: "perdu", mandateConfirmed: false });
    expect(anonResult.error?.code).toBe("not_authenticated");
  });

  it("service role : la RPC n'est pas exécutable (aucun acteur humain)", async () => {
    const contactId = await createContact("service-role", "chaud");
    const attempt = await env.admin.rpc("change_contact_stage", {
      target_contact: contactId,
      new_stage: "mandat_signe",
      mandate_confirmed: true,
    });
    expect(attempt.error).not.toBeNull();
    expect(await stageOf(contactId)).toBe("chaud");
  });
});
