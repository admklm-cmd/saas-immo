import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AgencyRows, TestEnv, TypedClient } from "./testing/local-test-env";
import { setupTestEnv } from "./testing/local-test-env";

/**
 * Integration tests of the database schema (RLS, integrity, guards) against
 * the LOCAL Supabase stack. See ./testing/local-test-env.ts for the setup,
 * the local-only guard and the teardown strategy.
 */

let env: TestEnv;

beforeAll(async () => {
  env = await setupTestEnv();
});

afterAll(async () => {
  await env?.cleanup();
});

// Untyped view of a client, for table-driven tests over dynamic table names.
const raw = (client: TypedClient): SupabaseClient => client as unknown as SupabaseClient;

type PublicTable =
  | "agencies"
  | "memberships"
  | "contacts"
  | "properties"
  | "consents"
  | "appointments"
  | "outbound_messages"
  | "activities"
  | "ai_agent_runs"
  | "ai_agent_run_steps"
  | "tasks"
  | "inbound_leads";

type TableCase = {
  table: PublicTable;
  rowId: (rows: AgencyRows) => string;
  insertPayload: (victim: AgencyRows, attackerUserId: string) => Record<string, unknown>;
  update: { column: string; value: string };
};

const tableCases: TableCase[] = [
  {
    table: "agencies",
    rowId: (r) => r.agencyId,
    insertPayload: () => ({ name: "Agence pirate (fictive)" }),
    update: { column: "name", value: "hacked" },
  },
  {
    table: "memberships",
    rowId: (r) => r.directorMembershipId,
    insertPayload: (victim, attackerUserId) => ({
      agency_id: victim.agencyId,
      user_id: attackerUserId,
      role: "director",
    }),
    update: { column: "role", value: "agent" },
  },
  {
    table: "contacts",
    rowId: (r) => r.contactId,
    insertPayload: (victim) => ({ agency_id: victim.agencyId, source: "manual_entry", last_name: "Intrus" }),
    update: { column: "notes", value: "hacked" },
  },
  {
    table: "properties",
    rowId: (r) => r.propertyId,
    insertPayload: (victim) => ({ agency_id: victim.agencyId, contact_id: victim.contactId, city: "Cassis" }),
    update: { column: "city", value: "hacked" },
  },
  {
    table: "consents",
    rowId: (r) => r.consentId,
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      contact_id: victim.contactId,
      channel: "sms",
      status: "withdrawn",
      source: "intrusion",
    }),
    update: { column: "source", value: "hacked" },
  },
  {
    table: "appointments",
    rowId: (r) => r.appointmentId,
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      contact_id: victim.contactId,
      assigned_user_id: victim.directorUserId,
      starts_at: "2031-03-03T09:00:00Z",
      ends_at: "2031-03-03T10:00:00Z",
    }),
    update: { column: "status", value: "cancelled" },
  },
  {
    table: "outbound_messages",
    rowId: (r) => r.outboundMessageId,
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      contact_id: victim.contactId,
      channel: "email",
      body: "Message intrus",
      idempotency_key: `intrusion-${victim.agencyId}`,
    }),
    update: { column: "body", value: "hacked" },
  },
  {
    table: "activities",
    rowId: (r) => r.activityId,
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      contact_id: victim.contactId,
      type: "note_added",
      summary: "Intrusion",
      actor_type: "system",
      is_simulation: true,
    }),
    update: { column: "summary", value: "hacked" },
  },
  {
    table: "ai_agent_runs",
    rowId: (r) => r.aiAgentRunId,
    insertPayload: (victim) => ({ agency_id: victim.agencyId, agent: "hugo", contact_id: victim.contactId }),
    update: { column: "decision", value: "hacked" },
  },
  {
    table: "ai_agent_run_steps",
    rowId: (r) => r.aiAgentRunStepId,
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      run_id: victim.aiAgentRunId,
      // A free index: the unique (run_id, step_index) must never be what
      // refuses the insert, otherwise a broken RLS policy would go unnoticed.
      step_index: 42,
      phase: "decision",
      label: "Étape intruse",
      status: "ok",
      started_at: new Date(Date.now() - 2_000).toISOString(),
      finished_at: new Date(Date.now() - 1_000).toISOString(),
    }),
    update: { column: "label", value: "hacked" },
  },
  {
    table: "tasks",
    rowId: (r) => r.taskId,
    // A `type` of its own: the partial unique index must never be what refuses
    // the insert, otherwise a broken RLS policy would go unnoticed.
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      contact_id: victim.contactId,
      type: "intrusion_attempt",
      title: "Tâche intruse",
    }),
    update: { column: "title", value: "hacked" },
  },
  {
    table: "inbound_leads",
    rowId: (r) => r.inboundLeadId,
    insertPayload: (victim) => ({
      agency_id: victim.agencyId,
      source: "website_form",
      raw_text: "Lead intrus",
    }),
    update: { column: "raw_text", value: "hacked" },
  },
];

async function countAgencyRows(table: PublicTable, agencyId: string): Promise<number> {
  const column = table === "agencies" ? "id" : "agency_id";
  const { count, error } = await raw(env.admin)
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, agencyId);
  expect(error).toBeNull();
  return count ?? -1;
}

async function adminReadColumn(table: PublicTable, id: string, column: string): Promise<unknown> {
  const { data, error } = await raw(env.admin).from(table).select(column).eq("id", id).maybeSingle();
  expect(error).toBeNull();
  expect(data, `${table} row ${id} must still exist`).not.toBeNull();
  return (data as unknown as Record<string, unknown>)[column];
}

type Direction = {
  label: string;
  attacker: () => { id: string; client: TypedClient };
  victim: () => AgencyRows;
};

const directions: Direction[] = [
  { label: "A → B", attacker: () => env.users.agentA, victim: () => env.agencyB },
  { label: "B → A", attacker: () => env.users.userB, victim: () => env.agencyA },
];

