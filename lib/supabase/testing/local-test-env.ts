import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { assertLocalSupabaseUrl, ALLOWED_LOCAL_SUPABASE_URLS } from "../local-only";

/**
 * Test environment for integration tests against the LOCAL Supabase stack.
 *
 * - Refuses to run against any URL other than the local API (never a hosted
 *   project), and fails loudly if the local stack is unreachable.
 * - Creates two fictitious agencies (A and B), three users with passwords
 *   generated at run time (never hard-coded), memberships and one row in every
 *   business table for each agency, all tagged with a unique run id.
 * - Real sessions are opened with the publishable key, so RLS applies.
 *
 * Teardown strategy: delete the two agencies with the admin client. Every
 * business table references `agencies` with ON DELETE CASCADE, and the
 * append-only guard on consents/activities accepts a DELETE only when the
 * parent agency no longer exists (account closure). Auth users are deleted
 * afterwards (memberships cascade). Nothing is weakened for production: no
 * test-only bypass exists in the schema.
 */

// Re-exported for convenience: the guard itself lives in ../local-only.ts and
// is shared with the fixtures loader (fixtures/load-fixtures.ts).
export { assertLocalSupabaseUrl, ALLOWED_LOCAL_SUPABASE_URLS };

export type TypedClient = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];

export type TestUser = {
  id: string;
  email: string;
  client: TypedClient;
};

export type AgencyRows = {
  agencyId: string;
  /** Membership of the agency's director (director-a / user-b). */
  directorMembershipId: string;
  directorUserId: string;
  /** Contact with a full history (property, consent, appointment, message, activity, AI run). */
  contactId: string;
  /** Contact without append-only history, so that it can be deleted. */
  deletableContactId: string;
  propertyId: string;
  consentId: string;
  appointmentId: string;
  outboundMessageId: string;
  activityId: string;
  aiAgentRunId: string;
  /** One recorded step of `aiAgentRunId` (append-only run journal). */
  aiAgentRunStepId: string;
  taskId: string;
  /** One raw incoming lead waiting for Léa. */
  inboundLeadId: string;
};

export type TestEnv = {
  runId: string;
  admin: TypedClient;
  anon: TypedClient;
  users: { directorA: TestUser; agentA: TestUser; userB: TestUser };
  agencyA: AgencyRows;
  agencyB: AgencyRows;
  cleanup: () => Promise<void>;
};

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SECRET_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Integration tests: missing ${name} (see .env.example, values from \`npx supabase status\`).`);
  }
  return value;
}

async function assertReachable(url: string, publishableKey: string): Promise<void> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (cause) {
    throw new Error(
      `Integration tests: local Supabase is unreachable at ${url}. Start it with \`npm run db:start\` and re-run.`,
      { cause },
    );
  }
}

function generatePassword(): string {
  return randomBytes(32).toString("base64url");
}

function unwrap<T>(step: string, result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`Integration setup failed (${step}): ${result.error?.message ?? "no data"}`);
  }
  return result.data;
}

