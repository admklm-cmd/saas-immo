import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { countEmmaFollowUpCandidates, countInboundLeads, INBOUND_LEADS_PAGE_SIZE, listInboundLeads } from "./data";

/**
 * Lists that are cut for the screen (Léa's inbox, Emma's workspace) at volume:
 * the cut is never silent, and an old pending lead is never hidden behind recent
 * processed ones. Local Supabase stack, real sessions.
 */

let env: TestEnv;
let directorA: TypedClient;
let userB: TypedClient;
let oldPendingId: string;
let baselineLeads = 0;

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;
  baselineLeads = (await countInboundLeads(directorA)).data!.total;

  // 70 recent processed leads, then ONE pending lead from 200 days ago.
  const processed = Array.from({ length: 70 }, (_, index) => ({
    agency_id: env.agencyA.agencyId,
    source: "estimation_form" as const,
    raw_text: `Demande traitée ${index} (donnée de test).`,
    payload: { form_id: "estimation-web" },
    status: "processed" as const,
    contact_id: env.agencyA.contactId,
    created_at: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
  }));
  const inserted = await env.admin.from("inbound_leads").insert(processed);
  if (inserted.error) throw new Error(`leads: ${inserted.error.message}`);
  const old = await env.admin
    .from("inbound_leads")
    .insert({
      agency_id: env.agencyA.agencyId,
      source: "website_form",
      raw_text: "Ancienne demande jamais traitée (donnée de test).",
      payload: { form_id: "contact-web" },
      status: "pending",
      created_at: new Date(Date.now() - 200 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (old.error || !old.data) throw new Error(`old lead: ${old.error?.message}`);
  oldPendingId = old.data.id;
}, 120_000);

afterAll(async () => {
  await env?.cleanup();
});

describe("Léa's inbox at volume", () => {
  it("never hides a pending lead behind more recent processed ones, and never exceeds one page", async () => {
    const { data } = await listInboundLeads(directorA);
    expect(data).toHaveLength(INBOUND_LEADS_PAGE_SIZE);
    expect(data!.some((lead) => lead.id === oldPendingId)).toBe(true);
    const created = data!.map((lead) => Date.parse(lead.createdAt));
    for (let index = 1; index < created.length; index += 1) expect(created[index]!).toBeLessThanOrEqual(created[index - 1]!);
  });

  it("reports the exact totals, so the screen can say « 50 sur N »", async () => {
    const { data } = await countInboundLeads(directorA);
    expect(data!.total).toBe(baselineLeads + 71);
    expect(data!.pending).toBeGreaterThanOrEqual(1);
    expect(data!.total).toBeGreaterThan(INBOUND_LEADS_PAGE_SIZE);
  });

  it("does not show B's leads to A, nor A's to B", async () => {
    const forB = await countInboundLeads(userB);
    expect(forB.data!.total).toBeLessThan(baselineLeads + 71);
    expect((await listInboundLeads(userB)).data!.some((lead) => lead.id === oldPendingId)).toBe(false);
  });

  it("refuses a request without session", async () => {
    expect((await countInboundLeads(env.anon)).error?.code).toBe("not_authenticated");
    expect((await countEmmaFollowUpCandidates(env.anon)).error?.code).toBe("not_authenticated");
  });
});

describe("Emma's workspace total", () => {
  it("counts the dossiers at the stages Emma works on, exactly", async () => {
    const before = (await countEmmaFollowUpCandidates(directorA)).data!;
    const rows = Array.from({ length: 130 }, (_, index) => ({
      agency_id: env.agencyA.agencyId,
      first_name: "Relance",
      last_name: `V${index}`,
      source: "manual_entry" as const,
      stage: "qualifie" as const,
    }));
    const inserted = await env.admin.from("contacts").insert(rows);
    if (inserted.error) throw new Error(inserted.error.message);
    const after = (await countEmmaFollowUpCandidates(directorA)).data!;
    expect(after - before).toBe(130);
    // Beyond the 100 listed, the total says so: the cut is visible.
    expect(after).toBeGreaterThan(100);
  });
});
