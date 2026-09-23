import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { runLeaAcquisition } from "@/features/agents-ia/lea-acquisition/lea";
import { FIXTURE_CONTACT_IDS } from "@/fixtures/dataset";
import { FIXTURE_AGENCY_IDS, FIXTURE_EMAIL_DOMAIN } from "@/fixtures/fixture-ids";
import { assertLocalSupabaseUrl } from "@/lib/supabase/local-only";
import type { Database } from "@/types/database";

import {
  ESTIMATION_CONSENT_TEXTS,
  ESTIMATION_CONSENT_VERSION,
  type EstimationConsentChannel,
} from "./consent-texts";
import { mapEstimationDatabaseError, submitEstimationRequestForClient } from "./estimation";
import { ESTIMATION_ERROR_MESSAGES, type EstimationRequestInput } from "./types";

/**
 * Integration tests of the public estimation request against the LOCAL
 * Supabase stack — see `supabase/migrations/20260922120000_public_estimation_request.sql`.
 *
 * These tests call `submit_estimation_request` through the REAL `anon` role
 * (no session), exactly like an unauthenticated visitor, and also connect
 * directly to Postgres as a superuser (`pg`) for two things ordinary
 * supabase-js calls cannot do: (1) pre-seed the rate-limit table, which lives
 * in the `private` schema and is NOT reachable through the Data API at all
 * (see supabase/config.toml, `schemas = ["public", "graphql_public"]`), and
 * (2) force a genuine mid-function failure to PROVE atomicity, using a
 * session-local temporary trigger created and rolled back inside one
 * transaction — it never persists, even if this test crashed.
 *
 * Data footprint: the ONE successful end-to-end call below writes a real
 * `inbound_leads` row, and — once Léa (unmodified) processes it — a reconciled
 * `consents` row and an `activities` entry, under the fixture agency
 * "Calanques Immobilier (fictive)". The submission deliberately reuses an
 * EXISTING fixture contact's email (`sophie-marchand`) so Léa finds an EXACT
 * duplicate instead of creating a new contact: this keeps
 * `fixtures/fixtures.integration.test.ts`'s exact contact-count assertion for
 * agency A valid across repeated runs of this file. `consents`/`activities`
 * are append-only by design (CLAUDE.md — history is never erased), so the
 * reconciled consent and the duplicate-detection activity are NOT deleted;
 * everything else this file creates (the lead, the rate-limit rows, the
 * throwaway test accounts) is removed in `afterAll`.
 *
 * The consent-evidence block at the END of this file adds one submission per
 * consent channel (four today). Each leaves one permanent `consents` row with
 * `contact_id` null — append-only, and authorising no sending whatsoever —
 * while its lead and rate-limit row are deleted; every value it uses carries
 * `runId`, so repeated runs never collide with the rows they cannot erase.
 */

type TypedClient = SupabaseClient<Database>;

const LOCAL_PG_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Fixture contact "sophie-marchand" (agency A) — see fixtures/dataset.ts. */
const FIXTURE_RETURNING_CONTACT_EMAIL = `sophie.marchand@${FIXTURE_EMAIL_DOMAIN}`;
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

type RpcArgsOverrides = Partial<{
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  ipHash: string;
  userAgent: string;
  website: string;
  consentEmail: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
  consentPhone: boolean;
}>;

type SubmitEstimationRequestArgs = Database["public"]["Functions"]["submit_estimation_request"]["Args"];

/**
 * The generated `Database` types cannot express that several of these SQL
 * parameters are NULLABLE (Postgres function argument metadata has no such
 * concept) — same narrow, documented cast as `features/estimation/estimation.ts`.
 */
