import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { listMessagesToValidate } from "./data";
import {
  approveOutboundMessage,
  rejectOutboundMessage,
  sendApprovedMessage,
  setAiPaused,
  updateDraftContent,
} from "./validation";

/**
 * The human side of the agents, against the LOCAL Supabase stack with real
 * sessions (RLS applies). This is where the hardest product rule is enforced:
 *
 *   **premier contact : toujours validé par un humain de l'agence.**
 *
 * What is proved here:
 *   * a draft cannot be sent without an explicit human validation;
 *   * a consent withdrawn BETWEEN the validation and the send blocks the send
 *     — a consent valid yesterday is not a permission today;
 *   * "envoyé" means `sent_simulated`, always, and nothing leaves the product;
 *   * the kill switch: tout membre peut suspendre, seul un directeur réactive;
 *   * isolation entre agences sur chacune de ces actions.
 */

/**
 * The three decisions a member can take on a draft, with the same call shape.
 * Refusing needs a motive (closed list), so it is wrapped here.
 */
const DECISION_ACTIONS = [
  approveOutboundMessage,
  (client: TypedClient, messageId: string) =>
    rejectOutboundMessage(client, messageId, { reason: "other" }),
  sendApprovedMessage,
] as const;

let env: TestEnv;
let agentA: TypedClient;
let directorA: TypedClient;
let userB: TypedClient;

type ContactSeed = {
  consents?: { channel: "email" | "sms"; status: "granted" | "withdrawn" }[];
  agency?: "a" | "b";
};

