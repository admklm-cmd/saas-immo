import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv } from "@/lib/supabase/testing/local-test-env";

import { buildAgencySettings } from "./data";

/**
 * Read-only settings against the LOCAL Supabase stack, with two fictitious
 * agencies (A: director + agent, B: one director). Proves with real sessions
 * (RLS applies) that:
 *
 *   * `public.list_agency_members` returns the members of the caller's agency
 *     only, with exactly four columns;
 *   * another agency, the anonymous role and the service role are refused;
 *   * an agent and a director of A see the same list; `canResume` follows the
 *     role;
 *   * a user belonging to two agencies gets the list of the agency resolved by
 *     the application (oldest membership), never a merge of both.
 */

let env: TestEnv;

const MEMBER_COLUMNS = ["created_at", "email", "role", "user_id"];

beforeAll(async () => {
  env = await setupTestEnv();
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

function sortedIds(rows: Array<{ user_id: string }>): string[] {
  return rows.map((row) => row.user_id).sort();
}

describe("RPC list_agency_members — isolation", () => {
  it("un membre de A obtient les membres de A seulement, avec exactement quatre colonnes", async () => {
    const { data, error } = await env.users.directorA.client.rpc("list_agency_members", {
      target_agency: env.agencyA.agencyId,
    });
    expect(error).toBeNull();
    expect(sortedIds(data!)).toEqual([env.users.directorA.id, env.users.agentA.id].sort());
    for (const row of data!) {
      expect(Object.keys(row).sort()).toEqual(MEMBER_COLUMNS);
    }
    const director = data!.find((row) => row.user_id === env.users.directorA.id)!;
    expect(director.role).toBe("director");
    expect(director.email).toBe(env.users.directorA.email);
    expect(data!.find((row) => row.user_id === env.users.agentA.id)!.role).toBe("agent");
    expect(JSON.stringify(data)).not.toContain(env.users.userB.email);
  });

  it("un membre de B obtient les membres de B seulement", async () => {
    const { data, error } = await env.users.userB.client.rpc("list_agency_members", {
      target_agency: env.agencyB.agencyId,
    });
    expect(error).toBeNull();
    expect(sortedIds(data!)).toEqual([env.users.userB.id]);
    expect(Object.keys(data![0]!).sort()).toEqual(MEMBER_COLUMNS);
  });

  it("un conseiller et un directeur de A voient exactement la même liste", async () => {
    const asDirector = await env.users.directorA.client.rpc("list_agency_members", {
      target_agency: env.agencyA.agencyId,
    });
    const asAgent = await env.users.agentA.client.rpc("list_agency_members", {
      target_agency: env.agencyA.agencyId,
    });
    expect(asDirector.error).toBeNull();
    expect(asAgent.error).toBeNull();
    expect(asAgent.data).toEqual(asDirector.data);
  });

  it("un membre de B qui passe l'identifiant de A est refusé (forbidden), sans aucune ligne", async () => {
    const { data, error } = await env.users.userB.client.rpc("list_agency_members", {
      target_agency: env.agencyA.agencyId,
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toBe("forbidden");
  });

  it("une agence inconnue reçoit la même réponse qu'une agence étrangère", async () => {
    const { data, error } = await env.users.directorA.client.rpc("list_agency_members", {
      target_agency: "00000000-0000-4000-8000-000000000000",
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toBe("forbidden");
  });

  it("le rôle anonyme est refusé (aucun droit d'exécution)", async () => {
    const { data, error } = await env.anon.rpc("list_agency_members", { target_agency: env.agencyA.agencyId });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("le rôle service_role est refusé (aucun droit d'exécution)", async () => {
    const { data, error } = await env.admin.rpc("list_agency_members", { target_agency: env.agencyA.agencyId });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("buildAgencySettings — sessions réelles", () => {
  it("conseiller de A : sections disponibles, équipe de A, « vous » marqué, canResume faux", async () => {
    const result = await buildAgencySettings(env.users.agentA.client);
    expect(result.error).toBeNull();
    const data = result.data!;

    expect(data.agencyId).toBe(env.agencyA.agencyId);
    expect(data.viewer).toEqual({ userId: env.users.agentA.id, role: "agent" });
    expect(data.agency).toMatchObject({ status: "ok", value: { city: "La Ciotat", sector: "Test isolation" } });
    expect(data.agents.killSwitch).toEqual({ status: "ok", value: { aiPaused: false, canResume: false } });
    expect(data.agents.dailyRunLimit).toEqual({ status: "ok", value: 100 });
    expect(data.retention).toEqual({ status: "undefined" });
    expect(data.integrations.every((integration) => integration.status === "simulation" && !integration.connected)).toBe(
      true,
    );

    expect(data.members.status).toBe("ok");
    if (data.members.status !== "ok") return;
    expect(data.members.value.map((member) => member.userId).sort()).toEqual(
      [env.users.directorA.id, env.users.agentA.id].sort(),
    );
    expect(data.members.value.filter((member) => member.isCurrentUser).map((member) => member.userId)).toEqual([
      env.users.agentA.id,
    ]);
  });

  it("directeur de A : même équipe, canResume vrai", async () => {
    const asDirector = await buildAgencySettings(env.users.directorA.client);
    const asAgent = await buildAgencySettings(env.users.agentA.client);
    expect(asDirector.data!.agents.killSwitch).toEqual({ status: "ok", value: { aiPaused: false, canResume: true } });

    const strip = (settings: typeof asDirector) =>
      settings.data!.members.status === "ok"
        ? settings.data!.members.value.map(({ userId, email, role, memberSince }) => ({ userId, email, role, memberSince }))
        : null;
    expect(strip(asDirector)).not.toBeNull();
    expect(strip(asDirector)).toEqual(strip(asAgent));
  });

  it("membre de B : uniquement l'agence B et son équipe", async () => {
    const result = await buildAgencySettings(env.users.userB.client);
    expect(result.data!.agencyId).toBe(env.agencyB.agencyId);
    expect(result.data!.members).toMatchObject({
      status: "ok",
      value: [{ userId: env.users.userB.id, role: "director", isCurrentUser: true }],
    });
  });

  it("session anonyme : { data: null, error }", async () => {
    const result = await buildAgencySettings(env.anon);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });

  it("membre de deux agences : seule l'agence résolue par l'application (la plus ancienne) est listée", async () => {
    // agentA joins B AFTER A: the application resolves A (oldest membership).
    const joined = await env.admin
      .from("memberships")
      .insert({ agency_id: env.agencyB.agencyId, user_id: env.users.agentA.id, role: "agent" })
      .select("id")
      .single();
    expect(joined.error).toBeNull();
    try {
      const result = await buildAgencySettings(env.users.agentA.client);
      expect(result.data!.agencyId).toBe(env.agencyA.agencyId);
      expect(result.data!.members.status).toBe("ok");
      if (result.data!.members.status !== "ok") return;
      const ids = result.data!.members.value.map((member) => member.userId);
      expect(ids.sort()).toEqual([env.users.directorA.id, env.users.agentA.id].sort());
      expect(ids).not.toContain(env.users.userB.id);

      // Now a member of B, the same user may read B's team, only when asking
      // for B explicitly — never merged into A's.
      const asMemberOfB = await env.users.agentA.client.rpc("list_agency_members", {
        target_agency: env.agencyB.agencyId,
      });
      expect(asMemberOfB.error).toBeNull();
      expect(sortedIds(asMemberOfB.data!)).toEqual([env.users.userB.id, env.users.agentA.id].sort());
    } finally {
      const removed = await env.admin.from("memberships").delete().eq("id", joined.data!.id);
      expect(removed.error).toBeNull();
    }
  });
});
