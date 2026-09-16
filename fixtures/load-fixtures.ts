/**
 * Loads the fictitious fixtures into the LOCAL Supabase stack.
 *
 *   npm run db:seed          # load (or reload) the fixtures
 *   npm run db:reset         # supabase db reset --local, then load the fixtures
 *   npm run db:reset:clean   # reset only, empty database
 *
 * Safety rules (see CLAUDE.md):
 *  - the secret key is used here because this is exactly the restricted server
 *    task it exists for (local fixtures loader), never a user request path;
 *  - the script refuses to run against anything but the local Supabase URL and
 *    refuses to run with NODE_ENV=production;
 *  - no password is hard-coded: either an environment variable provides it, or
 *    a strong one is generated and written to fixtures/.generated-credentials.json
 *    (git-ignored, file mode 0600);
 *  - the script is idempotent: it deletes the two fixture agencies (fixed
 *    identifiers) and their auth users first, then reloads everything.
 *
 * Idempotence and append-only tables: `consents` and `activities` refuse UPDATE
 * and DELETE, even for the service role. The only accepted deletion is the
 * cascade from deleting the whole agency, which is exactly what the cleanup
 * does — so nothing in the schema is weakened for the sake of the fixtures.
 */

import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { assertLocalSupabaseUrl, assertNotProduction } from "../lib/supabase/local-only";
import { buildFixtures, type FixtureDataset } from "./dataset";
import { FIXTURE_AGENCY_IDS, FIXTURE_USERS, type FixtureUser } from "./fixture-ids";

const CONTEXT = "Fixtures loader";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(HERE, ".generated-credentials.json");

type TypedClient = SupabaseClient<Database>;

function loadEnvFiles(): void {
  // `process.loadEnvFile` never overwrites an already-defined variable, so the
  // precedence is: shell environment > .env.local > .env (same as Next.js).
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(HERE, "..", file));
    } catch {
      // Missing file: the variables may already come from the shell.
    }
  }
}

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${CONTEXT}: missing ${name} (see .env.example, values from \`npx supabase status\`).`);
  }
  return value;
}

function resolvePassword(user: FixtureUser): { password: string; generated: boolean } {
  const fromEnv = process.env[user.passwordEnvVar];
  if (fromEnv && fromEnv.length >= 12) {
    return { password: fromEnv, generated: false };
  }
  return { password: randomBytes(24).toString("base64url"), generated: true };
}

function fail(step: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`${CONTEXT}: ${step} failed — ${error.message}`);
  }
}

async function cleanup(admin: TypedClient): Promise<void> {
  const agencyIds = Object.values(FIXTURE_AGENCY_IDS);
  // Deleting the agency cascades to every business table (including the
  // append-only ones, whose guard accepts a cascade from account closure).
  const { error } = await admin.from("agencies").delete().in("id", agencyIds);
  fail("cleanup agencies", error);

  // Then the auth users (memberships are already gone with the agencies).
  const byId = new Set(FIXTURE_USERS.map((user) => user.id));
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  fail("cleanup listUsers", listed.error);
  const fixtureEmails = new Set(FIXTURE_USERS.map((user) => user.email));
  for (const user of listed.data?.users ?? []) {
    if (user.email && fixtureEmails.has(user.email)) byId.add(user.id);
  }
  for (const id of byId) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError && !/not.?found/i.test(deleteError.message)) {
      fail(`cleanup deleteUser ${id}`, deleteError);
    }
  }
}

async function createUsers(admin: TypedClient): Promise<
  { user: FixtureUser; password: string; generated: boolean }[]
> {
  const created: { user: FixtureUser; password: string; generated: boolean }[] = [];
  for (const user of FIXTURE_USERS) {
    const { password, generated } = resolvePassword(user);
    const result = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { label: user.label, fixture: true },
    });
    fail(`createUser ${user.email}`, result.error);
    if (result.data.user?.id !== user.id) {
      throw new Error(`${CONTEXT}: unexpected id for ${user.email}.`);
    }
    created.push({ user, password, generated });
  }
  return created;
}

