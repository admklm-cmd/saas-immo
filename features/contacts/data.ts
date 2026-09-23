/**
 * Contacts domain — read implementations.
 *
 * These functions take an authenticated Supabase client so the same code can
 * be used by the server queries (`queries.ts`, session cookies) and by the
 * integration tests. They never throw: every failure comes back as
 * `{ data: null, error }` with a French message.
 */

import { z } from "zod";

import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected } from "@/lib/agents/errors";
import { AGENT_LABELS } from "@/lib/agents/messages";
import type { AgentContext, Enums, TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  APPOINTMENT_STATUS_LABELS,
  CONSENT_CHANNEL_LABELS,
  MESSAGE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  VALIDATOR_ROLE_LABELS,
  type ContactDetail,
  type ContactListItem,
  type ContactProperty,
  type MessageReviewMeta,
  type MessageReviewOutcome,
  type TimelineEntry,
  type ValidatorIdentity,
} from "./types";

const CONTACT_COLUMNS =
  "id, first_name, last_name, email, phone, source, stage, notes, sale_motivation, sale_timeline, human_takeover, assigned_user_id, created_at, updated_at";

const PROPERTY_COLUMNS = "id, contact_id, property_type, address, postal_code, city, sector, surface_m2, rooms";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NO_NAME_LABEL = "Contact sans nom";

function displayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter((part) => part && part.trim().length > 0).join(" ").trim();
  return name.length > 0 ? name : NO_NAME_LABEL;
}

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: ContactListItem["source"];
  stage: ContactListItem["stage"];
  notes: string | null;
  sale_motivation: string | null;
  sale_timeline: string | null;
  human_takeover: boolean;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type PropertyRow = ContactProperty & { contact_id: string };

function toListItem(
  row: ContactRow,
  property: ContactProperty | null,
  openTasksCount: number,
): ContactListItem {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: displayName(row.first_name, row.last_name),
    email: row.email,
    phone: row.phone,
    source: row.source,
    stage: row.stage,
    saleMotivation: row.sale_motivation,
    saleTimeline: row.sale_timeline,
    humanTakeover: row.human_takeover,
    assignedUserId: row.assigned_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    property,
    openTasksCount,
  };
}

/** All the contacts of the caller's agency, most recent first. */
export async function listContacts(client: TypedClient): Promise<Result<ContactListItem[]>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const contactsQuery = await client
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("agency_id", context.agencyId)
      .order("created_at", { ascending: false });

    if (contactsQuery.error) {
      return failFromDatabase<ContactListItem[]>("listContacts", contactsQuery.error);
    }
    const rows = (contactsQuery.data ?? []) as ContactRow[];
    if (rows.length === 0) return ok([]);

    const ids = rows.map((row) => row.id);

    const propertiesQuery = await client
      .from("properties")
      .select(PROPERTY_COLUMNS)
      .eq("agency_id", context.agencyId)
      .in("contact_id", ids);
    if (propertiesQuery.error) {
      return failFromDatabase<ContactListItem[]>("listContacts.properties", propertiesQuery.error);
    }

    const tasksQuery = await client
      .from("tasks")
      .select("id, contact_id")
      .eq("agency_id", context.agencyId)
      .eq("status", "open")
      .in("contact_id", ids);
    if (tasksQuery.error) {
      return failFromDatabase<ContactListItem[]>("listContacts.tasks", tasksQuery.error);
    }

    const propertyByContact = new Map<string, ContactProperty>();
    for (const property of (propertiesQuery.data ?? []) as PropertyRow[]) {
      if (!propertyByContact.has(property.contact_id)) {
        propertyByContact.set(property.contact_id, {
          id: property.id,
          property_type: property.property_type,
          address: property.address,
          postal_code: property.postal_code,
          city: property.city,
          sector: property.sector,
          surface_m2: property.surface_m2,
          rooms: property.rooms,
        });
      }
    }

    const openTasks = new Map<string, number>();
    for (const task of tasksQuery.data ?? []) {
      if (task.contact_id) openTasks.set(task.contact_id, (openTasks.get(task.contact_id) ?? 0) + 1);
    }

    return ok(
      rows.map((row) => toListItem(row, propertyByContact.get(row.id) ?? null, openTasks.get(row.id) ?? 0)),
    );
  } catch (cause) {
    return failFromUnexpected<ContactListItem[]>("listContacts", cause);
  }
}