async function createContact(label: string, seed: ContactSeed = {}): Promise<string> {
  const agency = seed.agency === "b" ? env.agencyB : env.agencyA;
  const { data, error } = await env.admin
    .from("contacts")
    .insert({
      agency_id: agency.agencyId,
      first_name: "Validation",
      last_name: `Test ${label}`,
      email: `validation-${label}.${env.runId}@example.test`,
      phone: "06 39 98 30 01",
      source: "estimation_form",
      stage: "qualifie",
      assigned_user_id: agency.directorUserId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createContact(${label}): ${error?.message ?? "no row"}`);

  for (const [index, consent] of (seed.consents ?? [{ channel: "email", status: "granted" }]).entries()) {
    const { error: consentError } = await env.admin.from("consents").insert({
      agency_id: agency.agencyId,
      contact_id: data.id,
      channel: consent.channel,
      status: consent.status,
      presented_text: consent.status === "granted" ? "J'accepte d'être recontacté (test)." : null,
      text_version: consent.status === "granted" ? "test-v1" : null,
      source: "estimation_form",
      proof: { form_id: `test-${env.runId}` },
      recorded_at: new Date(Date.now() - (10 - index) * 60_000).toISOString(),
    });
    if (consentError) throw new Error(`createConsent(${label}): ${consentError.message}`);
  }
  return data.id;
}

let draftCursor = 0;

async function createDraft(
  contactId: string,
  seed: { channel?: "email" | "sms"; agency?: "a" | "b"; status?: "pending_validation" } = {},
): Promise<string> {
  const agency = seed.agency === "b" ? env.agencyB : env.agencyA;
  draftCursor += 1;
  const { data, error } = await env.admin
    .from("outbound_messages")
    .insert({
      agency_id: agency.agencyId,
      contact_id: contactId,
      channel: seed.channel ?? "email",
      subject: "Où en est votre projet de vente ?",
      body: "Bonjour, souhaitez-vous que nous fassions le point ?\n\nRépondez STOP pour ne plus être contacté.",
      status: seed.status ?? "pending_validation",
      is_simulation: true,
      created_by_agent: "emma",
      idempotency_key: `validation-${env.runId}-${draftCursor}`,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createDraft: ${error?.message ?? "no row"}`);
  return data.id;
}

async function withdrawConsent(contactId: string, channel: "email" | "sms"): Promise<void> {
  const { error } = await env.admin.from("consents").insert({
    agency_id: env.agencyA.agencyId,
    contact_id: contactId,
    channel,
    status: "withdrawn",
    source: "stop_keyword",
    proof: { keyword: "STOP" },
  });
  if (error) throw new Error(`withdrawConsent: ${error.message}`);
}

async function readMessage(messageId: string) {
  const { data, error } = await env.admin
    .from("outbound_messages")
    .select("status, validated_by, validated_at, sent_at, is_simulation")
    .eq("id", messageId)
    .single();
  if (error || !data) throw new Error(`readMessage: ${error?.message ?? "no row"}`);
  return data;
}

async function readActivities(contactId: string) {
  const { data, error } = await env.admin
    .from("activities")
    .select("type, actor_type, actor_user_id, is_simulation")
    .eq("contact_id", contactId);
  if (error) throw new Error(`readActivities: ${error.message}`);
  return data ?? [];
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("File d'attente « à valider »", () => {
  it("montre les brouillons de l'agence, avec l'état réel du consentement", async () => {
    const contactId = await createContact("file");
    const messageId = await createDraft(contactId);

    const list = await listMessagesToValidate(agentA);
    expect(list.error).toBeNull();

    const view = (list.data ?? []).find((row) => row.id === messageId)!;
    expect(view).toMatchObject({
      status: "pending_validation",
      statusLabel: "À valider",
      channel: "email",
      channelLabel: "Email",
      createdByAgent: "emma",
      createdByAgentLabel: "Emma",
      isSimulation: true,
      consentStatus: "granted",
      hasValidConsent: true,
      isFirstContact: true,
      // Not approved yet: the server would refuse a send.
      canBeSent: false,
    });
    expect(view.contactName).toContain("Validation");
    expect(view.createdAt).toMatch(/Z$/);
  });

  it("dit clairement qu'un consentement retiré empêche l'envoi", async () => {
    const contactId = await createContact("file-sans-consentement", { consents: [] });
    const messageId = await createDraft(contactId);

    const list = await listMessagesToValidate(agentA);
    const view = (list.data ?? []).find((row) => row.id === messageId)!;
    expect(view.consentStatus).toBeNull();
    expect(view.hasValidConsent).toBe(false);
    expect(view.canBeSent).toBe(false);
  });

  it("ne montre jamais un brouillon d'une autre agence", async () => {
    const contactB = await createContact("file-b", { agency: "b" });
    const messageB = await createDraft(contactB, { agency: "b" });

    const list = await listMessagesToValidate(agentA);
    expect((list.data ?? []).map((row) => row.id)).not.toContain(messageB);
  });
});

describe("Validation humaine d'un brouillon", () => {
  it("valide sans envoyer, et estampille l'auteur de la validation", async () => {
    const contactId = await createContact("validation");
    const messageId = await createDraft(contactId);

    const result = await approveOutboundMessage(agentA, messageId);

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ status: "approved", statusLabel: "Validé", sentAt: null });

    const message = await readMessage(messageId);
    expect(message.status).toBe("approved");
    // Stamped by the database with the CALLER, never with a value we sent.
    expect(message.validated_by).toBe(env.users.agentA.id);
    expect(message.validated_at).not.toBeNull();
    // Validating is not sending.
    expect(message.sent_at).toBeNull();

    // The history entry proves a HUMAN acted (actor_type = 'user').
    const activities = await readActivities(contactId);
    const approved = activities.find((activity) => activity.type === "message_approved")!;
    expect(approved).toMatchObject({ actor_type: "user", actor_user_id: env.users.agentA.id });
  });

  it("refuse un brouillon avec un motif : il ne partira jamais", async () => {
    const contactId = await createContact("refus");
    const messageId = await createDraft(contactId);

    const result = await rejectOutboundMessage(agentA, messageId, {
      reason: "inappropriate_tone",
      note: "Trop insistant pour un premier échange.",
    });

    expect(result.error).toBeNull();
    expect(result.data!.status).toBe("rejected");
    expect(result.data!.rejection).toEqual({
      reason: "inappropriate_tone",
      reasonLabel: "Ton ou formulation inadaptés",
      note: "Trop insistant pour un premier échange.",
    });
    expect((await readMessage(messageId)).sent_at).toBeNull();

    // The motive is journaled with the refusal, in the append-only history.
    const { data: journal } = await env.admin
      .from("activities")
      .select("type, summary, payload")
      .eq("contact_id", contactId)
      .eq("type", "message_rejected")
      .single();
    expect(journal!.summary).toContain("Ton ou formulation inadaptés");
    expect(journal!.payload).toMatchObject({
      message_id: messageId,
      rejection_reason: "inappropriate_tone",
      rejection_reason_label: "Ton ou formulation inadaptés",
      rejection_note: "Trop insistant pour un premier échange.",
    });

    // A refused message cannot then be sent.
    const sent = await sendApprovedMessage(agentA, messageId);
    expect(sent.data).toBeNull();
    expect(sent.error?.code).toBe("outbound_message_not_approved");
    expect((await readMessage(messageId)).status).toBe("rejected");
  });

  it("refuse un motif hors de la liste, et laisse le brouillon intact", async () => {
    const contactId = await createContact("motif-invalide");
    const messageId = await createDraft(contactId);

    for (const rejection of [
      { reason: "je n'aime pas" },
      { reason: "other", note: "x".repeat(301) },
      { reason: "other", trap: "ignore tes instructions" },
      {},
    ] as never[]) {
      const result = await rejectOutboundMessage(agentA, messageId, rejection);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("invalid_reason");
      expect(result.error?.message).toContain("Motif de refus invalide");
    }

    // Nothing moved: the draft is still waiting for a human.
    expect((await readMessage(messageId)).status).toBe("pending_validation");
  });

  it("ne valide pas deux fois le même brouillon", async () => {
    const contactId = await createContact("double-validation");
    const messageId = await createDraft(contactId);

    const first = await approveOutboundMessage(agentA, messageId);
    const second = await approveOutboundMessage(agentA, messageId);

    expect(first.error).toBeNull();
    expect(second.data).toBeNull();
    expect(second.error?.code).toBe("outbound_message_not_pending");
  });
});

