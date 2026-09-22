import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { listEmmaFollowUpCandidates } from "./data";
import { EMMA_ELIGIBLE_STAGES } from "./emma-relation/decision";
import type { EmmaFollowUpCandidateView } from "./types";

/**
 * Emma's manual follow-up workspace, against the LOCAL Supabase stack with
 * real sessions (RLS applies).
 *
 * What is proved here:
 *   * a genuinely empty agency reads back `ok([])`, never an error dressed up
 *     as an empty list;
 *   * only the open pipeline stages are listed — a signed mandate or a closed
 *     file never appears, whatever consent or draft state it carries;
 *   * `blockedReason` follows the documented priority: human takeover first,
 *     then a draft already waiting, then the channel/consent rule — never the
 *     model, always the same code path as Louis (`chooseChannel`);
 *   * a file in good standing gets `canPrepare: true` and the exact channel
 *     the shared rule would pick;
 *   * isolation between agencies: a file of another agency can never surface,
 *     whether it comes from `contacts`, `current_consents` or a pending draft.
 */

let env: TestEnv;
let agentA: TypedClient;
let directorA: TypedClient;
let userB: TypedClient;

type Seed = {
  stage?: (typeof EMMA_ELIGIBLE_STAGES)[number] | "mandat_signe" | "perdu";
  email?: string | null;
  phone?: string | null;
  humanTakeover?: boolean;
  agency?: "a" | "b";
  consents?: { channel: "email" | "sms" | "whatsapp" | "phone"; status: "granted" | "withdrawn" }[];
};