export async function setupTestEnv(): Promise<TestEnv> {
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  await assertReachable(url, publishableKey);

  const admin = createClient<Database>(url, secretKey, clientOptions);
  const runId = `rls-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const createdUserIds: string[] = [];
  const createdAgencyIds: string[] = [];

  const cleanup = async (): Promise<void> => {
    const errors: string[] = [];

    // 1. Agencies first: cascades to every business table (see file header).
    if (createdAgencyIds.length > 0) {
      const { error } = await admin.from("agencies").delete().in("id", createdAgencyIds);
      if (error) errors.push(`agencies: ${error.message}`);
    }
    const { error: leftoverError } = await admin.from("agencies").delete().like("name", `%${runId}%`);
    if (leftoverError) errors.push(`agencies (by run id): ${leftoverError.message}`);

    // 2. Auth users (memberships already gone with the agencies).
    const userIds = new Set(createdUserIds);
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      errors.push(`listUsers: ${listError.message}`);
    } else {
      for (const user of listed.users) {
        if (user.email?.includes(runId)) userIds.add(user.id);
      }
    }
    for (const id of userIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) errors.push(`deleteUser: ${error.message}`);
    }

    if (errors.length > 0) {
      throw new Error(`Integration teardown incomplete for run ${runId}: ${errors.join(" | ")}`);
    }
  };

  try {
    const createUser = async (label: string): Promise<TestUser> => {
      const email = `${label}.${runId}@example.test`;
      const password = generatePassword();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) {
        throw new Error(`Integration setup failed (createUser ${label}): ${created.error?.message ?? "no user"}`);
      }
      createdUserIds.push(created.data.user.id);

      const client = createClient<Database>(url, publishableKey, clientOptions);
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) {
        throw new Error(`Integration setup failed (signIn ${label}): ${signedIn.error.message}`);
      }
      return { id: created.data.user.id, email, client };
    };

    const directorA = await createUser("director-a");
    const agentA = await createUser("agent-a");
    const userB = await createUser("user-b");

    const seedAgency = async (
      letter: "A" | "B",
      director: TestUser,
      extraMembers: TestUser[],
    ): Promise<AgencyRows> => {
      const agency = unwrap(
        `agency ${letter}`,
        await admin
          .from("agencies")
          .insert({ name: `Agence ${letter} ${runId} (fictive)`, city: "La Ciotat", sector: "Test isolation" })
          .select("id")
          .single(),
      );
      createdAgencyIds.push(agency.id);
      const agencyId = agency.id;

      const directorMembership = unwrap(
        `membership director ${letter}`,
        await admin
          .from("memberships")
          .insert({ agency_id: agencyId, user_id: director.id, role: "director" })
          .select("id")
          .single(),
      );
      for (const member of extraMembers) {
        unwrap(
          `membership agent ${letter}`,
          await admin
            .from("memberships")
            .insert({ agency_id: agencyId, user_id: member.id, role: "agent" })
            .select("id")
            .single(),
        );
      }

      const insertOne = async <T extends keyof Tables>(table: T, row: Tables[T]["Insert"]): Promise<string> => {
        const result = await admin
          .from(table)
          // Generic table name: supabase-js cannot narrow the row type here.
          .insert(row as never)
          .select("id")
          .single();
        return unwrap(`${table} ${letter}`, result as { data: { id: string } | null; error: { message: string } | null })
          .id;
      };

      const contactId = await insertOne("contacts", {
        agency_id: agencyId,
        first_name: "Test",
        last_name: `Contact ${letter}`,
        email: `contact-${letter.toLowerCase()}.${runId}@example.test`,
        source: "estimation_form",
        notes: "Donnée de test (fictive).",
      });
      const deletableContactId = await insertOne("contacts", {
        agency_id: agencyId,
        first_name: "Test",
        last_name: `Supprimable ${letter}`,
        source: "manual_entry",
      });
      const propertyId = await insertOne("properties", {
        agency_id: agencyId,
        contact_id: contactId,
        property_type: "house",
        city: "La Ciotat",
        postal_code: "13600",
        surface_m2: 95,
        rooms: 4,
      });
      const consentId = await insertOne("consents", {
        agency_id: agencyId,
        contact_id: contactId,
        channel: "email",
        status: "granted",
        presented_text: "J'accepte d'être recontacté par email (texte de test).",
        text_version: "test-v1",
        source: "estimation_form",
        proof: { form_id: `test-${runId}` },
      });
      const appointmentId = await insertOne("appointments", {
        agency_id: agencyId,
        contact_id: contactId,
        property_id: propertyId,
        assigned_user_id: director.id,
        starts_at: "2030-01-07T09:00:00Z",
        ends_at: "2030-01-07T10:00:00Z",
      });
      const outboundMessageId = await insertOne("outbound_messages", {
        agency_id: agencyId,
        contact_id: contactId,
        channel: "email",
        body: "Bonjour, ceci est un message de test (simulation).",
        created_by_agent: "louis",
        idempotency_key: `seed-${runId}-${letter}`,
      });
      const activityId = await insertOne("activities", {
        agency_id: agencyId,
        contact_id: contactId,
        type: "note_added",
        summary: "Activité de test",
        actor_type: "system",
        is_simulation: true,
      });
      const aiAgentRunId = await insertOne("ai_agent_runs", {
        agency_id: agencyId,
        agent: "hugo",
        contact_id: contactId,
      });
      const aiAgentRunStepId = await insertOne("ai_agent_run_steps", {
        agency_id: agencyId,
        run_id: aiAgentRunId,
        step_index: 0,
        phase: "guardrails",
        label: "Étape de test",
        status: "ok",
        // Real, past instants: the table refuses a step dated in the future.
        started_at: new Date(Date.now() - 2_000).toISOString(),
        finished_at: new Date(Date.now() - 1_000).toISOString(),
      });
      const taskId = await insertOne("tasks", {
        agency_id: agencyId,
        contact_id: contactId,
        type: "missing_information",
        title: "Tâche de test",
        created_by_agent: "hugo",
      });
      const inboundLeadId = await insertOne("inbound_leads", {
        agency_id: agencyId,
        source: "estimation_form",
        raw_text: "Demande de test (fictive).",
        payload: { form_id: `test-${runId}` },
      });

      return {
        agencyId,
        directorMembershipId: directorMembership.id,
        directorUserId: director.id,
        contactId,
        deletableContactId,
        propertyId,
        consentId,
        appointmentId,
        outboundMessageId,
        activityId,
        aiAgentRunId,
        aiAgentRunStepId,
        taskId,
        inboundLeadId,
      };
    };

    const agencyA = await seedAgency("A", directorA, [agentA]);
    const agencyB = await seedAgency("B", userB, []);

    const anon = createClient<Database>(url, publishableKey, clientOptions);

    return { runId, admin, anon, users: { directorA, agentA, userB }, agencyA, agencyB, cleanup };
  } catch (error) {
    await cleanup().catch((cleanupError: unknown) => {
      console.error(cleanupError);
    });
    throw error;
  }
}
