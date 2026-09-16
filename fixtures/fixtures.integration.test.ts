import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

import { assertLocalSupabaseUrl, assertNotProduction } from "../lib/supabase/local-only";
import { FIXTURE_EXPECTED_COUNTS, NOTABLE_CONTACTS } from "./dataset";
import { FIXTURE_AGENCY_IDS, FIXTURE_EMAIL_DOMAIN, FIXTURE_PHONE_PATTERN, FIXTURE_USERS } from "./fixture-ids";

/**
 * Proves that the loaded fixtures are, and stay, 100 % synthetic:
 * reserved e-mail domain, Arcep fiction phone blocks, "(fictive)" agency names,
 * everything flagged as simulated, and the expected volumes.
 *
 * Fails loudly (with the command to run) if the local stack is unreachable or
 * if the fixtures have not been loaded.
 */

const CONTEXT = "Fixtures check";
const AGENCY_IDS = [FIXTURE_AGENCY_IDS.a, FIXTURE_AGENCY_IDS.b];

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
    const { data, error } = await admin.from("agencies").select("name");
    expect(error).toBeNull();
    for (const agency of data ?? []) {
      expect(agency.name, `agence « ${agency.name} »`).toContain("(fictive)");
    }
  });

  it("tous les emails de contact utilisent le domaine réservé @example.test", async () => {
    const { data, error } = await admin.from("contacts").select("id, email");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const contact of data ?? []) {
      if (contact.email !== null) {
        expect(contact.email.endsWith(`@${FIXTURE_EMAIL_DOMAIN}`), `email « ${contact.email} »`).toBe(true);
      }
    }
  });

  it("tous les téléphones sont dans les tranches de fiction de l'Arcep", async () => {
    const { data, error } = await admin.from("contacts").select("id, phone");
    expect(error).toBeNull();
    const phones = (data ?? []).map((contact) => contact.phone).filter((phone): phone is string => phone !== null);
    expect(phones.length).toBeGreaterThan(0);
    for (const phone of phones) {
      expect(FIXTURE_PHONE_PATTERN.test(phone), `téléphone « ${phone} »`).toBe(true);
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

  it.each(["appointments", "outbound_messages", "activities", "ai_agent_runs"] as const)(
    "aucune ligne réelle (is_simulation = false) dans %s",
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
});

describe("fixtures : volumes attendus", () => {
  it("25 contacts pour l'agence A, 5 pour l'agence B", async () => {
    const countFor = async (agencyId: string) => {
      const { count, error } = await admin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId);
      expect(error).toBeNull();
      return count;
    };
    expect(await countFor(FIXTURE_AGENCY_IDS.a)).toBe(FIXTURE_EXPECTED_COUNTS.a.contacts);
    expect(await countFor(FIXTURE_AGENCY_IDS.b)).toBe(FIXTURE_EXPECTED_COUNTS.b.contacts);
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
