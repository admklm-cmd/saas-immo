import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { TestEnv } from "./testing/local-test-env";
import { setupTestEnv } from "./testing/local-test-env";

let env: TestEnv;

beforeAll(async () => {
  env = await setupTestEnv();
});

afterAll(async () => {
  await env?.cleanup();
});

describe("database security state hardening", () => {
  it("bounds inbound payloads and freezes their source material", async () => {
    const client = env.users.agentA.client;
    const tooLarge = await client.from("inbound_leads").insert({
      agency_id: env.agencyA.agencyId,
      source: "manual_entry",
      payload: { body: "x".repeat(70_000) },
    });
    expect(tooLarge.error?.code).toBe("23514");

    const changed = await client
      .from("inbound_leads")
      .update({ raw_text: "contenu remplacé" })
      .eq("id", env.agencyA.inboundLeadId);
    expect(changed.error?.message).toContain("inbound_lead_provenance_immutable");
  });

  it("requires a real running Lea run and freezes a processed lead", async () => {
    const client = env.users.agentA.client;
    const run = await client
      .from("ai_agent_runs")
      .insert({
        agency_id: env.agencyA.agencyId,
        agent: "lea",
        status: "running",
        provider: "simulator",
        model: "deterministic-v1",
        is_simulation: true,
      })
      .select("id")
      .single();
    expect(run.error).toBeNull();

    const processed = await client
      .from("inbound_leads")
      .update({
        status: "processed",
        contact_id: env.agencyA.contactId,
        processed_run_id: run.data!.id,
      })
      .eq("id", env.agencyA.inboundLeadId);
    expect(processed.error).toBeNull();

    const reopened = await client
      .from("inbound_leads")
      .update({ status: "pending", contact_id: null, processed_run_id: null })
      .eq("id", env.agencyA.inboundLeadId);
    expect(reopened.error?.message).toContain("inbound_lead_terminal");
  });

  it("journals a human message decision in the same database statement", async () => {
    const client = env.users.agentA.client;
    const message = await client
      .from("outbound_messages")
      .insert({
        agency_id: env.agencyA.agencyId,
        contact_id: env.agencyA.contactId,
        channel: "email",
        body: "Brouillon à refuser",
        idempotency_key: `security-reject-${env.runId}`,
        created_by_agent: "emma",
      })
      .select("id")
      .single();
    expect(message.error).toBeNull();

    const withoutReason = await client
      .from("outbound_messages")
      .update({ status: "rejected", validated_by: env.users.agentA.id })
      .eq("id", message.data!.id);
    expect(withoutReason.error?.message).toContain("outbound_message_rejection_reason_required");

    const rejected = await client
      .from("outbound_messages")
      .update({
        status: "rejected",
        validated_by: env.users.agentA.id,
        rejection_reason: "inappropriate_tone",
        rejection_note: "Trop insistant.",
      })
      .eq("id", message.data!.id);
    expect(rejected.error).toBeNull();

    const journal = await env.admin
      .from("activities")
      .select("actor_user_id, payload")
      .eq("type", "message_rejected")
      .eq("contact_id", env.agencyA.contactId)
      .contains("payload", { message_id: message.data!.id })
      .single();
    expect(journal.error).toBeNull();
    expect(journal.data?.actor_user_id).toBe(env.users.agentA.id);
    expect(journal.data?.payload).toMatchObject({
      rejection_reason: "inappropriate_tone",
      rejection_reason_label: "Ton ou formulation inadaptés",
      rejection_note: "Trop insistant.",
    });
  });

  it("only lets the user who started a run finish it", async () => {
    const owner = env.users.agentA.client;
    const run = await owner
      .from("ai_agent_runs")
      .insert({
        agency_id: env.agencyA.agencyId,
        agent: "hugo",
        contact_id: env.agencyA.contactId,
        status: "running",
        provider: "simulator",
        model: "deterministic-v1",
        is_simulation: true,
      })
      .select("id, triggered_by_user_id")
      .single();
    expect(run.data?.triggered_by_user_id).toBe(env.users.agentA.id);

    const otherMember = await env.users.directorA.client
      .from("ai_agent_runs")
      .update({ status: "succeeded" })
      .eq("id", run.data!.id);
    expect(otherMember.error?.message).toContain("ai_agent_run_not_owner");

    const finished = await owner
      .from("ai_agent_runs")
      .update({ status: "succeeded" })
      .eq("id", run.data!.id);
    expect(finished.error).toBeNull();
  });
});