async function insertAgency(admin: TypedClient, dataset: FixtureDataset): Promise<void> {
  const label = `agency ${dataset.key.toUpperCase()}`;

  fail(`${label} agency`, (await admin.from("agencies").insert(dataset.agency)).error);

  const memberships = FIXTURE_USERS.filter((user) => user.agency === dataset.key).map((user) => ({
    agency_id: dataset.agency.id!,
    user_id: user.id,
    role: user.role,
  }));
  fail(`${label} memberships`, (await admin.from("memberships").insert(memberships)).error);

  fail(`${label} contacts`, (await admin.from("contacts").insert(dataset.contacts)).error);
  fail(`${label} properties`, (await admin.from("properties").insert(dataset.properties)).error);
  // Consents before messages: the database checks the consent at (simulated) send time.
  fail(`${label} consents`, (await admin.from("consents").insert(dataset.consents)).error);
  fail(`${label} appointments`, (await admin.from("appointments").insert(dataset.appointments)).error);
  fail(`${label} outbound_messages`, (await admin.from("outbound_messages").insert(dataset.outboundMessages)).error);
  fail(`${label} tasks`, (await admin.from("tasks").insert(dataset.tasks)).error);
  fail(`${label} activities`, (await admin.from("activities").insert(dataset.activities)).error);

  // AI runs are journaled in two steps, as the database guard requires:
  // a run starts as `running`, then it is closed.
  for (const run of dataset.aiAgentRuns) {
    fail(`${label} ai_agent_runs insert`, (await admin.from("ai_agent_runs").insert(run.insert)).error);
    if (run.finish) {
      fail(
        `${label} ai_agent_runs finish`,
        (await admin.from("ai_agent_runs").update(run.finish).eq("id", run.insert.id!)).error,
      );
    }
  }
}

function summarise(dataset: FixtureDataset): Record<string, number> {
  return {
    contacts: dataset.contacts.length,
    properties: dataset.properties.length,
    consents: dataset.consents.length,
    appointments: dataset.appointments.length,
    outbound_messages: dataset.outboundMessages.length,
    tasks: dataset.tasks.length,
    activities: dataset.activities.length,
    ai_agent_runs: dataset.aiAgentRuns.length,
  };
}

async function main(): Promise<void> {
  loadEnvFiles();
  assertNotProduction(CONTEXT);
  const url = assertLocalSupabaseUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), CONTEXT);
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");

  const admin = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`${CONTEXT}: target ${url} (local only).`);

  await cleanup(admin);
  const users = await createUsers(admin);

  const { a, b } = buildFixtures(new Date());
  await insertAgency(admin, a);
  await insertAgency(admin, b);

  const credentials = {
    warning:
      "Comptes de démonstration du Supabase LOCAL uniquement. Données 100 % fictives. Ne jamais committer ce fichier.",
    generatedAt: new Date().toISOString(),
    supabaseUrl: url,
    users: users.map(({ user, password, generated }) => ({
      key: user.key,
      label: user.label,
      email: user.email,
      password,
      passwordSource: generated ? `généré (définir ${user.passwordEnvVar} pour le fixer)` : user.passwordEnvVar,
      agencyId: FIXTURE_AGENCY_IDS[user.agency],
      role: user.role,
    })),
  };
  await writeFile(CREDENTIALS_PATH, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });

  console.log(`  Agence A « ${a.agency.name} » :`, summarise(a));
  console.log(`  Agence B « ${b.agency.name} » :`, summarise(b));
  console.log(`  Identifiants écrits dans ${CREDENTIALS_PATH} (ignoré par git).`);
  for (const { user, password, generated } of users) {
    console.log(`  - ${user.email} (${user.role}, agence ${user.agency.toUpperCase()}) : ${password}${generated ? "" : " (depuis l'environnement)"}`);
  }
  console.log(`${CONTEXT}: done.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
