/**
 * Settings domain — types read by the read-only `/parametres` screen.
 *
 * Plan: docs/plans/2026-09-23-complete-demo.md, milestone 4. Decisions:
 *   * the screen is READ-ONLY: nothing here writes, and no setting can be
 *     changed from it — except the existing kill switch, whose action and
 *     rules are unchanged (`setAgencyAiPaused`: any member may pause, only a
 *     director may resume, enforced by `public.set_ai_paused`);
 *   * no data-retention period exists yet: `retention` says so explicitly
 *     (« Non définie — à valider avant mise en production »), no duration is
 *     invented;
 *   * no integration is connected: every integration is listed with the
 *     `simulation` status and `connected: false`; no key, token or secret is
 *     ever part of this type.
 *
 * Same principle as the dashboard: each section is computed on its own. A
 * section whose read failed is `{ status: "unavailable" }` (detail logged
 * server-side, never returned) and does not hide the others.
 */

import type { MembershipRole } from "@/lib/agents/types";

/** One independently computed section of the screen. */
export type SettingsSection<T> = { status: "ok"; value: T } | { status: "unavailable" };

/** « Agence » — from `public.agencies` (RLS: members only). */
export type SettingsAgencyProfile = {
  name: string;
  /** `null` when not filled in: display « Non renseigné », never a guess. */
  city: string | null;
  /** `null` when not filled in. */
  sector: string | null;
};

/**
 * « Équipe » — one member of the caller's agency, from the RPC
 * `public.list_agency_members` (migration 20260923130000). Exactly these
 * fields: no phone, no metadata, no sign-in history.
 */
export type SettingsMember = {
  userId: string;
  /** Sign-in e-mail. `null` only for an account without e-mail (not created by this product). */
  email: string | null;
  role: MembershipRole;
  /** Date the user joined the agency (membership creation), ISO-8601 UTC. */
  memberSince: string;
  /** True for the signed-in user: display « (vous) ». */
  isCurrentUser: boolean;
};

/** The kill switch, as `findAiPausedState` reads it (same values as the dashboard). */
export type SettingsKillSwitch = {
  /** When true, no AI agent can run. */
  aiPaused: boolean;
  /** Any member may pause; only a director may resume (enforced by the RPC). */
  canResume: boolean;
};

/**
 * « Agents IA ». Two sub-sections read separately, so the kill switch (the
 * agency's emergency control) stays usable even if the limit cannot be read.
 */
export type SettingsAgents = {
  killSwitch: SettingsSection<SettingsKillSwitch>;
  /** `agencies.ai_daily_run_limit`: max AI runs per Europe/Paris day. Read-only here. */
  dailyRunLimit: SettingsSection<number>;
};

export const SETTINGS_INTEGRATION_KEYS = [
  "hektor",
  "apimo",
  "netty",
  "whatsapp_business",
  "sms",
  "google_calendar",
  "outlook",
] as const;

export type SettingsIntegrationKey = (typeof SETTINGS_INTEGRATION_KEYS)[number];

export type SettingsIntegrationCategory = "real_estate_software" | "messaging" | "calendar";

/**
 * One planned integration. Static list: nothing is read from the database and
 * no credential exists or is returned.
 *
 *   * `status: "simulation"` and `connected: false` for every entry in the
 *     prototype (no adapter is implemented, no provider account exists).
 *   * `simulates` says what the prototype simulates in its place:
 *     `outbound_messages` (messages drafted and « sent » in simulation),
 *     `appointments` (appointments booked in simulation, no calendar written),
 *     or `null` when nothing is exchanged at all, not even simulated
 *     (real-estate software: no import, no export).
 */
export type SettingsIntegration = {
  key: SettingsIntegrationKey;
  /** Product or provider name (proper noun, not translated). */
  name: string;
  category: SettingsIntegrationCategory;
  status: "simulation";
  connected: false;
  simulates: "outbound_messages" | "appointments" | null;
};

/**
 * « Conservation des données ». No retention period has been decided: the UI
 * displays « Non définie — à valider avant mise en production ». When a period
 * is decided (with a lawyer), this type will gain a defined variant.
 */
export type SettingsRetention = { status: "undefined" };

/** The signed-in user, as resolved server-side. */
export type SettingsViewer = {
  userId: string;
  role: MembershipRole;
};

/** Everything the `/parametres` screen displays. */
export type AgencySettings = {
  agencyId: string;
  viewer: SettingsViewer;
  agency: SettingsSection<SettingsAgencyProfile>;
  members: SettingsSection<SettingsMember[]>;
  agents: SettingsAgents;
  /** Static, always present. */
  integrations: SettingsIntegration[];
  retention: SettingsRetention;
};
