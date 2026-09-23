/**
 * Settings domain — read implementation of the read-only `/parametres` screen.
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts`, a
 * real session in the integration tests): RLS always applies, the service_role
 * client is never used here.
 *
 * Contract (docs/plans/2026-09-23-complete-demo.md, milestone 4):
 *   * invalid session or no agency → the whole call is `{ data: null, error }`;
 *   * otherwise each section is read independently: one that fails is
 *     `{ status: "unavailable" }` (detail logged server-side), the others stay;
 *   * the agency is the one resolved server-side (`resolveAgentContext`),
 *     never a value from the browser. The member list RPC re-checks it.
 */

import { z } from "zod";

import { findAiPausedState } from "@/features/agents-ia/data";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected, failWith } from "@/lib/agents/errors";
import type { TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import type {
  AgencySettings,
  SettingsAgencyProfile,
  SettingsIntegration,
  SettingsKillSwitch,
  SettingsMember,
  SettingsSection,
} from "./types";

/**
 * Planned integrations, all simulated / not connected in the prototype.
 * Static on purpose: no provider account, adapter or credential exists yet.
 */
export const SETTINGS_INTEGRATIONS: readonly SettingsIntegration[] = [
  { key: "hektor", name: "Hektor", category: "real_estate_software", status: "simulation", connected: false, simulates: null },
  { key: "apimo", name: "Apimo", category: "real_estate_software", status: "simulation", connected: false, simulates: null },
  { key: "netty", name: "Netty", category: "real_estate_software", status: "simulation", connected: false, simulates: null },
  {
    key: "whatsapp_business",
    name: "WhatsApp Business",
    category: "messaging",
    status: "simulation",
    connected: false,
    simulates: "outbound_messages",
  },
  { key: "sms", name: "SMS", category: "messaging", status: "simulation", connected: false, simulates: "outbound_messages" },
  {
    key: "google_calendar",
    name: "Google Agenda",
    category: "calendar",
    status: "simulation",
    connected: false,
    simulates: "appointments",
  },
  { key: "outlook", name: "Outlook", category: "calendar", status: "simulation", connected: false, simulates: "appointments" },
];

/** PostgREST spells UTC as "+00:00"; the UI gets one stable format. */
function isoUtc(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

/**
 * Exactly the four columns the RPC may return. `.strict()`: an unexpected
 * extra column (e.g. a future change leaking `phone` or metadata) makes the
 * section unavailable instead of silently passing through.
 */
const memberRowSchema = z
  .object({
    user_id: z.uuid(),
    email: z.string().nullable(),
    role: z.enum(["agent", "director"]),
    created_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  })
  .strict();

const memberRowsSchema = z.array(memberRowSchema);

/** Runs one section; an error result or an exception becomes `unavailable`. */
async function section<T>(label: string, compute: () => Promise<Result<T>>): Promise<SettingsSection<T>> {
  try {
    const result = await compute();
    if (result.error) return { status: "unavailable" };
    return { status: "ok", value: result.data };
  } catch (cause) {
    console.error(`[settings] ${label} threw:`, cause);
    return { status: "unavailable" };
  }
}

/**
 * Everything the `/parametres` screen displays, for the caller's agency.
 * Read-only: this function never writes.
 */
export async function buildAgencySettings(client: TypedClient): Promise<Result<AgencySettings>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const { agencyId, userId, role } = contextResult.data;

    // One read of the agency row serves the profile and the daily limit; the
    // kill switch is read on its own (findAiPausedState) so that it stays
    // usable even when this read fails.
    const agencyRow: Promise<Result<{ profile: SettingsAgencyProfile; dailyRunLimit: number }>> = (async () => {
      const { data, error } = await client
        .from("agencies")
        .select("name, city, sector, ai_daily_run_limit")
        .eq("id", agencyId)
        .maybeSingle();
      if (error) return failFromDatabase("settings.agency", error);
      if (!data) return failWith("forbidden");
      return ok({
        profile: { name: data.name, city: data.city, sector: data.sector },
        dailyRunLimit: data.ai_daily_run_limit,
      });
    })();
    // Never an unhandled rejection: both sections await it through `section`.
    agencyRow.catch(() => undefined);

    const agency = section("agency", async () => {
      const row = await agencyRow;
      return row.error ? { data: null, error: row.error } : ok(row.data.profile);
    });

    const dailyRunLimit = section("dailyRunLimit", async () => {
      const row = await agencyRow;
      return row.error ? { data: null, error: row.error } : ok(row.data.dailyRunLimit);
    });

    const killSwitch = section("killSwitch", async (): Promise<Result<SettingsKillSwitch>> => {
      const state = await findAiPausedState(client);
      if (state.error) return { data: null, error: state.error };
      return ok({ aiPaused: state.data.aiPaused, canResume: state.data.canResume });
    });

    const members = section("members", async (): Promise<Result<SettingsMember[]>> => {
      const { data, error } = await client.rpc("list_agency_members", { target_agency: agencyId });
      if (error) return failFromDatabase("settings.members", error);
      const parsed = memberRowsSchema.safeParse(data);
      if (!parsed.success) {
        console.error("[settings] members: unexpected RPC payload shape");
        return failWith("unexpected_error");
      }
      return ok(
        parsed.data.map((row) => ({
          userId: row.user_id,
          email: row.email,
          role: row.role,
          memberSince: isoUtc(row.created_at),
          isCurrentUser: row.user_id === userId,
        })),
      );
    });

    const [agencyValue, dailyRunLimitValue, killSwitchValue, membersValue] = await Promise.all([
      agency,
      dailyRunLimit,
      killSwitch,
      members,
    ]);

    return ok({
      agencyId,
      viewer: { userId, role },
      agency: agencyValue,
      members: membersValue,
      agents: { killSwitch: killSwitchValue, dailyRunLimit: dailyRunLimitValue },
      integrations: SETTINGS_INTEGRATIONS.map((integration) => ({ ...integration })),
      retention: { status: "undefined" },
    });
  } catch (cause) {
    return failFromUnexpected<AgencySettings>("buildAgencySettings", cause);
  }
}