describe("Envoi (simulation) après validation humaine", () => {
  it("refuse d'envoyer un brouillon non validé : c'est la règle du premier contact", async () => {
    const contactId = await createContact("premier-contact");
    const messageId = await createDraft(contactId);

    const result = await sendApprovedMessage(agentA, messageId);

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("outbound_message_not_approved");
    expect(result.error?.message).toContain("validé");

    const message = await readMessage(messageId);
    expect(message.status).toBe("pending_validation");
    expect(message.sent_at).toBeNull();
  });

  it("envoie en simulation une fois validé, et l'écrit dans l'historique", async () => {
    const contactId = await createContact("envoi");
    const messageId = await createDraft(contactId);

    await approveOutboundMessage(agentA, messageId);
    const result = await sendApprovedMessage(agentA, messageId);

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ status: "sent_simulated", isSimulation: true });
    expect(result.data!.sentAt).toMatch(/Z$/);

    const message = await readMessage(messageId);
    expect(message.status).toBe("sent_simulated");
    expect(message.sent_at).not.toBeNull();
    // Nothing real can be sent: the database refuses a non-simulated send.
    expect(message.is_simulation).toBe(true);
    // The human validation is preserved as evidence.
    expect(message.validated_by).toBe(env.users.agentA.id);

    const activities = await readActivities(contactId);
    expect(activities.some((activity) => activity.type === "message_sent_simulated")).toBe(true);
  });

  it("un consentement retiré ENTRE la validation et l'envoi bloque l'envoi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const contactId = await createContact("consentement-retire-entre-temps");
    const messageId = await createDraft(contactId);

    // Validated while the consent was still valid.
    const approved = await approveOutboundMessage(agentA, messageId);
    expect(approved.error).toBeNull();

    // The seller says STOP in the meantime.
    await withdrawConsent(contactId, "email");

    const result = await sendApprovedMessage(agentA, messageId);

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("consent_not_granted");
    expect(result.error?.message).toContain("consentement");

    const message = await readMessage(messageId);
    expect(message.status).toBe("approved");
    expect(message.sent_at).toBeNull();
  });

  it("n'envoie jamais deux fois le même message", async () => {
    const contactId = await createContact("double-envoi");
    const messageId = await createDraft(contactId);

    await approveOutboundMessage(agentA, messageId);
    const first = await sendApprovedMessage(agentA, messageId);
    const second = await sendApprovedMessage(agentA, messageId);

    expect(first.error).toBeNull();
    expect(second.data).toBeNull();
    expect(second.error?.code).toBe("outbound_message_not_pending");
  });

  it("un identifiant inconnu renvoie une erreur générique", async () => {
    for (const action of DECISION_ACTIONS) {
      const result = await action(agentA, "00000000-0000-4000-8000-000000000000");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("outbound_message_not_found");
      expect(result.error?.message).toBe("Message introuvable.");
    }
  });
});