/** One contact of the caller's agency. "Contact introuvable." otherwise. */
export async function findContactById(client: TypedClient, contactId: string): Promise<Result<ContactDetail>> {
  try {
    if (!UUID_PATTERN.test(contactId)) {
      return { data: null, error: { code: "contact_not_found", message: "Contact introuvable." } };
    }

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    const contactQuery = await client
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("agency_id", context.agencyId)
      .eq("id", contactId)
      .maybeSingle();

    if (contactQuery.error) {
      return failFromDatabase<ContactDetail>("findContactById", contactQuery.error);
    }
    if (!contactQuery.data) {
      return { data: null, error: { code: "contact_not_found", message: "Contact introuvable." } };
    }
    const row = contactQuery.data as ContactRow;

    const [propertiesQuery, consentsQuery, tasksQuery] = await Promise.all([
      client
        .from("properties")
        .select(PROPERTY_COLUMNS)
        .eq("agency_id", context.agencyId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true }),
      client
        .from("current_consents")
        .select("channel, status, text_version, source, recorded_at")
        .eq("agency_id", context.agencyId)
        .eq("contact_id", contactId),
      client
        .from("tasks")
        .select("id")
        .eq("agency_id", context.agencyId)
        .eq("contact_id", contactId)
        .eq("status", "open"),
    ]);

    if (propertiesQuery.error) return failFromDatabase<ContactDetail>("findContactById.properties", propertiesQuery.error);
    if (consentsQuery.error) return failFromDatabase<ContactDetail>("findContactById.consents", consentsQuery.error);
    if (tasksQuery.error) return failFromDatabase<ContactDetail>("findContactById.tasks", tasksQuery.error);

    const first = ((propertiesQuery.data ?? []) as PropertyRow[])[0] ?? null;
    const property: ContactProperty | null = first
      ? {
          id: first.id,
          property_type: first.property_type,
          address: first.address,
          postal_code: first.postal_code,
          city: first.city,
          sector: first.sector,
          surface_m2: first.surface_m2,
          rooms: first.rooms,
        }
      : null;

    const base = toListItem(row, property, (tasksQuery.data ?? []).length);

    return ok({
      ...base,
      notes: row.notes,
      consents: (consentsQuery.data ?? [])
        .filter((consent) => consent.channel !== null && consent.status !== null)
        .map((consent) => ({
          channel: consent.channel!,
          status: consent.status!,
          textVersion: consent.text_version,
          source: consent.source!,
          recordedAt: consent.recorded_at!,
        })),
    });
  } catch (cause) {
    return failFromUnexpected<ContactDetail>("findContactById", cause);
  }
}

const TIMELINE_LIMIT = 100;

/** Activity type written by `public.change_contact_stage` (human stage change). */
export const STAGE_CHANGE_ACTIVITY_TYPE = "contact_stage_changed";

function payloadString(payload: unknown, key: string): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** Membership roles `public.change_contact_stage` records as `actor_role`. */
export const STAGE_CHANGE_ACTOR_ROLES = ["agent", "director"] as const;
export type StageChangeActorRole = (typeof STAGE_CHANGE_ACTOR_ROLES)[number];

function payloadActorRole(payload: unknown): StageChangeActorRole | null {
  const value = payloadString(payload, "actor_role");
  return STAGE_CHANGE_ACTOR_ROLES.find((role) => role === value) ?? null;
}

/**
 * UI metadata of an activity. For a human stage change, the stages before and
 * after, the motive (exit from « Mandat signé ») and the role of the member who
 * made the change (`actor_role`: "agent" | "director", recorded by the database
 * at the time of the change) are exposed so the history can show them; the
 * summary already states them in French. Any other `actor_role` value is
 * `null`, never guessed.
 */
export function activityMeta(type: string, payload: unknown): TimelineEntry["meta"] {
  if (type !== STAGE_CHANGE_ACTIVITY_TYPE) return { type };
  return {
    type,
    previous_stage: payloadString(payload, "previous_stage"),
    stage: payloadString(payload, "stage"),
    reason: payloadString(payload, "reason"),
    actor_role: payloadActorRole(payload),
  };
}

type MessageReviewInput = {
  status: Enums["outbound_message_status"];
  validated_by: string | null;
  validated_at: string | null;
};

