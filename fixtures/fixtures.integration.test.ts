import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

import { assertLocalSupabaseUrl, assertNotProduction } from "../lib/supabase/local-only";
import { buildFixtures, FIXTURE_EXPECTED_COUNTS, NOTABLE_CONTACTS } from "./dataset";
import { FIXTURE_AGENCY_IDS, FIXTURE_EMAIL_DOMAIN, FIXTURE_PHONE_PATTERN, FIXTURE_USERS } from "./fixture-ids";

/**
 * Proves that the loaded fixtures are, and stay, 100 % synthetic:
 * reserved e-mail domain, Arcep fiction phone blocks, "(fictive)" agency names,
 * every simulated action flagged as such, and the expected volumes.
 *
 * Determinism: this suite runs IN PARALLEL with the other integration tests
 * (and after the Playwright journeys) on the SAME local base. It therefore
 *   * only inspects the contacts of the two fixture agencies
 *     (FIXTURE_AGENCY_IDS) — the throw-away agencies of the other suites are
 *     none of its business; the "Arcep fiction numbers only" rule for THEIR
 *     rows is proved statically, on the test sources that write them, by
 *     fixtures/test-phone-numbers.test.ts;
 *   * checks the fixture rows by their deterministic identifiers
 *     (buildFixtures) instead of assuming nobody else ever writes in the
 *     fixture agencies: the estimation suite and the E2E journeys legitimately
 *     append history there (consents, activities, pipeline moves);
 *   * keeps every safety property that must hold for ANY row of the fixture
 *     agencies (no real phone or e-mail, no non-simulated AI action, no real
 *     AI provider) as a whole-agency check — an extra row that breaks one of
 *     them is a real defect, not noise.
 *
 * Fails loudly (with the command to run) if the local stack is unreachable or
 * if the fixtures have not been loaded.
 */

const CONTEXT = "Fixtures check";
const AGENCY_IDS = [FIXTURE_AGENCY_IDS.a, FIXTURE_AGENCY_IDS.b];

/**
 * The ONLY activity types allowed to carry `is_simulation = false`.
 *
 * `is_simulation` answers "was this ACTION simulated?", not "is this DATA
 * synthetic?" — two different questions this suite used to conflate, which made
 * it order-dependent: running the Playwright journey (which really flips the
 * kill switch through `public.set_ai_paused`) left a legitimate
 * `ai_paused` / `ai_resumed` row behind and failed a later `vitest` run.
 *
 * Flipping the kill switch IS a real action, really performed by a real human
 * of the agency, and the RPC journals it as such on purpose. Marking it
 * "simulation" would be the actual lie. The synthetic nature of the fixtures is
 * proved by the tests above (reserved e-mail domain, Arcep fiction numbers,
 * "(fictive)" agency names) — not by this flag.
 *
 * `contact_stage_changed` is the human pipeline decision journaled by
 * `public.change_contact_stage` (migration 20260923120000_contact_stage_change.sql,
 * rules validated by the user on 2026-09-23). It is an INTERNAL CRM decision —
 * nothing is sent to anyone — hence real by design, and it targets a contact.
 * The pipeline E2E journey performs exactly that on a fixture contact (then
 * restores it), which is why such rows legitimately appear here. The type is
 * reserved to that RPC by a trigger (`private.guard_stage_change_activity`):
 * nobody can forge one with a plain INSERT.
 *
 * So the assertion is narrowed, not relaxed. A non-simulated activity is
 * accepted only if it is of a known type, written by a human, and points where
 * its type says it must (see REAL_ACTIVITY_SCOPE). What this still catches —
 * and what it exists for:
 *   * an AI agent writing an action that is NOT marked as simulated
 *     (`actor_type = 'ai_agent'`) — the dangerous regression;
 *   * any real OUTBOUND action (a send, a booking…) recorded against one of
 *     the fictitious contacts, e.g. a send that stopped being simulated;
 *   * any new activity type that starts claiming to be real.
 *
 * Do not widen this list to make a test pass: a new entry here means a new real
 * action exists in the product, and that deserves its own review.
 */
const REAL_ACTIVITY_TYPES = ["ai_paused", "ai_resumed", "contact_stage_changed"] as const;
type RealActivityType = (typeof REAL_ACTIVITY_TYPES)[number];

/** "agency": configuration, never tied to a contact. "contact": one contact's file. */
const REAL_ACTIVITY_SCOPE: Record<RealActivityType, "agency" | "contact"> = {
  ai_paused: "agency",
  ai_resumed: "agency",
  contact_stage_changed: "contact",
};

const PIPELINE_STAGES = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite", "mandat_signe", "perdu"];

/** Exactly the rows the loader writes, with their deterministic identifiers. */
const DATASET = buildFixtures();
const FIXTURE_CONTACTS = [...DATASET.a.contacts, ...DATASET.b.contacts];
const FIXTURE_ACTIVITIES = [...DATASET.a.activities, ...DATASET.b.activities];