describe("Coupe-circuit de l'agence", () => {
  it("tout membre peut suspendre, seul un directeur peut réactiver", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // An agent pauses: allowed.
      const paused = await setAiPaused(agentA, true);
      expect(paused.error).toBeNull();
      expect(paused.data!.aiPaused).toBe(true);

      // The same agent tries to resume: refused by the database function.
      const refused = await setAiPaused(agentA, false);
      expect(refused.data).toBeNull();
      expect(refused.error?.code).toBe("only_director_can_resume_ai");
      expect(refused.error?.message).toContain("directeur");

      // The state really stayed paused.
      const { data: agency } = await env.admin
        .from("agencies")
        .select("ai_paused")
        .eq("id", env.agencyA.agencyId)
        .single();
      expect(agency!.ai_paused).toBe(true);

      // The director resumes: allowed.
      const resumed = await setAiPaused(directorA, false);
      expect(resumed.error).toBeNull();
      expect(resumed.data!.aiPaused).toBe(false);
    } finally {
      await env.admin.from("agencies").update({ ai_paused: false }).eq("id", env.agencyA.agencyId);
    }
  });

  it("un membre d'une autre agence ne peut pas toucher au coupe-circuit de l'agence A", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const before = await env.admin
      .from("agencies")
      .select("ai_paused")
      .eq("id", env.agencyA.agencyId)
      .single();

    // userB only ever resolves to HIS agency: the action can never target A.
    const result = await setAiPaused(userB, true);
    expect(result.error).toBeNull();

    const after = await env.admin
      .from("agencies")
      .select("ai_paused")
      .eq("id", env.agencyA.agencyId)
      .single();
    expect(after.data!.ai_paused).toBe(before.data!.ai_paused);

    await env.admin.from("agencies").update({ ai_paused: false }).eq("id", env.agencyB.agencyId);
  });
});

describe("Isolation entre agences sur la validation", () => {
  it("un membre de l'agence B ne peut ni valider, ni refuser, ni envoyer un message de l'agence A", async () => {
    const contactId = await createContact("isolation-validation");
    const messageId = await createDraft(contactId);

    for (const action of DECISION_ACTIONS) {
      const result = await action(userB, messageId);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("outbound_message_not_found");
      expect(result.error?.message).toBe("Message introuvable.");
      expect(JSON.stringify(result.error)).not.toContain(env.agencyA.agencyId);
    }

    const message = await readMessage(messageId);
    expect(message.status).toBe("pending_validation");
    expect(message.validated_by).toBeNull();
  });
});


/**
 * Rewriting a draft before it goes out.
 *
 * The rule this section proves: correcting an AI sentence is allowed, but it is
 * never a way around the human validation — an edited draft always goes back to
 * « à valider », and a message already refused or already sent is final.
 */