function buildArgs(overrides: RpcArgsOverrides = {}): SubmitEstimationRequestArgs {
  return {
    p_first_name: overrides.firstName ?? "Test",
    p_last_name: overrides.lastName ?? "Intégration Estimation",
    p_email: overrides.email ?? null,
    p_phone: overrides.phone ?? null,
    p_property_type: "apartment" as const,
    p_city: "La Ciotat",
    p_postal_code: "13600",
    p_surface_m2: 55,
    p_rooms: 2,
    p_message: "Demande envoyée par les tests d'intégration (fictive).",
    p_consent_email: overrides.consentEmail ?? true,
    p_consent_sms: overrides.consentSms ?? false,
    p_consent_whatsapp: overrides.consentWhatsapp ?? false,
    p_consent_phone: overrides.consentPhone ?? false,
    p_ip_hash: overrides.ipHash ?? `ip-${randomBytes(6).toString("hex")}`,
    p_user_agent: overrides.userAgent ?? "vitest-integration",
    p_website: overrides.website ?? "",
  } as unknown as SubmitEstimationRequestArgs;
}

// Untyped view of a client, for calls the generated `Database` type cannot
// express (an unexposed schema, or a table nobody is granted access to).
const raw = (client: TypedClient): SupabaseClient => client as unknown as SupabaseClient;

let admin: TypedClient;
let anon: TypedClient;
let pg: PgClient;
let runId: string;