/**
 * Human review of an outbound message, for the timeline `meta`.
 *
 * `validated_at` and `validated_by_user_id` are the RAW columns stamped by the
 * database — nothing is deduced from `sent_at`, `created_at` or any other
 * event, and a null stays null (even on a sent message). The author label is
 * resolved only from `members` (current members of the caller's agency, from
 * `list_agency_members`); an id missing from it (member removed, read failed)
 * gives `null`, never a supposed author. The review outcome comes from the
 * status alone.
 */
export function messageReviewMeta(
  row: MessageReviewInput,
  members: ReadonlyMap<string, ValidatorIdentity>,
): MessageReviewMeta {
  const outcome: MessageReviewOutcome | null =
    row.status === "pending_validation" ? null : row.status === "rejected" ? "rejected" : "approved";
  const member = row.validated_by ? (members.get(row.validated_by) ?? null) : null;
  return {
    review_outcome: outcome,
    validated_at: row.validated_at,
    validated_by_user_id: row.validated_by,
    validated_by_email: member?.email ?? null,
    validated_by_label: member?.email ?? null,
    validated_by_role: member?.role ?? null,
    validated_by_role_label: member ? VALIDATOR_ROLE_LABELS[member.role] : null,
  };
}

/**
 * Exactly the four columns `public.list_agency_members` may return (same
 * contract as the settings screen). An unexpected shape resolves nobody.
 */
const validatorRowsSchema = z.array(
  z
    .object({
      user_id: z.uuid(),
      email: z.string().nullable(),
      role: z.enum(["agent", "director"]),
      created_at: z.string(),
    })
    .strict(),
);

/**
 * Current members of the caller's agency, by user id, to name the validators
 * of messages. Never fails the caller: a read error or an unexpected payload
 * is logged server-side and resolves nobody (every label then stays `null`).
 */
export async function readValidatorIdentities(
  client: TypedClient,
  agencyId: string,
): Promise<ReadonlyMap<string, ValidatorIdentity>> {
  const members = new Map<string, ValidatorIdentity>();
  try {
    const { data, error } = await client.rpc("list_agency_members", { target_agency: agencyId });
    if (error) {
      console.error(`[contacts] readValidatorIdentities failed (${error.code ?? "?"}): ${error.message}`);
      return members;
    }
    const parsed = validatorRowsSchema.safeParse(data);
    if (!parsed.success) {
      console.error("[contacts] readValidatorIdentities: unexpected RPC payload shape");
      return members;
    }
    for (const row of parsed.data) members.set(row.user_id, { email: row.email, role: row.role });
  } catch (cause) {
    console.error("[contacts] readValidatorIdentities threw:", cause);
  }
  return members;
}

/**
 * Merged history of a contact: CRM activities, appointments, outbound messages,
 * tasks and AI runs, most recent first. Simulated items keep their
 * `isSimulation` flag so the UI can badge them.
 */