// ---------------------------------------------------------------------------
// 1. Cross-agency isolation matrix: 9 tables x 4 operations x 2 directions
// ---------------------------------------------------------------------------
describe.each(directions)("isolation entre agences ($label)", (direction) => {
  describe.each(tableCases)("$table", (tableCase) => {
    it("ne peut pas LIRE une ligne de l'autre agence", async () => {
      const victim = direction.victim();
      const client = raw(direction.attacker().client);
      const byId = await client.from(tableCase.table).select("id").eq("id", tableCase.rowId(victim));
      expect(byId.error).toBeNull();
      expect(byId.data).toEqual([]);

      const column = tableCase.table === "agencies" ? "id" : "agency_id";
      const all = await client.from(tableCase.table).select(column);
      expect(all.error).toBeNull();
      const agencyIds = (all.data as unknown as Record<string, string>[]).map((row) => row[column]);
      expect(agencyIds).not.toContain(victim.agencyId);
    });

    it("ne peut pas CRÉER une ligne avec l'agency_id de l'autre agence", async () => {
      const victim = direction.victim();
      const attacker = direction.attacker();
      const before = await countAgencyRows(tableCase.table, victim.agencyId);

      // No `.select()`: RETURNING would also be filtered by the SELECT policy,
      // which would hide a broken INSERT policy.
      const { error } = await raw(attacker.client)
        .from(tableCase.table)
        .insert(tableCase.insertPayload(victim, attacker.id));
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");

      if (tableCase.table !== "agencies") {
        expect(await countAgencyRows(tableCase.table, victim.agencyId)).toBe(before);
      }
    });

    it("ne peut pas MODIFIER une ligne de l'autre agence", async () => {
      const victim = direction.victim();
      const id = tableCase.rowId(victim);
      const before = await adminReadColumn(tableCase.table, id, tableCase.update.column);
      expect(before).not.toBe(tableCase.update.value);

      const { data, error } = await raw(direction.attacker().client)
        .from(tableCase.table)
        .update({ [tableCase.update.column]: tableCase.update.value })
        .eq("id", id)
        .select("id");
      expect(error !== null || (data ?? []).length === 0).toBe(true);

      expect(await adminReadColumn(tableCase.table, id, tableCase.update.column)).toEqual(before);
    });

    it("ne peut pas SUPPRIMER une ligne de l'autre agence", async () => {
      const victim = direction.victim();
      const id = tableCase.rowId(victim);

      const { data, error } = await raw(direction.attacker().client)
        .from(tableCase.table)
        .delete()
        .eq("id", id)
        .select("id");
      expect(error !== null || (data ?? []).length === 0).toBe(true);

      await adminReadColumn(tableCase.table, id, "id");
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Anonymous access (publishable key, no session): nothing
// ---------------------------------------------------------------------------
describe("anon (sans session)", () => {
  it.each([...tableCases.map((c) => c.table), "current_consents"])("aucune lecture sur %s", async (table) => {
    const { data, error } = await raw(env.anon).from(table).select("*").limit(5);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    if (error) expect(error.code).toBe("42501");
  });

  it.each(tableCases)("aucune écriture sur $table", async (tableCase) => {
    const before = await countAgencyRows(tableCase.table, env.agencyA.agencyId);
    const { error } = await raw(env.anon)
      .from(tableCase.table)
      .insert(tableCase.insertPayload(env.agencyA, env.users.agentA.id));
    expect(error).not.toBeNull();
    if (tableCase.table !== "agencies") {
      expect(await countAgencyRows(tableCase.table, env.agencyA.agencyId)).toBe(before);
    }

    const updated = await raw(env.anon)
      .from(tableCase.table)
      .update({ [tableCase.update.column]: tableCase.update.value })
      .eq("id", tableCase.rowId(env.agencyA))
      .select("id");
    expect(updated.error !== null || (updated.data ?? []).length === 0).toBe(true);
    expect(await adminReadColumn(tableCase.table, tableCase.rowId(env.agencyA), tableCase.update.column)).not.toBe(
      tableCase.update.value,
    );
  });

  it("ne peut pas appeler le coupe-circuit", async () => {
    const { error } = await env.anon.rpc("set_ai_paused", { target_agency: env.agencyA.agencyId, paused: true });
    expect(error).not.toBeNull();
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Refusals specific to a table, inside the user's own agency
// ---------------------------------------------------------------------------
describe("refus propres à chaque table (dans sa propre agence)", () => {
  it("agencies : pas d'écriture directe (nom, coupe-circuit)", async () => {
    const client = env.users.directorA.client;
    const { data, error } = await client
      .from("agencies")
      .update({ name: "hacked", ai_paused: true })
      .eq("id", env.agencyA.agencyId)
      .select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(false);

    const deleted = await client.from("agencies").delete().eq("id", env.agencyA.agencyId).select("id");
    expect(deleted.error !== null || (deleted.data ?? []).length === 0).toBe(true);
    await adminReadColumn("agencies", env.agencyA.agencyId, "id");
  });

  it("memberships : un agent ne peut ni se promouvoir, ni ajouter, ni retirer un membre", async () => {
    const client = env.users.agentA.client;
    const { data: own } = await client
      .from("memberships")
      .select("id, role")
      .eq("user_id", env.users.agentA.id)
      .single();
    expect(own?.role).toBe("agent");

    const promoted = await client.from("memberships").update({ role: "director" }).eq("id", own!.id).select("id");
    expect(promoted.error !== null || (promoted.data ?? []).length === 0).toBe(true);
    expect(await adminReadColumn("memberships", own!.id, "role")).toBe("agent");

    const added = await client
      .from("memberships")
      .insert({ agency_id: env.agencyA.agencyId, user_id: env.users.userB.id, role: "director" });
    expect(added.error?.code).toBe("42501");

    const removed = await client
      .from("memberships")
      .delete()
      .eq("id", env.agencyA.directorMembershipId)
      .select("id");
    expect(removed.error !== null || (removed.data ?? []).length === 0).toBe(true);
    await adminReadColumn("memberships", env.agencyA.directorMembershipId, "id");
  });

  it("memberships : même un directeur ne peut pas écrire directement", async () => {
    const { error } = await env.users.directorA.client
      .from("memberships")
      .insert({ agency_id: env.agencyA.agencyId, user_id: env.users.userB.id, role: "agent" });
    expect(error?.code).toBe("42501");
  });

  it("consents : UPDATE et DELETE refusés à un membre", async () => {
    const client = env.users.directorA.client;
    const updated = await client.from("consents").update({ status: "withdrawn" }).eq("id", env.agencyA.consentId);
    expect(updated.error?.code).toBe("42501");
    const deleted = await client.from("consents").delete().eq("id", env.agencyA.consentId);
    expect(deleted.error?.code).toBe("42501");
    expect(await adminReadColumn("consents", env.agencyA.consentId, "status")).toBe("granted");
  });

  it("consents : impossible d'enregistrer au nom d'un autre utilisateur", async () => {
    const { error } = await env.users.agentA.client.from("consents").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      channel: "sms",
      status: "withdrawn",
      source: "test",
      recorded_by: env.users.directorA.id,
    });
    expect(error?.code).toBe("42501");
  });

  it("activities : UPDATE et DELETE refusés à un membre", async () => {
    const client = env.users.directorA.client;
    const updated = await client.from("activities").update({ summary: "hacked" }).eq("id", env.agencyA.activityId);
    expect(updated.error?.code).toBe("42501");
    const deleted = await client.from("activities").delete().eq("id", env.agencyA.activityId);
    expect(deleted.error?.code).toBe("42501");
    expect(await adminReadColumn("activities", env.agencyA.activityId, "summary")).toBe("Activité de test");
  });

  // Security audit (task 7): the append-only CRM history must not be able to
  // carry a forged author. A human action attributed to Léa/Hugo/Emma/Louis/
  // Sarah could never be corrected afterwards, and a client-chosen
  // `is_simulation = false` would display a simulated action as a real one.
  it("activities : un membre ne peut pas forger une entrée IA ou système", async () => {
    const client = env.users.agentA.client;
    const base = { agency_id: env.agencyA.agencyId, contact_id: env.agencyA.contactId };

    const forgedAi = await client.from("activities").insert({
      ...base,
      type: "ai_qualification_done",
      summary: "Fausse action IA",
      actor_type: "ai_agent",
      actor_agent: "hugo",
      is_simulation: false,
    });
    expect(forgedAi.error?.code).toBe("42501");

    const forgedSystem = await client.from("activities").insert({
      ...base,
      type: "system_event",
      summary: "Faux évènement système",
      actor_type: "system",
      is_simulation: false,
    });
    expect(forgedSystem.error?.code).toBe("42501");

    // A human entry, signed by its author, is of course still accepted.
    const human = await client.from("activities").insert({
      ...base,
      type: "note_added",
      summary: "Note humaine",
      actor_type: "user",
      actor_user_id: env.users.agentA.id,
      is_simulation: false,
    });
    expect(human.error).toBeNull();
  });

  it("activities : une entrée IA exige une exécution ouverte, et le drapeau simulation vient du serveur", async () => {
    const client = env.users.agentA.client;
    const base = { agency_id: env.agencyA.agencyId, contact_id: env.agencyA.contactId };

    const run = await client
      .from("ai_agent_runs")
      .insert({
        agency_id: env.agencyA.agencyId,
        agent: "hugo",
        contact_id: env.agencyA.contactId,
        triggered_by_user_id: env.users.agentA.id,
        is_simulation: true,
      })
      .select("id")
      .single();
    expect(run.error).toBeNull();

    // Accepted, and `is_simulation` is overwritten with the run's own value.
    const during = await client
      .from("activities")
      .insert({
        ...base,
        type: "ai_qualification_done",
        summary: "Hugo — qualification",
        actor_type: "ai_agent",
        actor_agent: "hugo",
        is_simulation: false,
      })
      .select("id, is_simulation")
      .single();
    expect(during.error).toBeNull();
    expect(during.data?.is_simulation).toBe(true);

    // Another agent has no open run: refused.
    const otherAgent = await client.from("activities").insert({
      ...base,
      type: "ai_relance_prete",
      summary: "Fausse action d'Emma",
      actor_type: "ai_agent",
      actor_agent: "emma",
      is_simulation: true,
    });
    expect(otherAgent.error?.code).toBe("42501");

    // Once the run is closed, no more entry can be attributed to that agent.
    const closed = await client
      .from("ai_agent_runs")
      .update({ status: "succeeded" })
      .eq("id", run.data!.id);
    expect(closed.error).toBeNull();

    const after = await client.from("activities").insert({
      ...base,
      type: "ai_qualification_done",
      summary: "Hugo — après coup",
      actor_type: "ai_agent",
      actor_agent: "hugo",
      is_simulation: true,
    });
    expect(after.error?.code).toBe("42501");
  });

  it("ai_agent_runs : DELETE refusé", async () => {
    const { error } = await env.users.directorA.client.from("ai_agent_runs").delete().eq("id", env.agencyA.aiAgentRunId);
    expect(error?.code).toBe("42501");
    await adminReadColumn("ai_agent_runs", env.agencyA.aiAgentRunId, "id");
  });

  // The step journal is what the UI replays. If it could be rewritten, the
  // replay would prove nothing.
  it("ai_agent_run_steps : UPDATE et DELETE refusés à un membre", async () => {
    const client = env.users.directorA.client;
    const id = env.agencyA.aiAgentRunStepId;

    const updated = await client.from("ai_agent_run_steps").update({ label: "hacked" }).eq("id", id);
    expect(updated.error?.code).toBe("42501");
    const deleted = await client.from("ai_agent_run_steps").delete().eq("id", id);
    expect(deleted.error?.code).toBe("42501");
    expect(await adminReadColumn("ai_agent_run_steps", id, "label")).toBe("Étape de test");
  });
});

// ---------------------------------------------------------------------------
// 4. Positive cases inside the own agency
// ---------------------------------------------------------------------------
describe("accès légitimes dans sa propre agence", () => {
  it("un agent lit, crée et modifie les contacts de son agence", async () => {
    const client = env.users.agentA.client;
    const list = await client.from("contacts").select("id, agency_id");
    expect(list.error).toBeNull();
    expect(list.data?.length).toBeGreaterThanOrEqual(2);
    expect(new Set(list.data?.map((c) => c.agency_id))).toEqual(new Set([env.agencyA.agencyId]));

    const created = await client
      .from("contacts")
      .insert({ agency_id: env.agencyA.agencyId, source: "manual_entry", last_name: "Créé par agent" })
      .select("id, stage")
      .single();
    expect(created.error).toBeNull();
    expect(created.data?.stage).toBe("nouveau");

    const updated = await client
      .from("contacts")
      .update({ notes: "Mis à jour", assigned_user_id: env.users.agentA.id })
      .eq("id", created.data!.id)
      .select("notes, assigned_user_id")
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual({ notes: "Mis à jour", assigned_user_id: env.users.agentA.id });
  });

  it("un agent ne peut pas supprimer un contact, un directeur oui", async () => {
    const id = env.agencyA.deletableContactId;
    const byAgent = await env.users.agentA.client.from("contacts").delete().eq("id", id).select("id");
    expect(byAgent.error).toBeNull();
    expect(byAgent.data).toEqual([]);
    await adminReadColumn("contacts", id, "id");

    const byDirector = await env.users.directorA.client.from("contacts").delete().eq("id", id).select("id");
    expect(byDirector.error).toBeNull();
    expect(byDirector.data).toEqual([{ id }]);
    const { data } = await env.admin.from("contacts").select("id").eq("id", id);
    expect(data).toEqual([]);
  });

  it("un membre voit les membres de son agence, pas ceux de l'autre", async () => {
    const { data, error } = await env.users.agentA.client.from("memberships").select("user_id");
    expect(error).toBeNull();
    expect(new Set(data?.map((m) => m.user_id))).toEqual(new Set([env.users.directorA.id, env.users.agentA.id]));
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-agency integrity and immutability
// ---------------------------------------------------------------------------
describe("intégrité inter-agences", () => {
  it("refuse un bien de A rattaché à un contact de B", async () => {
    const { error } = await env.users.agentA.client
      .from("properties")
      .insert({ agency_id: env.agencyA.agencyId, contact_id: env.agencyB.contactId, city: "Cassis" });
    expect(error?.code).toBe("23503");
  });

  it("refuse un rendez-vous de A assigné à un utilisateur de B", async () => {
    const { error } = await env.users.agentA.client.from("appointments").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      assigned_user_id: env.users.userB.id,
      starts_at: "2031-04-01T09:00:00Z",
      ends_at: "2031-04-01T10:00:00Z",
    });
    expect(error?.code).toBe("23503");
  });

  it("refuse un contact de A assigné à un utilisateur de B", async () => {
    const { error } = await env.users.agentA.client
      .from("contacts")
      .update({ assigned_user_id: env.users.userB.id })
      .eq("id", env.agencyA.contactId);
    expect(error?.code).toBe("23503");
  });

  it("refuse le changement d'agency_id (utilisateur et service role)", async () => {
    const byUser = await env.users.agentA.client
      .from("contacts")
      .update({ agency_id: env.agencyB.agencyId })
      .eq("id", env.agencyA.contactId);
    expect(byUser.error?.code).toBe("42501");

    const byAdmin = await env.admin
      .from("contacts")
      .update({ agency_id: env.agencyB.agencyId })
      .eq("id", env.agencyA.contactId);
    expect(byAdmin.error?.message).toContain("agency_id_immutable");

    expect(await adminReadColumn("contacts", env.agencyA.contactId, "agency_id")).toBe(env.agencyA.agencyId);
  });

  it("consents : UPDATE et DELETE refusés même en service role", async () => {
    const updated = await env.admin.from("consents").update({ status: "withdrawn" }).eq("id", env.agencyA.consentId);
    expect(updated.error?.message).toContain("consents_append_only");
    const deleted = await env.admin.from("consents").delete().eq("id", env.agencyA.consentId);
    expect(deleted.error?.message).toContain("consents_append_only");
    expect(await adminReadColumn("consents", env.agencyA.consentId, "status")).toBe("granted");
  });

  it("activities : UPDATE et DELETE refusés même en service role", async () => {
    const updated = await env.admin.from("activities").update({ summary: "hacked" }).eq("id", env.agencyA.activityId);
    expect(updated.error?.message).toContain("activities_append_only");
    const deleted = await env.admin.from("activities").delete().eq("id", env.agencyA.activityId);
    expect(deleted.error?.message).toContain("activities_append_only");
    expect(await adminReadColumn("activities", env.agencyA.activityId, "summary")).toBe("Activité de test");
  });

  it("ai_agent_run_steps : UPDATE et DELETE refusés même en service role", async () => {
    const id = env.agencyA.aiAgentRunStepId;
    const updated = await env.admin.from("ai_agent_run_steps").update({ label: "hacked" }).eq("id", id);
    expect(updated.error?.message).toContain("ai_agent_run_steps_append_only");
    const deleted = await env.admin.from("ai_agent_run_steps").delete().eq("id", id);
    expect(deleted.error?.message).toContain("ai_agent_run_steps_append_only");
    expect(await adminReadColumn("ai_agent_run_steps", id, "label")).toBe("Étape de test");
  });

  it("refuse une étape rattachée à l'exécution d'une autre agence", async () => {
    const { error } = await env.users.agentA.client.from("ai_agent_run_steps").insert({
      agency_id: env.agencyA.agencyId,
      run_id: env.agencyB.aiAgentRunId,
      step_index: 7,
      phase: "decision",
      label: "Étape croisée",
      status: "ok",
      started_at: new Date(Date.now() - 2_000).toISOString(),
      finished_at: new Date(Date.now() - 1_000).toISOString(),
    });
    expect(error?.code).toBe("23503");
  });

  it("refuse un lead de A rattaché au contact de B", async () => {
    const { error } = await env.users.agentA.client.from("inbound_leads").insert({
      agency_id: env.agencyA.agencyId,
      source: "estimation_form",
      raw_text: "Lead croisé",
      status: "processed",
      contact_id: env.agencyB.contactId,
    });
    // The state guard rejects the forged processing result before the
    // composite foreign key is evaluated. Both layers protect the link.
    expect(error?.code).toBe("42501");
  });
});

// ---------------------------------------------------------------------------
// 6. Double booking
// ---------------------------------------------------------------------------
describe("double réservation", () => {
  const slot = (start: string, end: string) => ({ starts_at: start, ends_at: end });

  it("refuse un chevauchement pour le même conseiller, accepte un autre conseiller, ignore les annulés", async () => {
    const client = env.users.agentA.client;
    const base = {
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      assigned_user_id: env.users.directorA.id,
    };

    const first = await client
      .from("appointments")
      .insert({ ...base, ...slot("2030-02-04T09:00:00Z", "2030-02-04T10:00:00Z") })
      .select("id, is_simulation, status")
      .single();
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ is_simulation: true, status: "proposed" });

    const overlap = await client
      .from("appointments")
      .insert({ ...base, status: "confirmed", ...slot("2030-02-04T09:30:00Z", "2030-02-04T10:30:00Z") });
    expect(overlap.error?.code).toBe("23P01");

    const adjacent = await client
      .from("appointments")
      .insert({ ...base, ...slot("2030-02-04T10:00:00Z", "2030-02-04T11:00:00Z") });
    expect(adjacent.error).toBeNull();

    const otherAdvisor = await client.from("appointments").insert({
      ...base,
      assigned_user_id: env.users.agentA.id,
      ...slot("2030-02-04T09:30:00Z", "2030-02-04T10:30:00Z"),
    });
    expect(otherAdvisor.error).toBeNull();

    const cancelledOverlap = await client
      .from("appointments")
      .insert({ ...base, status: "cancelled", ...slot("2030-02-04T09:15:00Z", "2030-02-04T09:45:00Z") });
    expect(cancelledOverlap.error).toBeNull();

    const cancel = await client.from("appointments").update({ status: "cancelled" }).eq("id", first.data!.id);
    expect(cancel.error).toBeNull();
    const rebook = await client
      .from("appointments")
      .insert({ ...base, ...slot("2030-02-04T09:00:00Z", "2030-02-04T10:00:00Z") });
    expect(rebook.error).toBeNull();
  });

  it("refuse une fin avant le début", async () => {
    const { error } = await env.users.agentA.client.from("appointments").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      assigned_user_id: env.users.agentA.id,
      ...slot("2030-02-05T10:00:00Z", "2030-02-05T09:00:00Z"),
    });
    expect(error?.code).toBe("23514");
  });
});

// ---------------------------------------------------------------------------
// 7. Kill switch
// ---------------------------------------------------------------------------
describe("coupe-circuit", () => {
  it("user-b ne peut ni suspendre ni réactiver l'agence A", async () => {
    const pause = await env.users.userB.client.rpc("set_ai_paused", { target_agency: env.agencyA.agencyId, paused: true });
    expect(pause.error?.message).toBe("forbidden");
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(false);
  });

  it("un agent suspend, ne peut pas réactiver ; le directeur réactive", async () => {
    const agent = env.users.agentA.client;
    const paused = await agent.rpc("set_ai_paused", { target_agency: env.agencyA.agencyId, paused: true });
    expect(paused.error).toBeNull();
    expect(paused.data).toBe(true);
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(true);

    const journal = await agent
      .from("activities")
      .select("type, actor_type, actor_user_id, contact_id")
      .eq("type", "ai_paused");
    expect(journal.data).toEqual([
      { type: "ai_paused", actor_type: "user", actor_user_id: env.users.agentA.id, contact_id: null },
    ]);

    // While paused: no AI run can start, no AI draft can be created.
    const run = await agent
      .from("ai_agent_runs")
      .insert({ agency_id: env.agencyA.agencyId, agent: "hugo", contact_id: env.agencyA.contactId });
    expect(run.error?.message).toBe("ai_paused");
    const blocked = await agent
      .from("ai_agent_runs")
      .insert({
        agency_id: env.agencyA.agencyId,
        agent: "hugo",
        contact_id: env.agencyA.contactId,
        status: "blocked",
        decision: "ai_paused",
        error: "ai_paused",
      })
      .select("status, finished_at")
      .single();
    expect(blocked.error).toBeNull();
    expect(blocked.data?.finished_at).not.toBeNull();
    const draft = await agent.from("outbound_messages").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      channel: "email",
      body: "Brouillon pendant la pause",
      created_by_agent: "emma",
      idempotency_key: `paused-${env.runId}`,
    });
    expect(draft.error?.message).toBe("ai_paused");

    const resumeByAgent = await agent.rpc("set_ai_paused", { target_agency: env.agencyA.agencyId, paused: false });
    expect(resumeByAgent.error?.message).toBe("only_director_can_resume_ai");
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(true);

    const resumeByUserB = await env.users.userB.client.rpc("set_ai_paused", {
      target_agency: env.agencyA.agencyId,
      paused: false,
    });
    expect(resumeByUserB.error?.message).toBe("forbidden");
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(true);

    const resume = await env.users.directorA.client.rpc("set_ai_paused", {
      target_agency: env.agencyA.agencyId,
      paused: false,
    });
    expect(resume.error).toBeNull();
    expect(resume.data).toBe(false);
    expect(await adminReadColumn("agencies", env.agencyA.agencyId, "ai_paused")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Current consents view
// ---------------------------------------------------------------------------
describe("current_consents", () => {
  it("renvoie le dernier état par canal et rien de l'autre agence", async () => {
    const client = env.users.agentA.client;
    const base = {
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      channel: "sms" as const,
      recorded_by: env.users.agentA.id,
    };
    const granted = await client.from("consents").insert({
      ...base,
      status: "granted",
      presented_text: "J'accepte d'être recontacté par SMS (texte de test).",
      text_version: "test-v1",
      source: "estimation_form",
      proof: { form_id: "test" },
    });
    expect(granted.error).toBeNull();

    const current1 = await client.from("current_consents").select("status").eq("contact_id", env.agencyA.contactId).eq("channel", "sms");
    expect(current1.data).toEqual([{ status: "granted" }]);

    const withdrawn = await client.from("consents").insert({ ...base, status: "withdrawn", source: "stop_keyword" });
    expect(withdrawn.error).toBeNull();

    const current2 = await client
      .from("current_consents")
      .select("status, channel")
      .eq("contact_id", env.agencyA.contactId)
      .order("channel");
    expect(current2.data).toEqual([
      { status: "granted", channel: "email" },
      { status: "withdrawn", channel: "sms" },
    ]);

    const all = await client.from("current_consents").select("agency_id");
    expect(new Set(all.data?.map((c) => c.agency_id))).toEqual(new Set([env.agencyA.agencyId]));

    const fromB = await env.users.userB.client.from("current_consents").select("agency_id");
    expect(new Set(fromB.data?.map((c) => c.agency_id))).toEqual(new Set([env.agencyB.agencyId]));
  });

  it("refuse un consentement accordé sans texte, version ni preuve", async () => {
    const { error } = await env.users.agentA.client.from("consents").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      channel: "whatsapp",
      status: "granted",
      source: "estimation_form",
    });
    expect(error?.code).toBe("23514");
  });
});

// ---------------------------------------------------------------------------
// 9. Database guards on messages and AI runs (defense in depth for task 4)
// ---------------------------------------------------------------------------
describe("garde-fous en base : messages et exécutions IA", () => {
  it("premier contact validé par un humain, consentement vérifié à l'envoi, message envoyé immuable", async () => {
    const agent = env.users.agentA.client;
    const agencyId = env.agencyA.agencyId;
    const contact = await agent
      .from("contacts")
      .insert({ agency_id: agencyId, source: "estimation_form", last_name: "Garde-fous" })
      .select("id")
      .single();
    const contactId = contact.data!.id;
    const message = (key: string, extra: Record<string, unknown> = {}) => ({
      agency_id: agencyId,
      contact_id: contactId,
      channel: "email" as const,
      body: "Bonjour (simulation).",
      idempotency_key: `${key}-${env.runId}`,
      ...extra,
    });

    // No consent yet: even a human-validated send is refused.
    const noConsent = await agent
      .from("outbound_messages")
      .insert(message("no-consent", { status: "sent_simulated", validated_by: env.users.agentA.id }));
    expect(noConsent.error?.message).toBe("consent_not_granted");

    const consent = await agent.from("consents").insert({
      agency_id: agencyId,
      contact_id: contactId,
      channel: "email",
      status: "granted",
      presented_text: "J'accepte d'être recontacté par email (texte de test).",
      text_version: "test-v1",
      source: "estimation_form",
      proof: { form_id: "test" },
    });
    expect(consent.error).toBeNull();

    // First contact without human validation: refused.
    const auto = await agent
      .from("outbound_messages")
      .insert(message("auto-first", { status: "sent_simulated", created_by_agent: "louis" }));
    expect(auto.error?.message).toBe("first_contact_requires_human_validation");

    // Approving a message cannot be attributed to another user, nor forged without validation.
    const draft = await agent
      .from("outbound_messages")
      .insert(message("draft", { created_by_agent: "louis" }))
      .select("id, status")
      .single();
    expect(draft.data?.status).toBe("pending_validation");
    const forged = await agent
      .from("outbound_messages")
      .update({ status: "approved", validated_by: env.users.directorA.id })
      .eq("id", draft.data!.id);
    expect(forged.error?.message).toBe("validated_by_must_be_caller");
    const noValidator = await agent
      .from("outbound_messages")
      .update({ status: "approved", validated_at: new Date().toISOString() })
      .eq("id", draft.data!.id);
    expect(noValidator.error?.code).toBe("23514");

    const approved = await agent
      .from("outbound_messages")
      .update({ status: "approved", validated_by: env.users.agentA.id })
      .eq("id", draft.data!.id)
      .select("validated_at")
      .single();
    expect(approved.error).toBeNull();
    expect(approved.data?.validated_at).not.toBeNull();

    const sent = await agent
      .from("outbound_messages")
      .update({ status: "sent_simulated" })
      .eq("id", draft.data!.id)
      .select("sent_at, is_simulation")
      .single();
    expect(sent.error).toBeNull();
    expect(sent.data?.sent_at).not.toBeNull();
    expect(sent.data?.is_simulation).toBe(true);

    const edited = await agent.from("outbound_messages").update({ body: "modifié" }).eq("id", draft.data!.id);
    expect(edited.error?.message).toBe("outbound_message_already_sent");
    const deleted = await agent.from("outbound_messages").delete().eq("id", draft.data!.id).select("id");
    expect(deleted.data).toEqual([]);

    // Duplicate idempotency key: refused (no double send).
    const duplicate = await agent.from("outbound_messages").insert(message("draft"));
    expect(duplicate.error?.code).toBe("23505");

    // Automatic follow-up after a validated first contact, consent granted: allowed.
    const followUp = await agent
      .from("outbound_messages")
      .insert(message("follow-up-1", { status: "sent_simulated", created_by_agent: "emma" }));
    expect(followUp.error).toBeNull();

    // Human takeover stops automatic follow-ups.
    await agent.from("contacts").update({ human_takeover: true }).eq("id", contactId);
    const afterTakeover = await agent
      .from("outbound_messages")
      .insert(message("follow-up-2", { status: "sent_simulated", created_by_agent: "emma" }));
    expect(afterTakeover.error?.message).toBe("automatic_follow_up_not_allowed");
    await agent.from("contacts").update({ human_takeover: false }).eq("id", contactId);

    // Withdrawal (STOP) is effective immediately.
    const stop = await agent
      .from("consents")
      .insert({ agency_id: agencyId, contact_id: contactId, channel: "email", status: "withdrawn", source: "stop_keyword" });
    expect(stop.error).toBeNull();
    const afterStop = await agent
      .from("outbound_messages")
      .insert(message("follow-up-3", { status: "sent_simulated", created_by_agent: "emma" }));
    expect(afterStop.error?.message).toBe("consent_not_granted");
  });

  it("limite quotidienne d'exécutions IA et transitions de statut", async () => {
    const agent = env.users.agentA.client;
    const agencyId = env.agencyA.agencyId;

    const started = await agent
      .from("ai_agent_runs")
      .insert({ agency_id: agencyId, agent: "louis", contact_id: env.agencyA.contactId, triggered_by_user_id: env.users.agentA.id })
      .select("id, provider, is_simulation, status")
      .single();
    expect(started.error).toBeNull();
    expect(started.data).toMatchObject({ provider: "simulator", is_simulation: true, status: "running" });

    const finished = await agent
      .from("ai_agent_runs")
      .update({ status: "succeeded", output: { ok: true }, input_tokens: 0, output_tokens: 0 })
      .eq("id", started.data!.id)
      .select("finished_at")
      .single();
    expect(finished.error).toBeNull();
    expect(finished.data?.finished_at).not.toBeNull();

    const reopened = await agent.from("ai_agent_runs").update({ status: "running" }).eq("id", started.data!.id);
    expect(reopened.error?.message).toBe("ai_agent_run_already_finished");

    const spoofed = await agent
      .from("ai_agent_runs")
      .insert({ agency_id: agencyId, agent: "louis", triggered_by_user_id: env.users.directorA.id })
      .select("id, triggered_by_user_id")
      .single();
    expect(spoofed.error).toBeNull();
    // The database ignores a forged author and stamps the authenticated caller.
    expect(spoofed.data?.triggered_by_user_id).toBe(env.users.agentA.id);
    const closeSpoofed = await agent
      .from("ai_agent_runs")
      .update({ status: "succeeded" })
      .eq("id", spoofed.data!.id);
    expect(closeSpoofed.error).toBeNull();

    const { count } = await env.admin
      .from("ai_agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .neq("status", "blocked");
    const limit = await env.admin.from("agencies").update({ ai_daily_run_limit: count ?? 0 }).eq("id", agencyId);
    expect(limit.error).toBeNull();
    try {
      const overLimit = await agent.from("ai_agent_runs").insert({ agency_id: agencyId, agent: "hugo" });
      expect(overLimit.error?.message).toBe("ai_daily_run_limit_reached");
    } finally {
      await env.admin.from("agencies").update({ ai_daily_run_limit: 100 }).eq("id", agencyId);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Tasks: closure stamped by the server, anti-duplicate index
// ---------------------------------------------------------------------------
describe("tasks : clôture et anti-doublon", () => {
  it("clôture une tâche : completed_by = l'appelant, completed_at posé par le serveur", async () => {
    const agent = env.users.agentA.client;
    const created = await agent
      .from("tasks")
      .insert({
        agency_id: env.agencyA.agencyId,
        contact_id: env.agencyA.contactId,
        type: "call_back_seller",
        title: "Rappeler le vendeur",
        created_by_agent: "hugo",
      })
      .select("id, status, completed_at, completed_by")
      .single();
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({ status: "open", completed_at: null, completed_by: null });
    const taskId = created.data!.id;

    // A closure cannot be attributed to another user.
    const forged = await agent
      .from("tasks")
      .update({ status: "done", completed_by: env.users.directorA.id })
      .eq("id", taskId);
    expect(forged.error?.message).toBe("completed_by_must_be_caller");

    // A client-supplied completed_at is ignored: the server stamps it.
    const done = await agent
      .from("tasks")
      .update({ status: "done", completed_at: "2000-01-01T00:00:00Z" })
      .eq("id", taskId)
      .select("status, completed_at, completed_by")
      .single();
    expect(done.error).toBeNull();
    expect(done.data?.status).toBe("done");
    expect(done.data?.completed_by).toBe(env.users.agentA.id);
    expect(new Date(done.data!.completed_at!).getUTCFullYear()).toBeGreaterThanOrEqual(2026);

    // The closure stamp is evidence: it cannot be rewritten while done.
    const rewritten = await agent
      .from("tasks")
      .update({ completed_by: env.users.directorA.id })
      .eq("id", taskId);
    expect(rewritten.error?.message).toBe("task_completion_immutable");

    // Reopening clears the stamp.
    const reopened = await agent
      .from("tasks")
      .update({ status: "open" })
      .eq("id", taskId)
      .select("completed_at, completed_by")
      .single();
    expect(reopened.error).toBeNull();
    expect(reopened.data).toEqual({ completed_at: null, completed_by: null });

    // Cancelling is a closure without completion stamp, and a member can delete.
    const cancelled = await agent
      .from("tasks")
      .update({ status: "cancelled" })
      .eq("id", taskId)
      .select("status, completed_at")
      .single();
    expect(cancelled.data).toEqual({ status: "cancelled", completed_at: null });
    const deleted = await agent.from("tasks").delete().eq("id", taskId).select("id");
    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([{ id: taskId }]);
  });

  it("refuse deux tâches ouvertes du même type pour le même contact", async () => {
    const agent = env.users.agentA.client;
    const agencyId = env.agencyA.agencyId;
    const otherContact = await agent
      .from("contacts")
      .insert({ agency_id: agencyId, source: "manual_entry", last_name: "Doublon" })
      .select("id")
      .single();
    expect(otherContact.error).toBeNull();

    const base = {
      agency_id: agencyId,
      contact_id: env.agencyA.contactId,
      type: "missing_information_dedup",
      title: "Information manquante",
    };

    const first = await agent.from("tasks").insert({ ...base, created_by_agent: "hugo" }).select("id").single();
    expect(first.error).toBeNull();

    // Same contact, same type, another agent: still a duplicate.
    const duplicate = await agent
      .from("tasks")
      .insert({ ...base, created_by_agent: "louis", title: "Doublon" });
    expect(duplicate.error?.code).toBe("23505");

    // Another type for the same contact: allowed.
    const otherType = await agent.from("tasks").insert({ ...base, type: "missing_information_dedup2" });
    expect(otherType.error).toBeNull();

    // Same type for another contact: allowed.
    const otherContactTask = await agent
      .from("tasks")
      .insert({ ...base, contact_id: otherContact.data!.id });
    expect(otherContactTask.error).toBeNull();

    // Once closed, the same task can legitimately be opened again.
    const closed = await agent.from("tasks").update({ status: "done" }).eq("id", first.data!.id);
    expect(closed.error).toBeNull();
    const reopenedDuplicate = await agent.from("tasks").insert({ ...base, created_by_agent: "hugo" });
    expect(reopenedDuplicate.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11. Estimated value in euros: never written by an AI agent
// ---------------------------------------------------------------------------
describe("valeur estimée d'un bien", () => {
  it("refuse toute écriture pendant qu'une exécution d'agent IA est ouverte", async () => {
    const agent = env.users.agentA.client;
    const propertyId = env.agencyA.propertyId;

    const run = await agent
      .from("ai_agent_runs")
      .insert({
        agency_id: env.agencyA.agencyId,
        agent: "hugo",
        contact_id: env.agencyA.contactId,
        triggered_by_user_id: env.users.agentA.id,
      })
      .select("id")
      .single();
    expect(run.error).toBeNull();

    // While the run is open, the euro figure is out of reach.
    const duringRun = await agent
      .from("properties")
      .update({ estimated_value_eur: 420000, estimated_value_source: "agency" })
      .eq("id", propertyId);
    expect(duringRun.error?.message).toBe("estimated_value_ai_write_refused");
    expect(await adminReadColumn("properties", propertyId, "estimated_value_eur")).toBeNull();

    // A property created during the run cannot carry a figure either.
    const createdDuringRun = await agent.from("properties").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: env.agencyA.contactId,
      city: "Cassis",
      estimated_value_eur: 500000,
      estimated_value_source: "agency",
    });
    expect(createdDuringRun.error?.message).toBe("estimated_value_ai_write_refused");

    // Everything else stays writable: only the euro figure is protected.
    const otherColumn = await agent.from("properties").update({ city: "Ceyreste" }).eq("id", propertyId);
    expect(otherColumn.error).toBeNull();

    const closed = await agent.from("ai_agent_runs").update({ status: "succeeded" }).eq("id", run.data!.id);
    expect(closed.error).toBeNull();
  });

  it("une fois l'exécution close, un humain enregistre la valeur et le serveur estampille", async () => {
    const agent = env.users.agentA.client;
    const propertyId = env.agencyA.propertyId;

    const recorded = await agent
      .from("properties")
      .update({
        estimated_value_eur: 420000,
        estimated_value_source: "agency",
        // Ignored: the server stamps the date itself.
        estimated_value_recorded_at: "2000-01-01T00:00:00Z",
      })
      .eq("id", propertyId)
      .select("estimated_value_eur, estimated_value_recorded_at, estimated_value_recorded_by")
      .single();
    expect(recorded.error).toBeNull();
    expect(Number(recorded.data!.estimated_value_eur)).toBe(420000);
    expect(recorded.data!.estimated_value_recorded_by).toBe(env.users.agentA.id);
    expect(new Date(recorded.data!.estimated_value_recorded_at!).getUTCFullYear()).toBeGreaterThanOrEqual(2026);

    // The provenance cannot be attributed to somebody else.
    const forged = await agent
      .from("properties")
      .update({
        estimated_value_eur: 430000,
        estimated_value_source: "agency",
        estimated_value_recorded_by: env.users.directorA.id,
      })
      .eq("id", propertyId);
    expect(forged.error?.message).toBe("estimated_value_recorded_by_must_be_caller");

    // Nor rewritten while the figure itself does not move.
    const rewritten = await agent
      .from("properties")
      .update({ estimated_value_recorded_by: env.users.directorA.id })
      .eq("id", propertyId);
    expect(rewritten.error?.message).toBe("estimated_value_stamp_immutable");

    // A figure without a source is refused by the schema itself.
    const noSource = await agent
      .from("properties")
      .update({ estimated_value_eur: 450000, estimated_value_source: null })
      .eq("id", propertyId);
    expect(noSource.error?.code).toBe("23514");

    // Out-of-range values are refused too.
    const negative = await agent
      .from("properties")
      .update({ estimated_value_eur: -1, estimated_value_source: "agency" })
      .eq("id", propertyId);
    expect(negative.error?.code).toBe("23514");

    // Clearing the figure clears its provenance.
    const cleared = await agent
      .from("properties")
      .update({ estimated_value_eur: null })
      .eq("id", propertyId)
      .select("estimated_value_source, estimated_value_recorded_at, estimated_value_recorded_by")
      .single();
    expect(cleared.error).toBeNull();
    expect(cleared.data).toEqual({
      estimated_value_source: null,
      estimated_value_recorded_at: null,
      estimated_value_recorded_by: null,
    });
  });
});

// ---------------------------------------------------------------------------
// 12. Appointment report: stamped by the server (Sarah's raw material)
// ---------------------------------------------------------------------------
describe("compte-rendu de rendez-vous", () => {
  it("estampille l'auteur et la date, refuse une attribution forgée", async () => {
    const agent = env.users.agentA.client;
    const id = env.agencyA.appointmentId;

    const forged = await agent
      .from("appointments")
      .update({ report_notes: "Compte-rendu forgé", report_recorded_by: env.users.directorA.id })
      .eq("id", id);
    expect(forged.error?.message).toBe("report_recorded_by_must_be_caller");

    const written = await agent
      .from("appointments")
      .update({
        report_notes: "Estimation réalisée, le vendeur réfléchit au prix de présentation.",
        // Ignored: the server stamps the date itself.
        report_recorded_at: "2000-01-01T00:00:00Z",
      })
      .eq("id", id)
      .select("report_notes, report_recorded_by, report_recorded_at")
      .single();
    expect(written.error).toBeNull();
    expect(written.data!.report_recorded_by).toBe(env.users.agentA.id);
    expect(new Date(written.data!.report_recorded_at!).getUTCFullYear()).toBeGreaterThanOrEqual(2026);

    // Touching another column leaves the report stamps untouched.
    const untouched = await agent
      .from("appointments")
      .update({ status: "done" })
      .eq("id", id)
      .select("report_recorded_at, report_recorded_by")
      .single();
    expect(untouched.data).toEqual({
      report_recorded_at: written.data!.report_recorded_at,
      report_recorded_by: env.users.agentA.id,
    });

    // Erasing the report erases its stamps, all three together.
    const erased = await agent
      .from("appointments")
      .update({ report_notes: null })
      .eq("id", id)
      .select("report_notes, report_recorded_by, report_recorded_at")
      .single();
    expect(erased.data).toEqual({ report_notes: null, report_recorded_by: null, report_recorded_at: null });
  });
});

// ---------------------------------------------------------------------------
// 13. Step journal: measured, not declared
// ---------------------------------------------------------------------------
describe("ai_agent_run_steps : durées mesurées", () => {
  it("recalcule duration_ms depuis les instants et ignore ce que le client envoie", async () => {
    const agent = env.users.agentA.client;
    const startedAt = new Date(Date.now() - 5_000);
    const finishedAt = new Date(startedAt.getTime() + 1_250);

    const inserted = await agent
      .from("ai_agent_run_steps")
      .insert({
        agency_id: env.agencyA.agencyId,
        run_id: env.agencyA.aiAgentRunId,
        step_index: 1,
        phase: "ai_call",
        label: "Appel du simulateur.",
        status: "ok",
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        // A blatant lie: the database must overwrite it.
        duration_ms: 999_999,
      })
      .select("duration_ms, created_at")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data!.duration_ms).toBe(1_250);
    expect(new Date(inserted.data!.created_at).getUTCFullYear()).toBeGreaterThanOrEqual(2026);

    // No two steps can claim the same rank in a run.
    const duplicate = await agent.from("ai_agent_run_steps").insert({
      agency_id: env.agencyA.agencyId,
      run_id: env.agencyA.aiAgentRunId,
      step_index: 1,
      phase: "decision",
      label: "Doublon.",
      status: "ok",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
    });
    expect(duplicate.error?.code).toBe("23505");

    // A step cannot be dated in the future, nor end before it started.
    const future = await agent.from("ai_agent_run_steps").insert({
      agency_id: env.agencyA.agencyId,
      run_id: env.agencyA.aiAgentRunId,
      step_index: 2,
      phase: "decision",
      label: "Étape future.",
      status: "ok",
      started_at: new Date(Date.now() + 3_600_000).toISOString(),
      finished_at: new Date(Date.now() + 3_601_000).toISOString(),
    });
    expect(future.error?.message).toBe("ai_agent_run_step_in_future");

    const backwards = await agent.from("ai_agent_run_steps").insert({
      agency_id: env.agencyA.agencyId,
      run_id: env.agencyA.aiAgentRunId,
      step_index: 3,
      phase: "decision",
      label: "Étape à rebours.",
      status: "ok",
      started_at: finishedAt.toISOString(),
      finished_at: startedAt.toISOString(),
    });
    expect(backwards.error?.code).toBe("23514");
  });
});