beforeAll(async () => {
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "features/estimation integration tests");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!publishableKey || !secretKey) {
    throw new Error("Integration tests: missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY.");
  }

  admin = createClient<Database>(url, secretKey, clientOptions);
  anon = createClient<Database>(url, publishableKey, clientOptions);
  pg = new PgClient({ connectionString: LOCAL_PG_URL });
  await pg.connect();
  runId = `est-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

  // Make both fixture agencies exist regardless of whether `npm run db:seed`
  // ran first (the estimation function ALWAYS targets the fixed id of
  // agency A — see private.estimation_target_agency() in the migration).
  const { error } = await admin
    .from("agencies")
    .upsert(
      [
        { id: FIXTURE_AGENCY_IDS.a, name: "Calanques Immobilier (fictive)", city: "La Ciotat" },
        { id: FIXTURE_AGENCY_IDS.b, name: "Agence Test Isolation (fictive)", city: "Marseille" },
      ],
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`Integration setup failed (agencies upsert): ${error.message}`);
});

afterAll(async () => {
  await pg.end();
});

// ---------------------------------------------------------------------------
// Rate limiting — enforced IN THE FUNCTION (private.estimation_submissions is
// unreachable through the Data API, so it is pre-seeded and cleaned up here
// directly over Postgres).
// ---------------------------------------------------------------------------
describe("limitation de débit", () => {
  it("refuse la n+1e soumission de la même empreinte IP dans la fenêtre de 10 minutes", async () => {
    const ipHash = `rl-ip-${runId}`;
    try {
      await pg.query(
        `insert into private.estimation_submissions (agency_id, ip_hash)
         select $1, $2 from generate_series(1, 3)`,
        [FIXTURE_AGENCY_IDS.a, ipHash],
      );

      const { error } = await anon.rpc(
        "submit_estimation_request",
        buildArgs({ ipHash, email: `rate-limit-ip-${runId}@example.test` }),
      );
      expect(error?.message).toBe("estimation_rate_limited");

      const { rows } = await pg.query(
        "select count(*)::int as count from public.inbound_leads where payload->>'email' = $1",
        [`rate-limit-ip-${runId}@example.test`],
      );
      expect(rows[0].count).toBe(0);
    } finally {
      await pg.query("delete from private.estimation_submissions where ip_hash = $1", [ipHash]);
    }
  });

  it("refuse la soumission suivante quand le plafond de l'agence est atteint, même avec une nouvelle empreinte IP", async () => {
    const marker = `rl-agency-${runId}`;
    try {
      await pg.query(
        `insert into private.estimation_submissions (agency_id, ip_hash)
         select $1, $2 || '-' || gs from generate_series(1, 30) gs`,
        [FIXTURE_AGENCY_IDS.a, marker],
      );

      const { error } = await anon.rpc(
        "submit_estimation_request",
        buildArgs({ ipHash: `${marker}-new`, email: `rate-limit-agency-${runId}@example.test` }),
      );
      expect(error?.message).toBe("estimation_rate_limited");
    } finally {
      await pg.query("delete from private.estimation_submissions where ip_hash like $1", [`${marker}%`]);
    }
  });
});

// ---------------------------------------------------------------------------
// Transactional atomicity — a real, forced mid-function failure.
// ---------------------------------------------------------------------------
describe("atomicité", () => {
  it("ne laisse aucun lead orphelin quand l'insertion d'un consentement échoue", async () => {
    const marker = `atomic-${runId}`;
    const email = `${marker}@example.test`;

    await pg.query("BEGIN");
    try {
      // A trigger scoped to THIS transaction only (transactional DDL: fully
      // undone by the final ROLLBACK below, even if this test crashed before
      // reaching it) that fails exactly the consents insert this call makes.
      await pg.query(
        `create or replace function pg_temp.force_consent_failure() returns trigger language plpgsql as $$
         begin raise exception 'forced_test_failure'; end $$;`,
      );
      // DDL does not support bind parameters (a `WHEN` clause is not a query
      // parameter placeholder): `marker` is our own test-generated hex
      // string, safely interpolated here.
      await pg.query(
        `create trigger force_consent_failure_once before insert on public.consents
         for each row when (new.proof ->> 'user_agent' = '${marker}')
         execute function pg_temp.force_consent_failure();`,
      );

      await pg.query("SAVEPOINT before_call");
      let threw = false;
      try {
        await pg.query(
          `select public.submit_estimation_request(
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
           )`,
          [
            "Test",
            "Atomicité",
            email,
            null,
            "apartment",
            "La Ciotat",
            "13600",
            55,
            2,
            "Test d'atomicité (fictif).",
            true,
            false,
            false,
            false,
            `ip-${marker}`,
            marker,
            "",
          ],
        );
      } catch {
        threw = true;
        await pg.query("ROLLBACK TO SAVEPOINT before_call");
      }
      expect(threw).toBe(true);

      const leads = await pg.query(
        "select count(*)::int as count from public.inbound_leads where payload ->> 'email' = $1",
        [email],
      );
      expect(leads.rows[0].count).toBe(0);

      const consents = await pg.query(
        "select count(*)::int as count from public.consents where proof ->> 'user_agent' = $1",
        [marker],
      );
      expect(consents.rows[0].count).toBe(0);
    } finally {
      await pg.query("ROLLBACK");
    }
  });
});

// ---------------------------------------------------------------------------
// Anonymous access: no direct read or write on the tables involved.
// ---------------------------------------------------------------------------
describe("accès anonyme direct", () => {
  it("ne peut pas lire inbound_leads, contacts ni consents", async () => {
    for (const table of ["inbound_leads", "contacts", "consents"] as const) {
      const { data, error } = await anon.from(table).select("id").limit(1);
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
  });

  it("ne peut pas écrire directement dans inbound_leads, contacts ni consents", async () => {
    const leadInsert = await anon
      .from("inbound_leads")
      .insert({ agency_id: FIXTURE_AGENCY_IDS.a, source: "manual_entry", raw_text: "Intrusion" });
    expect(leadInsert.error).not.toBeNull();

    const contactInsert = await anon
      .from("contacts")
      .insert({ agency_id: FIXTURE_AGENCY_IDS.a, source: "manual_entry", last_name: "Intrus" });
    expect(contactInsert.error).not.toBeNull();

    const consentInsert = await anon.from("consents").insert({
      agency_id: FIXTURE_AGENCY_IDS.a,
      channel: "email",
      status: "granted",
      source: "intrusion",
    });
    expect(consentInsert.error).not.toBeNull();
  });

  it("ne peut pas atteindre le schéma `private` (limitation de débit) du tout", async () => {
    const { error } = await raw(anon).schema("private").from("estimation_submissions").select("*").limit(1);
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Full path: public submission → correct agency → isolation → Léa.
// ---------------------------------------------------------------------------
describe("parcours complet", () => {
  // A KNOWN fixture contact's email on purpose: Léa must find her as an EXACT
  // duplicate and attach the lead to her EXISTING record instead of creating
  // a new one. This keeps `fixtures/fixtures.integration.test.ts`'s exact
  // contact count assertion for agency A meaningful and stable across runs
  // of this file (a `contact_created` outcome would add a permanent row —
  // consents/activities are append-only by design, see the file header, but
  // there is no reason to ALSO grow the contact count on every test run).
  const email = FIXTURE_RETURNING_CONTACT_EMAIL;
  let leadId: string | null = null;
  let agencyAUserId: string | null = null;
  let agencyAClient: TypedClient | null = null;
  let agencyBUserId: string | null = null;
  let agencyBClient: TypedClient | null = null;

  beforeAll(async () => {
    // Throwaway members: Léa is never called without a real session, and
    // isolation must be proven from a real member of the OTHER agency.
    const createMember = async (
      agencyId: string,
      label: string,
    ): Promise<{ id: string; client: TypedClient }> => {
      const userEmail = `${label}.${runId}@example.test`;
      const password = randomBytes(24).toString("base64url");
      const created = await admin.auth.admin.createUser({ email: userEmail, password, email_confirm: true });
      if (created.error || !created.data.user) {
        throw new Error(`Integration setup failed (${label}): ${created.error?.message ?? "no user"}`);
      }
      const membership = await admin
        .from("memberships")
        .insert({ agency_id: agencyId, user_id: created.data.user.id, role: "agent" });
      if (membership.error) throw new Error(`Integration setup failed (${label} membership): ${membership.error.message}`);

      const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, clientOptions);
      const signedIn = await client.auth.signInWithPassword({ email: userEmail, password });
      if (signedIn.error) throw new Error(`Integration setup failed (${label} sign-in): ${signedIn.error.message}`);
      return { id: created.data.user.id, client };
    };

    const a = await createMember(FIXTURE_AGENCY_IDS.a, "agent-a-estimation");
    agencyAUserId = a.id;
    agencyAClient = a.client;
    const b = await createMember(FIXTURE_AGENCY_IDS.b, "agent-b-estimation");
    agencyBUserId = b.id;
    agencyBClient = b.client;
  });

  afterAll(async () => {
    // The lead itself, and the rate-limit tracking row it created, can be
    // removed cleanly. The throwaway accounts are removed too (memberships
    // cascade). The reconciled consent and activity entry Léa adds to the
    // existing fixture contact below are real CRM/consent history — see the
    // file header — and are intentionally kept (append-only by design).
    if (leadId) await admin.from("inbound_leads").delete().eq("id", leadId);
    await pg.query("delete from private.estimation_submissions where ip_hash = $1", [`e2e-${runId}`]);
    for (const id of [agencyAUserId, agencyBUserId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  });

  it("un visiteur anonyme envoie une demande et reçoit un accusé de réception, sans aucun montant", async () => {
    const { data, error } = await anon.rpc(
      "submit_estimation_request",
      buildArgs({ email, ipHash: `e2e-${runId}` }),
    );
    expect(error).toBeNull();
    // `submit_estimation_request` returns void: nothing resembling a price
    // ever comes back to the visitor.
    expect(data).toBeNull();
  });

  it("le lead n'existe que dans l'agence configurée (Calanques Immobilier), au statut pending", async () => {
    const { data: recentLeads, error } = await admin
      .from("inbound_leads")
      .select("id, agency_id, status, source, payload")
      .eq("agency_id", FIXTURE_AGENCY_IDS.a)
      .order("created_at", { ascending: false })
      .limit(20);
    expect(error).toBeNull();
    const match = (recentLeads ?? []).find(
      (row) => (row.payload as Record<string, unknown> | null)?.email === email,
    );
    expect(match).toBeDefined();
    leadId = match!.id;
    expect(match!.status).toBe("pending");
    expect(match!.source).toBe("estimation_form");
  });

  it("l'agence B ne voit jamais ce lead", async () => {
    expect(leadId).not.toBeNull();
    const { data, error } = await agencyBClient!.from("inbound_leads").select("id").eq("id", leadId!);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("un consentement email a été enregistré avec le texte, la version et la preuve, sans contact rattaché", async () => {
    const { data, error } = await admin
      .from("consents")
      .select("channel, status, contact_id, presented_text, text_version, source, proof")
      .eq("agency_id", FIXTURE_AGENCY_IDS.a)
      .filter("proof->>lead_id", "eq", leadId!);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const consent = data![0]!;
    expect(consent.channel).toBe("email");
    expect(consent.status).toBe("granted");
    expect(consent.contact_id).toBeNull();
    expect(consent.text_version).toBe(ESTIMATION_CONSENT_VERSION);
    // Character-for-character: the register's evidence is worthless if it is
    // not EXACTLY what the visitor was shown (see the dedicated describe at
    // the end of this file, which covers every channel).
    expect(consent.presented_text).toBe(ESTIMATION_CONSENT_TEXTS.email);
    expect(consent.source).toBe("estimation_form");
    expect((consent.proof as Record<string, unknown>).ip_hash).toBe(`e2e-${runId}`);
  });

  it("Léa traite ce lead sans aucune modification de son code : elle retrouve la fiche existante et le consentement lui est rattaché", async () => {
    expect(agencyAClient).not.toBeNull();
    expect(leadId).not.toBeNull();
    const existingContactId = FIXTURE_CONTACT_IDS.a["sophie-marchand"]!;

    const result = await runLeaAcquisition(agencyAClient!, leadId!);
    expect(result.error).toBeNull();
    // Exact match on the email: Léa attaches the lead to the EXISTING
    // fixture contact rather than creating a second one for the same person.
    expect(result.data?.outcome).toBe("duplicate_found");
    expect(result.data?.duplicateContactId).toBe(existingContactId);
    expect(result.data?.contactId).toBeNull();

    const { data: consents, error } = await admin
      .from("consents")
      .select("channel, status, contact_id, proof")
      .eq("contact_id", existingContactId);
    expect(error).toBeNull();
    const reconciled = (consents ?? []).find(
      (row) => (row.proof as Record<string, unknown> | null)?.reconciled_from_lead_id === leadId,
    );
    expect(reconciled).toMatchObject({ channel: "email", status: "granted", contact_id: existingContactId });
  });
});

// ---------------------------------------------------------------------------
// Missing / weak `ESTIMATION_IP_HASH_SALT` — the whole request path must stop
// BEFORE writing anything.
//
// There is no hard-coded fallback salt (see `features/estimation/ip-hash.ts`):
// a committed default would be public and would make the stored IP hashes
// brute-forceable, so the anonymisation would be fake. What matters most here
// is not the error message but the ABSENCE of any row: these tests count the
// rows of the three tables the request path can write to — `inbound_leads`,
// `consents` and `private.estimation_submissions` (rate limiting, reachable
// only over a direct Postgres connection) — before and after the call.
//
// The successful case at the end removes the lead and the rate-limit row it
// creates; its consent row stays, because `consents` is append-only at
// database level (see the `finally` block).
// ---------------------------------------------------------------------------
describe("sel de hachage d'IP manquant ou trop court", () => {
  /** Test-only value, never a realistic secret; injected through process.env only. */
  const TEST_ONLY_IP_HASH_SALT = "test-only-estimation-ip-hash-salt-0000000000";

  type Counts = { leads: number; consents: number; submissions: number };

  /**
   * Counts the rows THIS call can create, in the three (and only three) tables
   * the request path writes to.
   *
   * Scoped by the call's own fingerprint rather than by a global `count(*)`:
   * Vitest runs test FILES in parallel, and other integration files legitimately
   * insert into `inbound_leads` / `consents` at the same time, which would make
   * a global before/after delta flaky. The scoping loses nothing:
   * `submit_estimation_request` copies the submitted email into
   * `inbound_leads.payload` and the user agent into `consents.proof`, so any row
   * this call created would necessarily match; and
   * `private.estimation_submissions` is written by this code path only (no other
   * test file touches it), so a `created_at` window is exact there.
   */
  async function countOwnRows(email: string, userAgent: string, since: Date): Promise<Counts> {
    const { rows } = await pg.query<Counts>(
      `select (select count(*)::int from public.inbound_leads
                where payload ->> 'email' = $1) as leads,
              (select count(*)::int from public.consents
                where proof ->> 'user_agent' = $2) as consents,
              (select count(*)::int from private.estimation_submissions
                where created_at >= $3) as submissions`,
      [email, userAgent, since],
    );
    return rows[0]!;
  }

  /** Database clock, so the window never depends on the test machine's clock skew. */
  async function databaseNow(): Promise<Date> {
    const { rows } = await pg.query<{ now: Date }>("select now() as now");
    return rows[0]!.now;
  }

  function input(email: string): EstimationRequestInput {
    return {
      firstName: "Test",
      lastName: "Sel Manquant",
      email,
      phone: null,
      propertyType: "appartement",
      city: "La Ciotat",
      postalCode: "13600",
      surfaceM2: 55,
      rooms: 2,
      message: "Demande envoyée par les tests d'intégration (fictive).",
      consents: { email: true, sms: false, whatsapp: false, phone: false },
      website: "",
    };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const refusedCases: ReadonlyArray<{ label: string; value: string | undefined }> = [
    { label: "absente", value: undefined },
    { label: "vide", value: "" },
    { label: "trop courte", value: "test-only-court" },
  ];

  for (const { label, value } of refusedCases) {
    it(`n'écrit RIEN en base quand la variable est ${label}`, async () => {
      vi.stubEnv("ESTIMATION_IP_HASH_SALT", value);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const email = `salt-${label.replace(/\s/g, "-")}-${runId}@example.test`;
      const userAgent = `vitest-salt-guard-${label.replace(/\s/g, "-")}-${runId}`;

      const since = await databaseNow();
      const before = await countOwnRows(email, userAgent, since);
      expect(before).toEqual({ leads: 0, consents: 0, submissions: 0 });

      const result = await submitEstimationRequestForClient(anon, input(email), {
        clientIp: "203.0.113.7",
        userAgent,
      });

      // THE assertion that matters: a misconfigured salt leaves not one row —
      // no request, no consent, no rate-limit entry.
      const after = await countOwnRows(email, userAgent, since);
      expect(after).toEqual({ leads: 0, consents: 0, submissions: 0 });
      expect(after).toEqual(before);

      // Controlled `{ data, error }`, generic French message, no leak.
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unavailable");
      expect(result.error?.message).toBe(ESTIMATION_ERROR_MESSAGES.unavailable);
      for (const forbidden of ["ESTIMATION_IP_HASH_SALT", "salt", "sel", "hash", "SHA-256", "variable"]) {
        expect(result.error?.message.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }

      // ... but the administrator does get an explicit server-side log.
      expect(consoleError).toHaveBeenCalled();
      expect(String(consoleError.mock.calls[0]?.[0])).toContain("ESTIMATION_IP_HASH_SALT");
    });
  }

  it("enregistre normalement la demande quand la variable est valide", async () => {
    // Run-specific salt: still a `test-only-` value, but it makes the expected
    // IP hash unique per run, so this test never collides with a row left by
    // an earlier run (`consents` cannot be deleted — see the `finally` block).
    const salt = `${TEST_ONLY_IP_HASH_SALT}-${runId}`;
    vi.stubEnv("ESTIMATION_IP_HASH_SALT", salt);
    const email = `salt-ok-${runId}@example.test`;
    const userAgent = `vitest-salt-ok-${runId}`;
    const clientIp = "203.0.113.207";
    const expectedIpHash = createHash("sha256").update(`${salt}:${clientIp}`).digest("hex");

    try {
      const since = await databaseNow();
      expect(await countOwnRows(email, userAgent, since)).toEqual({ leads: 0, consents: 0, submissions: 0 });

      const result = await submitEstimationRequestForClient(anon, input(email), { clientIp, userAgent });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "received" });

      const after = await countOwnRows(email, userAgent, since);
      expect(after.leads).toBe(1);
      expect(after.consents).toBe(1);
      expect(after.submissions).toBeGreaterThanOrEqual(1);

      // The raw IP never reaches the database: what is stored is exactly the
      // salted SHA-256, and no row anywhere contains the address itself.
      const stored = await pg.query<{ count: number }>(
        "select count(*)::int as count from private.estimation_submissions where ip_hash = $1",
        [expectedIpHash],
      );
      expect(stored.rows[0]!.count).toBe(1);
      const leaked = await pg.query<{ count: number }>(
        `select count(*)::int as count from private.estimation_submissions where ip_hash like $1
         union all select count(*)::int from public.consents where proof::text like $1`,
        [`%${clientIp}%`],
      );
      expect(leaked.rows.every((row) => row.count === 0)).toBe(true);
    } finally {
      // The lead and the rate-limit row are removed. The consent row is NOT:
      // `consents` is append-only at database level (trigger
      // `consents_append_only`, see the init migration) — consent history is
      // never erased, by design (CLAUDE.md), not even by a test. It stays with
      // `contact_id` null, which authorises no sending whatsoever.
      await pg.query("delete from public.inbound_leads where payload ->> 'email' = $1", [email]);
      await pg.query("delete from private.estimation_submissions where ip_hash = $1", [expectedIpHash]);
    }
  });
});