type TypedClient = SupabaseClient<Database>;

let admin: TypedClient;

beforeAll(async () => {
  assertNotProduction(CONTEXT);
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, CONTEXT);
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(`${CONTEXT}: missing SUPABASE_SECRET_KEY (see .env.example).`);
  }
  admin = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await admin.from("agencies").select("id, name").in("id", AGENCY_IDS);
  if (error) {
    throw new Error(
      `${CONTEXT}: local Supabase unreachable or schema missing (${error.message}). Run \`npm run db:start\` then \`npm run db:reset\`.`,
    );
  }
  if ((data ?? []).length !== 2) {
    throw new Error(
      `${CONTEXT}: fixtures are not loaded (${(data ?? []).length}/2 fictitious agencies found). Run \`npm run db:reset\`.`,
    );
  }
});

async function rows<T extends "contacts" | "appointments" | "outbound_messages" | "activities" | "ai_agent_runs" | "consents" | "tasks" | "properties">(
  table: T,
  columns: string,
) {
  const { data, error } = await (admin as unknown as SupabaseClient)
    .from(table)
    .select(columns)
    .in("agency_id", AGENCY_IDS);
  expect(error, `${table}: ${error?.message ?? ""}`).toBeNull();
  return (data ?? []) as unknown as Record<string, unknown>[];
}

describe("fixtures : données 100 % fictives", () => {
  it("les deux agences sont explicitement fictives", async () => {
    const { data } = await admin.from("agencies").select("id, name, ai_paused").in("id", AGENCY_IDS);
    const names = (data ?? []).map((agency) => agency.name).sort();
    expect(names).toEqual(["Agence Test Isolation (fictive)", "Calanques Immobilier (fictive)"]);
    expect((data ?? []).every((agency) => agency.name.includes("(fictive)"))).toBe(true);
    // Kill switch off: the prototype journey must be runnable right after loading.
    expect((data ?? []).every((agency) => agency.ai_paused === false)).toBe(true);
  });

  it("aucune agence en base ne porte un nom non fictif", async () => {
    // Whole base on purpose, and stable under concurrency: every agency any
    // test creates is named "… (fictive)" (lib/supabase/testing/local-test-env.ts).
    const { data, error } = await admin.from("agencies").select("name");
    expect(error).toBeNull();
    for (const agency of data ?? []) {
      expect(agency.name, `agence « ${agency.name} »`).toContain("(fictive)");
    }
  });

  it("tous les emails de contact des agences de fixtures utilisent le domaine réservé @example.test", async () => {
    const { data, error } = await admin.from("contacts").select("id, email").in("agency_id", AGENCY_IDS);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const contact of data ?? []) {
      if (contact.email !== null) {
        expect(contact.email.endsWith(`@${FIXTURE_EMAIL_DOMAIN}`), `email « ${contact.email} »`).toBe(true);
      }
    }
  });

  it("tous les téléphones des agences de fixtures sont dans les tranches de fiction de l'Arcep", async () => {
    const { data, error } = await admin.from("contacts").select("id, phone").in("agency_id", AGENCY_IDS);
    expect(error).toBeNull();
    const phones = (data ?? []).map((contact) => contact.phone).filter((phone): phone is string => phone !== null);
    expect(phones.length).toBeGreaterThan(0);
    for (const phone of phones) {
      expect(FIXTURE_PHONE_PATTERN.test(phone), `téléphone « ${phone} »`).toBe(true);
    }
  });

  it("chaque fiche de fixture existe avec exactement les coordonnées fictives du jeu de données", async () => {
    const { data, error } = await admin
      .from("contacts")
      .select("id, agency_id, email, phone")
      .in("id", FIXTURE_CONTACTS.map((contact) => contact.id!));
    expect(error).toBeNull();
    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    for (const expected of FIXTURE_CONTACTS) {
      const row = byId.get(expected.id!);
      expect(row, `fiche de fixture manquante : ${expected.id}`).toBeDefined();
      expect(row).toEqual({
        id: expected.id,
        agency_id: expected.agency_id,
        email: expected.email ?? null,
        phone: expected.phone ?? null,
      });
    }
  });

  it("les comptes utilisateurs de test sont en @example.test", async () => {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(error).toBeNull();
    for (const user of data?.users ?? []) {
      expect(user.email?.endsWith(`@${FIXTURE_EMAIL_DOMAIN}`), `compte « ${user.email} »`).toBe(true);
    }
    const emails = new Set((data?.users ?? []).map((user) => user.email));
    for (const fixtureUser of FIXTURE_USERS) {
      expect(emails.has(fixtureUser.email), `compte manquant : ${fixtureUser.email}`).toBe(true);
    }
  });

  it.each(["appointments", "outbound_messages", "ai_agent_runs"] as const)(
    "aucune action réelle (is_simulation = false) dans %s",
    async (table) => {
      const { count, error } = await (admin as unknown as SupabaseClient)
        .from(table)
        .select("id", { count: "exact", head: true })
        .in("agency_id", AGENCY_IDS)
        .eq("is_simulation", false);
      expect(error).toBeNull();
      expect(count).toBe(0);
    },
  );

  it("chaque activité écrite par le chargeur de fixtures est présente et marquée simulation", async () => {
    // The dataset itself only contains simulated history.
    expect(FIXTURE_ACTIVITIES.length).toBeGreaterThan(0);
    expect(FIXTURE_ACTIVITIES.every((activity) => activity.is_simulation === true)).toBe(true);

    const { data, error } = await admin
      .from("activities")
      .select("id, agency_id, contact_id, type, actor_type, is_simulation")
      .in("id", FIXTURE_ACTIVITIES.map((activity) => activity.id!));
    expect(error).toBeNull();
    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    for (const expected of FIXTURE_ACTIVITIES) {
      const row = byId.get(expected.id!);
      expect(row, `activité de fixture manquante : ${expected.type} (${expected.id})`).toBeDefined();
      expect(row).toEqual({
        id: expected.id,
        agency_id: expected.agency_id,
        contact_id: expected.contact_id ?? null,
        type: expected.type,
        actor_type: expected.actor_type,
        is_simulation: true,
      });
    }
  });

  it("dans activities, seules des décisions humaines internes connues sont réelles (jamais un agent IA, jamais un envoi)", async () => {
    const { data, error } = await admin
      .from("activities")
      .select("id, type, contact_id, actor_type, actor_agent, actor_user_id, payload")
      .in("agency_id", AGENCY_IDS)
      .eq("is_simulation", false);
    expect(error).toBeNull();

    for (const activity of data ?? []) {
      const where = `activité « ${activity.type} » (${activity.id})`;
      // A human really did act: not an agent, and not "the system".
      expect(REAL_ACTIVITY_TYPES, `${where} : type inattendu`).toContain(activity.type);
      expect(activity.actor_type, `${where} : auteur non humain`).toBe("user");
      expect(activity.actor_agent, `${where} : un agent IA en est l'auteur`).toBeNull();
      expect(activity.actor_user_id, `${where} : aucun humain identifié`).not.toBeNull();

      if (REAL_ACTIVITY_SCOPE[activity.type as RealActivityType] === "agency") {
        // Agency-level configuration: nothing real targets a fictitious person.
        expect(activity.contact_id, `${where} : rattachée à un contact`).toBeNull();
      } else {
        // One contact's pipeline move, with its before/after stages.
        expect(activity.contact_id, `${where} : sans contact`).not.toBeNull();
        const payload = activity.payload as Record<string, unknown>;
        expect(PIPELINE_STAGES, `${where} : étape d'origine`).toContain(payload.previous_stage);
        expect(PIPELINE_STAGES, `${where} : étape d'arrivée`).toContain(payload.stage);
        expect(payload.stage, `${where} : aucun changement d'étape`).not.toBe(payload.previous_stage);
      }
    }
  });
});

