import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { listContacts } from "./data";

/**
 * The contacts list at volume, against the LOCAL Supabase stack with a real
 * session. With 350 contacts the properties and the open tasks used to be read
 * with a single `in (...)` carrying every id: the request URL exceeded the limit
 * from about 190 contacts and the whole screen failed. Now:
 *   * all contacts are listed (more than one page of 1000 is walked, no cut);
 *   * each contact keeps ITS property and ITS open-task count, across chunks;
 *   * agency B never leaks in.
 */

const VOLUME = 350;

let env: TestEnv;
let directorA: TypedClient;
let userB: TypedClient;
let baselineA = 0;
let baselineB = 0;

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;

  baselineA = (await listContacts(directorA)).data!.length;
  baselineB = (await listContacts(userB)).data!.length;

  const inserted = await env.admin
    .from("contacts")
    .insert(
      Array.from({ length: VOLUME }, (_, index) => ({
        agency_id: env.agencyA.agencyId,
        first_name: "Volume",
        last_name: `Test ${String(index).padStart(3, "0")}`,
        source: "manual_entry" as const,
        created_at: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
      })),
    )
    .select("id, last_name");
  if (inserted.error || !inserted.data) throw new Error(`volume contacts: ${inserted.error?.message}`);

  // Every contact has a property whose surface is its index; every third one an open task.
  const byName = new Map(inserted.data.map((row) => [row.last_name, row.id]));
  const properties = [...byName.entries()].map(([name, id]) => ({
    agency_id: env.agencyA.agencyId,
    contact_id: id,
    property_type: "apartment" as const,
    city: "La Ciotat",
    surface_m2: 20 + Number(String(name).slice(-3)),
  }));
  const propertiesResult = await env.admin.from("properties").insert(properties);
  if (propertiesResult.error) throw new Error(`volume properties: ${propertiesResult.error.message}`);

  const tasks = [...byName.entries()]
    .filter((_, index) => index % 3 === 0)
    .map(([, id]) => ({
      agency_id: env.agencyA.agencyId,
      contact_id: id,
      type: "call_back_seller",
      title: "Rappeler le vendeur",
    }));
  const tasksResult = await env.admin.from("tasks").insert(tasks);
  if (tasksResult.error) throw new Error(`volume tasks: ${tasksResult.error.message}`);
}, 120_000);

afterAll(async () => {
  await env?.cleanup();
});

describe("listContacts at volume (real session)", () => {
  it("lists every contact of the agency, beyond the length a single request URL can carry", async () => {
    const result = await listContacts(directorA);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(baselineA + VOLUME);
    expect(new Set(result.data!.map((contact) => contact.id)).size).toBe(baselineA + VOLUME);
  });

  it("keeps each contact's own property and open-task count across the chunks", async () => {
    const result = await listContacts(directorA);
    const volume = result.data!.filter((contact) => contact.firstName === "Volume");
    expect(volume).toHaveLength(VOLUME);
    for (const contact of volume) {
      const index = Number(String(contact.lastName).slice(-3));
      expect(contact.property?.surface_m2, contact.lastName ?? "").toBe(20 + index);
    }
    const withTask = volume.filter((contact) => contact.openTasksCount === 1).length;
    expect(withTask).toBe(Math.ceil(VOLUME / 3));
  });

  it("is ordered most recent first", async () => {
    const result = await listContacts(directorA);
    const dates = result.data!.map((contact) => Date.parse(contact.createdAt));
    for (let index = 1; index < dates.length; index += 1) expect(dates[index]!).toBeLessThanOrEqual(dates[index - 1]!);
  });

  it("does not leak agency B", async () => {
    const forB = await listContacts(userB);
    expect(forB.data).toHaveLength(baselineB);
    expect(forB.data!.some((contact) => contact.firstName === "Volume")).toBe(false);
  });

  it("refuses a request without session", async () => {
    const result = await listContacts(env.anon);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
