import "server-only";

/**
 * Contacts domain — reads exposed to the UI (Server Components).
 *
 * Each function builds the request-scoped Supabase client (session cookies,
 * RLS applies) and delegates to `data.ts`. The session and the `agency_id` are
 * always re-resolved server-side, never read from the browser.
 *
 * All of them return `{ data, error }`: no exception ever reaches the UI.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { buildContactTimeline, findContactById, listContacts } from "./data";
import type { ContactDetail, ContactListItem, TimelineEntry } from "./types";

/** All the contacts of the caller's agency, most recent first. */
export async function getContacts(): Promise<Result<ContactListItem[]>> {
  const client = await createClient();
  return listContacts(client);
}

/** One contact of the caller's agency, or "Contact introuvable.". */
export async function getContactById(id: string): Promise<Result<ContactDetail>> {
  const client = await createClient();
  return findContactById(client, id);
}

/** Merged history of a contact (activities, RDV, messages, tâches, runs IA). */
export async function getContactTimeline(id: string): Promise<Result<TimelineEntry[]>> {
  const client = await createClient();
  return buildContactTimeline(client, id);
}