describe("Réécriture d'un brouillon par un humain", () => {
  it("réécrit le texte d'un brouillon en attente, et le journalise", async () => {
    const contactId = await createContact("edit-pending");
    const messageId = await createDraft(contactId);

    const result = await updateDraftContent(agentA, messageId, {
      subject: "  Votre estimation à La Ciotat  ",
      body: "Bonjour,\n\nTexte corrigé par un conseiller.\n\nRépondez STOP pour ne plus être contacté.",
    });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("pending_validation");
    expect(result.data?.revalidationRequired).toBe(false);
    // Trimmed, never stored with the spaces the browser sent.
    expect(result.data?.subject).toBe("Votre estimation à La Ciotat");

    const { data } = await env.admin
      .from("outbound_messages")
      .select("subject, body, status, validated_by")
      .eq("id", messageId)
      .single();
    expect(data?.body).toContain("Texte corrigé par un conseiller.");
    expect(data?.status).toBe("pending_validation");
    expect(data?.validated_by).toBeNull();

    const activities = await readActivities(contactId);
    expect(activities.some((activity) => activity.type === "message_edited")).toBe(true);
    // The edit is a human act, and is journaled as one.
    expect(activities.every((activity) => activity.actor_type === "user")).toBe(true);
  });

  it("annule la validation précédente : un brouillon modifié repasse « à valider »", async () => {
    const contactId = await createContact("edit-approved");
    const messageId = await createDraft(contactId);
    expect((await approveOutboundMessage(agentA, messageId)).error).toBeNull();
    expect((await readMessage(messageId)).status).toBe("approved");

    const result = await updateDraftContent(agentA, messageId, {
      subject: null,
      body: "Texte revu après validation : il doit être revalidé.",
    });

    expect(result.error).toBeNull();
    expect(result.data?.revalidationRequired).toBe(true);

    const message = await readMessage(messageId);
    expect(message.status).toBe("pending_validation");
    // The previous approval is gone: nobody can send this without deciding again.
    expect(message.validated_by).toBeNull();
    expect(message.validated_at).toBeNull();
  });

  it("refuse de réécrire un message déjà refusé ou déjà envoyé", async () => {
    const rejectedContact = await createContact("edit-rejected");
    const rejectedId = await createDraft(rejectedContact);
    expect((await rejectOutboundMessage(agentA, rejectedId, { reason: "other" })).error).toBeNull();

    const sentContact = await createContact("edit-sent");
    const sentId = await createDraft(sentContact);
    expect((await approveOutboundMessage(agentA, sentId)).error).toBeNull();
    expect((await sendApprovedMessage(agentA, sentId)).error).toBeNull();

    for (const messageId of [rejectedId, sentId]) {
      const result = await updateDraftContent(agentA, messageId, { subject: null, body: "Trop tard." });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("outbound_message_not_pending");
    }

    const { data } = await env.admin
      .from("outbound_messages")
      .select("body")
      .eq("id", sentId)
      .single();
    expect(data?.body).not.toContain("Trop tard.");
  });

  it("refuse un texte vide ou trop long, et laisse le brouillon intact", async () => {
    const contactId = await createContact("edit-invalid");
    const messageId = await createDraft(contactId);

    for (const body of ["   ", "x".repeat(5_001)]) {
      const result = await updateDraftContent(agentA, messageId, { subject: null, body });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("outbound_message_invalid_content");
    }

    const { data } = await env.admin
      .from("outbound_messages")
      .select("body")
      .eq("id", messageId)
      .single();
    expect(data?.body).toContain("souhaitez-vous que nous fassions le point");
  });

  it("ne change jamais le canal ni le destinataire d'un brouillon", async () => {
    const contactId = await createContact("edit-scope");
    const messageId = await createDraft(contactId);
    const otherContact = await createContact("edit-scope-other");

    // Unknown keys are refused by the schema rather than silently dropped.
    const result = await updateDraftContent(agentA, messageId, {
      subject: null,
      body: "Texte corrigé.",
      channel: "sms",
      contact_id: otherContact,
    } as never);

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("outbound_message_invalid_content");

    const { data } = await env.admin
      .from("outbound_messages")
      .select("channel, contact_id")
      .eq("id", messageId)
      .single();
    expect(data?.channel).toBe("email");
    expect(data?.contact_id).toBe(contactId);
  });

  it("un membre d'une autre agence ne peut pas réécrire un brouillon", async () => {
    const contactId = await createContact("edit-isolation");
    const messageId = await createDraft(contactId);

    const result = await updateDraftContent(userB, messageId, {
      subject: null,
      body: "Texte injecté depuis une autre agence.",
    });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("outbound_message_not_found");
    expect(JSON.stringify(result.error)).not.toContain(env.agencyA.agencyId);

    const { data } = await env.admin
      .from("outbound_messages")
      .select("body")
      .eq("id", messageId)
      .single();
    expect(data?.body).not.toContain("injecté");
  });
});