describe("fixtures : volumes attendus", () => {
  it("25 contacts de fixtures pour l'agence A, 5 pour l'agence B", async () => {
    // Counted by their deterministic identifiers: another suite or an E2E
    // journey may legitimately add a contact to a fixture agency (public
    // estimation form + Léa) without the fixtures being wrong.
    expect(DATASET.a.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.a.contacts);
    expect(DATASET.b.contacts).toHaveLength(FIXTURE_EXPECTED_COUNTS.b.contacts);
    const countFor = async (agencyId: string, ids: string[]) => {
      const { count, error } = await admin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .in("id", ids);
      expect(error).toBeNull();
      return count;
    };
    expect(await countFor(FIXTURE_AGENCY_IDS.a, DATASET.a.contacts.map((contact) => contact.id!))).toBe(
      FIXTURE_EXPECTED_COUNTS.a.contacts,
    );
    expect(await countFor(FIXTURE_AGENCY_IDS.b, DATASET.b.contacts.map((contact) => contact.id!))).toBe(
      FIXTURE_EXPECTED_COUNTS.b.contacts,
    );
  });

  it("toutes les étapes du pipeline sont représentées dans l'agence A", async () => {
    const { data, error } = await admin.from("contacts").select("stage").eq("agency_id", FIXTURE_AGENCY_IDS.a);
    expect(error).toBeNull();
    const stages = new Set((data ?? []).map((contact) => contact.stage));
    expect([...stages].sort()).toEqual(
      ["chaud", "estimation_faite", "mandat_signe", "nouveau", "perdu", "qualifie", "rdv_planifie"],
    );
  });

  it("des biens, des rendez-vous passés et à venir, des messages et des tâches", async () => {
    expect((await rows("properties", "id")).length).toBeGreaterThanOrEqual(20);

    const appointments = await rows("appointments", "id, status, starts_at");
    const now = Date.now();
    expect(appointments.some((a) => new Date(a.starts_at as string).getTime() > now)).toBe(true);
    expect(appointments.some((a) => new Date(a.starts_at as string).getTime() < now)).toBe(true);
    const statuses = new Set(appointments.map((a) => a.status));
    expect(statuses).toContain("proposed");
    expect(statuses).toContain("confirmed");
    expect(statuses).toContain("done");

    const messages = await rows("outbound_messages", "id, status");
    expect(messages.filter((m) => m.status === "pending_validation").length).toBeGreaterThanOrEqual(1);
    expect(messages.filter((m) => m.status === "sent_simulated").length).toBeGreaterThanOrEqual(1);

    const tasks = await rows("tasks", "id, status, type");
    expect(tasks.filter((t) => t.status === "open").length).toBeGreaterThanOrEqual(5);
    expect(tasks.some((t) => t.type === "missing_information")).toBe(true);
    expect(tasks.some((t) => t.status === "done")).toBe(true);

    const runs = await rows("ai_agent_runs", "id, status, provider");
    expect(runs.length).toBeGreaterThanOrEqual(4);
    expect(runs.every((run) => run.provider === "simulator")).toBe(true);
    expect(runs.some((run) => run.status === "failed")).toBe(true);
  });
});