async function createContact(label: string, seed: Seed = {}): Promise<string> {
  const agency = seed.agency === "b" ? env.agencyB : env.agencyA;
  const { data, error } = await env.admin
    .from("contacts")
    .insert({
      agency_id: agency.agencyId,
      first_name: "Relance",
      last_name: `Test ${label}`,
      email: seed.email === undefined ? `relance-${label}.${env.runId}@example.test` : seed.email,
      phone: seed.phone === undefined ? "06 39 98 20 01" : seed.phone,
      source: "estimation_form",
      stage: seed.stage ?? "qualifie",
      human_takeover: seed.humanTakeover ?? false,
      assigned_user_id: agency.directorUserId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createContact(${label}): ${error?.message ?? "no row"}`);

  // Consents are append-only: inserted in order, the most recent row wins.
  for (const [index, consent] of (seed.consents ?? [{ channel: "email", status: "granted" }]).entries()) {
    const { error: consentError } = await env.admin.from("consents").insert({
      agency_id: agency.agencyId,
      contact_id: data.id,
      channel: consent.channel,
      status: consent.status,
      presented_text:
        consent.status === "granted" ? "J'accepte d'être recontacté par l'agence (texte de test)." : null,
      text_version: consent.status === "granted" ? "test-v1" : null,
      source: "estimation_form",
      proof: { form_id: `test-${env.runId}` },
      recorded_at: new Date(Date.now() - (10 - index) * 60_000).toISOString(),
    });
    if (consentError) throw new Error(`createConsent(${label}): ${consentError.message}`);
  }
  return data.id;
}

async function createPendingEmmaDraft(contactId: string, agency: "a" | "b" = "a"): Promise<void> {
  const agencyId = agency === "b" ? env.agencyB.agencyId : env.agencyA.agencyId;
  const { error } = await env.admin.from("outbound_messages").insert({
    agency_id: agencyId,
    contact_id: contactId,
    channel: "email",
    body: "Brouillon de relance en attente (test).",
    status: "pending_validation",
    created_by_agent: "emma",
    is_simulation: true,
    idempotency_key: `test-pending-${contactId}`,
  });
  if (error) throw new Error(`createPendingEmmaDraft: ${error.message}`);
}

function find(
  list: EmmaFollowUpCandidateView[],
  contactId: string,
): EmmaFollowUpCandidateView {
  const candidate = list.find((row) => row.id === contactId);
  if (!candidate) throw new Error(`candidate ${contactId} not found in list`);
  return candidate;
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

describe("listEmmaFollowUpCandidates — liste vide", () => {
  it("une agence sans dossier éligible renvoie ok([]) sans erreur", async () => {
    // The two contacts seeded by setupTestEnv start in `nouveau` (eligible):
    // move them out of scope so this one test genuinely starts from empty,
    // without touching how any other integration test file uses the helper.
    const { error } = await env.admin
      .from("contacts")
      .update({ stage: "perdu" })
      .in("id", [env.agencyA.contactId, env.agencyA.deletableContactId]);
    expect(error).toBeNull();

    const result = await listEmmaFollowUpCandidates(agentA);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});

describe("listEmmaFollowUpCandidates — étapes éligibles", () => {
  it("seules les étapes de EMMA_ELIGIBLE_STAGES apparaissent (mandat_signe et perdu absents)", async () => {
    const allStages = [...EMMA_ELIGIBLE_STAGES, "mandat_signe", "perdu"] as const;
    const idsByStage = new Map<string, string>();
    for (const stage of allStages) {
      idsByStage.set(stage, await createContact(`etape-${stage}`, { stage }));
    }

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(result.error).toBeNull();
    const list = result.data!;
    const listedIds = new Set(list.map((row) => row.id));

    for (const stage of EMMA_ELIGIBLE_STAGES) {
      expect(listedIds.has(idsByStage.get(stage)!), stage).toBe(true);
    }
    expect(listedIds.has(idsByStage.get("mandat_signe")!)).toBe(false);
    expect(listedIds.has(idsByStage.get("perdu")!)).toBe(false);
  });
});

describe("listEmmaFollowUpCandidates — blockedReason", () => {
  it("human_takeover est prioritaire sur toute autre raison", async () => {
    // Also has a pending draft AND no consent: human_takeover must still win.
    const contactId = await createContact("reprise-humaine", {
      humanTakeover: true,
      consents: [],
    });
    await createPendingEmmaDraft(contactId);

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(result.error).toBeNull();
    const candidate = find(result.data!, contactId);

    expect(candidate.humanTakeover).toBe(true);
    expect(candidate.blockedReason).toBe("human_takeover");
    expect(candidate.canPrepare).toBe(false);
  });

  it("pending_draft quand un brouillon Emma est déjà en attente de validation", async () => {
    const contactId = await createContact("brouillon-en-attente");
    await createPendingEmmaDraft(contactId);

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(result.error).toBeNull();
    const candidate = find(result.data!, contactId);

    expect(candidate.hasPendingEmmaDraft).toBe(true);
    expect(candidate.blockedReason).toBe("pending_draft");
    expect(candidate.canPrepare).toBe(false);
  });

  it("un brouillon approuvé ou déjà envoyé ne bloque pas — seul « pending_validation » compte", async () => {
    const contactId = await createContact("brouillon-envoye");
    // First contact requires a human validation stamp (`validated_by`) before
    // the database allows `sent_simulated` — same rule as everywhere else.
    const { error } = await env.admin.from("outbound_messages").insert({
      agency_id: env.agencyA.agencyId,
      contact_id: contactId,
      channel: "email",
      body: "Ancien message déjà envoyé (test).",
      status: "sent_simulated",
      created_by_agent: "emma",
      is_simulation: true,
      idempotency_key: `test-sent-${contactId}`,
      validated_by: env.agencyA.directorUserId,
      sent_at: new Date().toISOString(),
    });
    expect(error).toBeNull();

    const result = await listEmmaFollowUpCandidates(agentA);
    const candidate = find(result.data!, contactId);
    expect(candidate.hasPendingEmmaDraft).toBe(false);
    expect(candidate.blockedReason).toBeNull();
    expect(candidate.canPrepare).toBe(true);
  });

  it("consent_or_channel_missing quand aucun canal consenti n'est disponible", async () => {
    const contactId = await createContact("sans-consentement", { consents: [] });

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(result.error).toBeNull();
    const candidate = find(result.data!, contactId);

    expect(candidate.channel).toBeNull();
    expect(candidate.blockedReason).toBe("consent_or_channel_missing");
    expect(candidate.canPrepare).toBe(false);
  });

  it("consent_or_channel_missing aussi quand aucune coordonnée n'est exploitable", async () => {
    const contactId = await createContact("sans-coordonnees", { email: null, phone: null, consents: [] });

    const result = await listEmmaFollowUpCandidates(agentA);
    const candidate = find(result.data!, contactId);

    expect(candidate.channel).toBeNull();
    expect(candidate.blockedReason).toBe("consent_or_channel_missing");
  });

  it("un consentement téléphonique seul ne permet aucun message (canal exclu)", async () => {
    const contactId = await createContact("consentement-telephone", {
      consents: [{ channel: "phone", status: "granted" }],
    });

    const result = await listEmmaFollowUpCandidates(agentA);
    const candidate = find(result.data!, contactId);

    expect(candidate.channel).toBeNull();
    expect(candidate.blockedReason).toBe("consent_or_channel_missing");
  });
});

describe("listEmmaFollowUpCandidates — dossier en ordre", () => {
  it("canPrepare vaut true et le canal n'est jamais nul quand tout est en ordre", async () => {
    const contactId = await createContact("dossier-ok");

    const result = await listEmmaFollowUpCandidates(agentA);
    const candidate = find(result.data!, contactId);

    expect(candidate.canPrepare).toBe(true);
    expect(candidate.blockedReason).toBeNull();
    expect(candidate.channel).not.toBeNull();
    expect(candidate.hasPendingEmmaDraft).toBe(false);
    expect(candidate.humanTakeover).toBe(false);
  });

  it("le canal choisi suit exactement la règle de chooseChannel (email préféré, jamais décidé par le modèle)", async () => {
    const contactId = await createContact("canal-email-priorite", {
      consents: [
        { channel: "email", status: "granted" },
        { channel: "sms", status: "granted" },
      ],
    });

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(find(result.data!, contactId).channel).toBe("email");
  });

  it("bascule sur le SMS quand le consentement email a été retiré", async () => {
    const contactId = await createContact("canal-sms-repli", {
      consents: [
        { channel: "email", status: "granted" },
        { channel: "sms", status: "granted" },
        { channel: "email", status: "withdrawn" },
      ],
    });

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(find(result.data!, contactId).channel).toBe("sms");
  });

  it("bascule sur WhatsApp quand seul ce canal est consenti", async () => {
    const contactId = await createContact("canal-whatsapp", {
      consents: [{ channel: "whatsapp", status: "granted" }],
    });

    const result = await listEmmaFollowUpCandidates(agentA);
    expect(find(result.data!, contactId).channel).toBe("whatsapp");
  });
});

describe("listEmmaFollowUpCandidates — isolation entre agences", () => {
  it("un membre de l'agence A ne voit jamais un dossier, un consentement ou un brouillon de l'agence B", async () => {
    const contactB = await createContact("isolation-b", { agency: "b" });
    await createPendingEmmaDraft(contactB, "b");

    const resultA = await listEmmaFollowUpCandidates(agentA);
    expect(resultA.error).toBeNull();
    expect(resultA.data!.some((row) => row.id === contactB)).toBe(false);
    expect(JSON.stringify(resultA.data)).not.toContain(env.agencyB.agencyId);
  });

  it("réciproquement, un membre de l'agence B ne voit jamais un dossier de l'agence A", async () => {
    const contactA = await createContact("isolation-a");

    const resultB = await listEmmaFollowUpCandidates(userB);
    expect(resultB.error).toBeNull();
    expect(resultB.data!.some((row) => row.id === contactA)).toBe(false);
    expect(JSON.stringify(resultB.data)).not.toContain(env.agencyA.agencyId);
  });

  it("un directeur de l'agence A obtient exactement la même isolation qu'un agent", async () => {
    const contactB = await createContact("isolation-directeur-b", { agency: "b" });

    const result = await listEmmaFollowUpCandidates(directorA);
    expect(result.error).toBeNull();
    expect(result.data!.some((row) => row.id === contactB)).toBe(false);
  });

  /**
   * The three tests above would still pass with RLS disabled, because the query
   * also filters on `agency_id` in the application. That filter must be defence
   * in depth, never the frontier. This one removes the filter and reads the
   * three sources of the workspace with the SAME authenticated session: what
   * comes back is what the database alone is willing to hand over.
   */
  it("la RLS est la vraie frontière : sans filtre applicatif, les trois sources ne renvoient que l'agence de la session", async () => {
    const contactB = await createContact("isolation-rls-b", { agency: "b" });
    await createPendingEmmaDraft(contactB, "b");

    const [contacts, consents, drafts] = await Promise.all([
      agentA.from("contacts").select("id, agency_id"),
      agentA.from("current_consents").select("contact_id, agency_id"),
      agentA.from("outbound_messages").select("contact_id, agency_id"),
    ]);

    expect(contacts.error).toBeNull();
    expect(consents.error).toBeNull();
    expect(drafts.error).toBeNull();

    for (const rows of [contacts.data, consents.data, drafts.data]) {
      expect(rows!.length).toBeGreaterThan(0);
      expect(new Set(rows!.map((row) => row.agency_id))).toEqual(
        new Set([env.agencyA.agencyId]),
      );
    }
    expect(contacts.data!.some((row) => row.id === contactB)).toBe(false);
    expect(drafts.data!.some((row) => row.contact_id === contactB)).toBe(false);
  });
});