export async function buildContactTimeline(
  client: TypedClient,
  contactId: string,
): Promise<Result<TimelineEntry[]>> {
  try {
    if (!UUID_PATTERN.test(contactId)) {
      return { data: null, error: { code: "contact_not_found", message: "Contact introuvable." } };
    }

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const context: AgentContext = contextResult.data;

    // The contact must belong to the caller's agency: same generic answer for
    // "unknown" and "other agency".
    const contactQuery = await client
      .from("contacts")
      .select("id")
      .eq("agency_id", context.agencyId)
      .eq("id", contactId)
      .maybeSingle();
    if (contactQuery.error) return failFromDatabase<TimelineEntry[]>("buildContactTimeline", contactQuery.error);
    if (!contactQuery.data) {
      return { data: null, error: { code: "contact_not_found", message: "Contact introuvable." } };
    }

    const [activities, appointments, messages, tasks, runs] = await Promise.all([
      client
          .from("activities")
          .select("id, type, summary, payload, actor_type, actor_agent, actor_user_id, is_simulation, occurred_at")
          .eq("agency_id", context.agencyId)
          .eq("contact_id", contactId)
          .order("occurred_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      client
          .from("appointments")
          .select("id, starts_at, ends_at, status, is_simulation, assigned_user_id")
          .eq("agency_id", context.agencyId)
          .eq("contact_id", contactId)
          .order("starts_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      client
          .from("outbound_messages")
          .select(
            "id, channel, subject, body, status, is_simulation, created_by_agent, created_at, sent_at, validated_by, validated_at",
          )
          .eq("agency_id", context.agencyId)
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      client
          .from("tasks")
          .select("id, type, title, details, status, created_by_agent, due_at, created_at, completed_at")
          .eq("agency_id", context.agencyId)
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      client
          .from("ai_agent_runs")
          .select(
            "id, agent, status, decision, error, provider, model, input_tokens, output_tokens, is_simulation, started_at, finished_at",
          )
          .eq("agency_id", context.agencyId)
          .eq("contact_id", contactId)
          .order("started_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
    ]);

    for (const [label, query] of [
      ["activities", activities],
      ["appointments", appointments],
      ["messages", messages],
      ["tasks", tasks],
      ["runs", runs],
    ] as const) {
      if (query.error) return failFromDatabase<TimelineEntry[]>(`buildContactTimeline.${label}`, query.error);
    }

    // Validators are named from the CURRENT members of the caller's agency
    // (`list_agency_members`, which re-checks membership). Read only when a
    // message has a validator; a failed read names nobody and never fails the
    // timeline — the history stays readable, the author is « non disponible ».
    const hasValidator = (messages.data ?? []).some((row) => row.validated_by !== null);
    const validators: ReadonlyMap<string, ValidatorIdentity> = hasValidator
      ? await readValidatorIdentities(client, context.agencyId)
      : new Map();

    const entries: TimelineEntry[] = [];

    for (const row of activities.data ?? []) {
      entries.push({
        id: row.id,
        kind: "activity",
        occurredAt: row.occurred_at,
        title: row.summary,
        description: null,
        isSimulation: row.is_simulation,
        actor: { type: row.actor_type, agent: row.actor_agent, userId: row.actor_user_id },
        status: null,
        meta: activityMeta(row.type, row.payload),
      });
    }

    for (const row of appointments.data ?? []) {
      entries.push({
        id: row.id,
        kind: "appointment",
        occurredAt: row.starts_at,
        title: `Rendez-vous d'estimation — ${APPOINTMENT_STATUS_LABELS[row.status]}`,
        description: null,
        isSimulation: row.is_simulation,
        actor: { type: "system", agent: null, userId: row.assigned_user_id },
        status: row.status,
        meta: { starts_at: row.starts_at, ends_at: row.ends_at },
      });
    }

    for (const row of messages.data ?? []) {
      entries.push({
        id: row.id,
        kind: "message",
        occurredAt: row.sent_at ?? row.created_at,
        title: `${CONSENT_CHANNEL_LABELS[row.channel]} — ${MESSAGE_STATUS_LABELS[row.status]}${
          row.subject ? ` — ${row.subject}` : ""
        }`,
        description: row.body.length > 280 ? `${row.body.slice(0, 280)}…` : row.body,
        isSimulation: row.is_simulation,
        actor: row.created_by_agent
          ? { type: "ai_agent", agent: row.created_by_agent, userId: null }
          : { type: "system", agent: null, userId: null },
        status: row.status,
        meta: {
          channel: row.channel,
          agent: row.created_by_agent ? AGENT_LABELS[row.created_by_agent] : null,
          ...messageReviewMeta(row, validators),
        },
      });
    }

    for (const row of tasks.data ?? []) {
      entries.push({
        id: row.id,
        kind: "task",
        occurredAt: row.created_at,
        title: `${row.title} — ${TASK_STATUS_LABELS[row.status]}`,
        description: row.details,
        // A task is an internal to-do: nothing is sent, nothing is simulated.
        isSimulation: false,
        actor: row.created_by_agent
          ? { type: "ai_agent", agent: row.created_by_agent, userId: null }
          : { type: "system", agent: null, userId: null },
        status: row.status,
        meta: { type: row.type, due_at: row.due_at, completed_at: row.completed_at },
      });
    }

    for (const row of runs.data ?? []) {
      entries.push({
        id: row.id,
        kind: "ai_run",
        occurredAt: row.started_at,
        title: `${AGENT_LABELS[row.agent]} — ${row.decision ?? row.error ?? "exécution"}`,
        description: null,
        isSimulation: row.is_simulation,
        actor: { type: "ai_agent", agent: row.agent, userId: null },
        status: row.status,
        meta: {
          provider: row.provider,
          model: row.model,
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
          finished_at: row.finished_at,
        },
      });
    }

    entries.sort((left, right) => {
      const delta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
      return delta !== 0 ? delta : left.id.localeCompare(right.id);
    });

    return ok(entries);
  } catch (cause) {
    return failFromUnexpected<TimelineEntry[]>("buildContactTimeline", cause);
  }
}