describe("fixtures : registre des consentements", () => {
  it("contient des consentements accordés, retirés, et des contacts sans aucun consentement", async () => {
    const consents = await rows("consents", "id, contact_id, channel, status, presented_text, text_version, proof");
    expect(consents.filter((c) => c.status === "granted").length).toBeGreaterThanOrEqual(1);
    expect(consents.filter((c) => c.status === "withdrawn").length).toBeGreaterThanOrEqual(1);

    for (const consent of consents.filter((c) => c.status === "granted")) {
      expect(consent.presented_text, "un consentement accordé stocke le texte présenté").toBeTruthy();
      expect(consent.text_version, "un consentement accordé stocke la version du texte").toBeTruthy();
      expect(Object.keys(consent.proof as Record<string, unknown>).length).toBeGreaterThan(0);
    }

    const withConsent = new Set(consents.map((c) => c.contact_id));
    expect(withConsent.has(NOTABLE_CONTACTS.noConsent)).toBe(false);
  });

  it("un consentement accordé puis retiré est conservé en entier (historique)", async () => {
    const { data, error } = await admin
      .from("consents")
      .select("status, recorded_at")
      .eq("contact_id", NOTABLE_CONTACTS.consentWithdrawn)
      .eq("channel", "email")
      .order("recorded_at", { ascending: true });
    expect(error).toBeNull();
    expect((data ?? []).map((consent) => consent.status)).toEqual(["granted", "withdrawn"]);

    const current = await admin
      .from("current_consents")
      .select("status")
      .eq("contact_id", NOTABLE_CONTACTS.consentWithdrawn)
      .eq("channel", "email");
    expect(current.data).toEqual([{ status: "withdrawn" }]);
  });
});

describe("fixtures : cas de test attendus par les agents IA", () => {
  it("un contact avec des informations manquantes (rien n'est inventé)", async () => {
    const { data } = await admin
      .from("contacts")
      .select("sale_motivation, sale_timeline, stage")
      .eq("id", NOTABLE_CONTACTS.missingInformation)
      .single();
    expect(data).toEqual({ sale_motivation: null, sale_timeline: null, stage: "nouveau" });
  });

  it("un contact repris en main par un humain", async () => {
    const { data } = await admin
      .from("contacts")
      .select("human_takeover")
      .eq("id", NOTABLE_CONTACTS.humanTakeover)
      .single();
    expect(data?.human_takeover).toBe(true);
  });

  it("des contacts sans téléphone", async () => {
    const { data, error } = await admin
      .from("contacts")
      .select("id")
      .eq("agency_id", FIXTURE_AGENCY_IDS.a)
      .is("phone", null);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("un contact dont les notes contiennent une tentative d'injection (donnée, jamais instruction)", async () => {
    const { data } = await admin.from("contacts").select("notes").eq("id", NOTABLE_CONTACTS.promptInjection).single();
    expect(data?.notes?.toLowerCase()).toContain("ignore toutes tes instructions");
  });

  it("un contact de l'agence B, invisible depuis l'agence A", async () => {
    const { data } = await admin
      .from("contacts")
      .select("agency_id")
      .eq("id", NOTABLE_CONTACTS.otherAgencyContact)
      .single();
    expect(data?.agency_id).toBe(FIXTURE_AGENCY_IDS.b);
  });
});