// ---------------------------------------------------------------------------
// Consent evidence: the text STORED must be, character for character, the text
// the visitor was SHOWN.
//
// CLAUDE.md requires the consent register to keep "the text presented" for
// each contact and each channel. That evidence only has legal value if it is
// exactly the wording displayed. Two sources of truth exist by design (see
// `features/estimation/consent-texts.ts` and `private.estimation_consent_text()`
// in supabase/migrations/20260922120000_public_estimation_request.sql): the TS
// constant is what the form renders (locked by `consent-texts.test.ts` and by
// the Playwright run), the SQL function is what gets written. `frontend-ux`
// locked display ↔ constant; these tests lock database ↔ constant, so a change
// on one side without the other can no longer pass silently.
//
// One real `anon` submission PER CHANNEL, iterating over the keys of
// `ESTIMATION_CONSENT_TEXTS` so a channel added later is covered
// automatically. Every value is made unique per run (`runId`): `consents` is
// append-only at database level (trigger `consents_append_only`), so the rows
// written here cannot be deleted and the test must not depend on their
// absence. The leads and the rate-limit rows ARE removed.
// ---------------------------------------------------------------------------
describe("preuve du consentement : texte enregistré en base", () => {
  const channels = Object.keys(ESTIMATION_CONSENT_TEXTS) as EstimationConsentChannel[];

  it("couvre tous les canaux du registre de consentement de la base", async () => {
    // Guards against the opposite drift: a channel existing in the database
    // enum but missing from the displayed texts (or the reverse).
    const { rows } = await pg.query<{ value: string }>(
      `select e.enumlabel as value
         from pg_type t join pg_enum e on e.enumtypid = t.oid
         join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'consent_channel'`,
    );
    expect(rows.map((row) => row.value).sort()).toEqual([...channels].sort());
  });

  for (const channel of channels) {
    it(`enregistre pour le canal « ${channel} » exactement le texte affiché, caractère par caractère`, async () => {
      const ipHash = `consent-text-${channel}-${runId}`;
      const email = `consent-text-${channel}-${runId}@example.test`;
      try {
        // Both coordinates are supplied so every channel is authorised by the
        // function's own coherence checks (email channel needs an email, the
        // three phone-based channels need a phone number).
        const { error } = await anon.rpc(
          "submit_estimation_request",
          buildArgs({
            email,
            // Arcep fiction block only (see fixtures/fixture-ids.ts).
            phone: "06 39 98 50 01",
            ipHash,
            consentEmail: channel === "email",
            consentSms: channel === "sms",
            consentWhatsapp: channel === "whatsapp",
            consentPhone: channel === "phone",
          }),
        );
        expect(error).toBeNull();

        const { rows } = await pg.query<{
          channel: string;
          presented_text: string;
          text_version: string;
          source: string;
          status: string;
        }>(
          `select channel::text as channel, presented_text, text_version, source::text as source,
                  status::text as status
             from public.consents
            where proof ->> 'ip_hash' = $1`,
          [ipHash],
        );

        // Exactly one row: only the CHECKED box creates a consent.
        expect(rows).toHaveLength(1);
        const stored = rows[0]!;
        expect(stored.channel).toBe(channel);
        expect(stored.status).toBe("granted");
        expect(stored.source).toBe("estimation_form");
        expect(stored.text_version).toBe(ESTIMATION_CONSENT_VERSION);

        // THE assertion of this file: strict equality with the text the
        // visitor actually saw. No `toContain`, no normalisation — a single
        // different character (accent, apostrophe, space) fails here.
        expect(stored.presented_text).toBe(ESTIMATION_CONSENT_TEXTS[channel]);
      } finally {
        // The lead and the rate-limit row go away; the consent row stays
        // (append-only by design, CLAUDE.md), which is why `ipHash` and
        // `email` carry `runId`: the next run writes its own rows.
        await pg.query("delete from public.inbound_leads where payload ->> 'email' = $1", [email]);
        await pg.query("delete from private.estimation_submissions where ip_hash = $1", [ipHash]);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Control characters, on the path an attacker actually uses.
//
// `public.submit_estimation_request` is granted to `anon`, so the zod schema in
// `features/estimation/types.ts` can be bypassed entirely by calling the RPC
// with the public publishable key. Until migration
// 20260923090000_inbound_lead_text_guard.sql, such a caller could store
// `first_name` = 'Jean\r\nBcc: …' verbatim — a value Léa copies into
// `contacts.first_name`, and which becomes an email header the day a real
// provider is connected (audit of 2026-09-23).
//
// These tests use the REAL `anon` client (no session) and check both halves:
// the call is refused, AND nothing at all is written.
// ---------------------------------------------------------------------------
describe("caractères de contrôle refusés par la base, même en appel direct", () => {
  async function countOwnRows(email: string, ipHash: string) {
    const { rows } = await pg.query<{ leads: number; consents: number; submissions: number }>(
      `select (select count(*)::int from public.inbound_leads where payload ->> 'email' = $1) as leads,
              (select count(*)::int from public.consents where proof ->> 'ip_hash' = $2) as consents,
              (select count(*)::int from private.estimation_submissions where ip_hash = $2) as submissions`,
      [email, ipHash],
    );
    return rows[0]!;
  }

  const refused: ReadonlyArray<{ label: string; overrides: RpcArgsOverrides }> = [
    { label: "un retour à la ligne dans le prénom (en-tête d'email glissé)", overrides: { firstName: "Jean\r\nBcc: attaquant@evil.test" } },
    { label: "une tabulation dans le nom", overrides: { lastName: "Dupont\tFaux" } },
    { label: "un octet ESC dans le prénom", overrides: { firstName: "Jean\u001bAudit" } },
  ];

  for (const [index, { label, overrides }] of refused.entries()) {
    it(`refuse ${label} et n'écrit rien`, async () => {
      const ipHash = `ctrl-${index}-${runId}`;
      const email = `ctrl-${index}-${runId}@example.test`;
      try {
        const { error } = await anon.rpc("submit_estimation_request", buildArgs({ ...overrides, email, ipHash }));

        expect(error).not.toBeNull();
        expect(error?.message).toContain("inbound_lead_unsafe_text");
        // Mapped to the ordinary validation message for the visitor: a direct
        // caller learns nothing about which guard caught them.
        expect(mapEstimationDatabaseError(error?.message)).toBe("validation_failed");

        expect(await countOwnRows(email, ipHash)).toEqual({ leads: 0, consents: 0, submissions: 0 });
      } finally {
        await pg.query("delete from public.inbound_leads where payload ->> 'email' = $1", [email]);
        await pg.query("delete from private.estimation_submissions where ip_hash = $1", [ipHash]);
      }
    });
  }

  it("accepte toujours un message multiligne ordinaire (le garde-fou ne casse pas le formulaire)", async () => {
    const ipHash = `ctrl-ok-${runId}`;
    const email = `ctrl-ok-${runId}@example.test`;
    const message = "Bonjour,\n\nMon appartement est au 3e étage.\n\tMerci d'avance.";
    try {
      const { error } = await anon.rpc("submit_estimation_request", buildArgs({ email, ipHash }));
      expect(error).toBeNull();

      // Same call with a genuinely multi-line free text: still accepted.
      const multiline = await anon.rpc(
        "submit_estimation_request",
        { ...buildArgs({ email, ipHash }), p_message: message } as never,
      );
      expect(multiline.error).toBeNull();

      const { rows } = await pg.query<{ raw_text: string }>(
        "select raw_text from public.inbound_leads where payload ->> 'email' = $1 order by created_at desc limit 1",
        [email],
      );
      expect(rows[0]?.raw_text).toBe(message);
    } finally {
      await pg.query("delete from public.inbound_leads where payload ->> 'email' = $1", [email]);
      await pg.query("delete from private.estimation_submissions where ip_hash = $1", [ipHash]);
    }
  });
});
