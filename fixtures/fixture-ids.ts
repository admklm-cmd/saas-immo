import { createHash } from "node:crypto";

/**
 * Deterministic identifiers for the fictitious fixtures.
 *
 * Every fixture row gets its UUID from a stable label, so that:
 *  - reloading the fixtures always produces the same identifiers (E2E tests and
 *    documentation can link to a precise contact);
 *  - cleaning up is a matter of deleting two well-known agency identifiers.
 *
 * Bump FIXTURE_NAMESPACE to invalidate every identifier at once.
 */
export const FIXTURE_NAMESPACE = "aiaa-fixtures-v1";

export function fixtureUuid(label: string): string {
  const bytes = createHash("sha256").update(`${FIXTURE_NAMESPACE}:${label}`).digest().subarray(0, 16);
  const octets = Uint8Array.from(bytes);
  // RFC 4122 layout (version 4 / variant 10xx): the value stays deterministic,
  // it is only shaped like a random UUID.
  octets[6] = (octets[6]! & 0x0f) | 0x40;
  octets[8] = (octets[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(octets).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Both fictitious agencies. Everything else hangs off them (ON DELETE CASCADE). */
export const FIXTURE_AGENCY_IDS = {
  a: fixtureUuid("agency:calanques-immobilier"),
  b: fixtureUuid("agency:test-isolation"),
} as const;

/** Every fixture e-mail uses the reserved `.test` TLD (RFC 2606). */
export const FIXTURE_EMAIL_DOMAIN = "example.test";

/**
 * Phone numbers reserved by Arcep for audiovisual works (decision n° 2018-0881,
 * national numbering plan): six blocks of 10 000 numbers that can neither call
 * nor be called. We use the PACA landline block 04 65 71 XX XX and the mobile
 * block 06 39 98 XX XX.
 */
export const FIXTURE_PHONE_PREFIXES = { mobile: "06 39 98", landline: "04 65 71" } as const;

export function fictionMobile(last4: string): string {
  return `${FIXTURE_PHONE_PREFIXES.mobile} ${last4.slice(0, 2)} ${last4.slice(2, 4)}`;
}

export function fictionLandline(last4: string): string {
  return `${FIXTURE_PHONE_PREFIXES.landline} ${last4.slice(0, 2)} ${last4.slice(2, 4)}`;
}

/** A phone number is a fixture phone number only if it is in a fiction block. */
export const FIXTURE_PHONE_PATTERN = /^0(6 39 98|4 65 71) \d{2} \d{2}$/;

export type FixtureUserKey = "directorA" | "agentA" | "userB";

export type FixtureUser = {
  key: FixtureUserKey;
  id: string;
  email: string;
  /** Agency the user belongs to. */
  agency: "a" | "b";
  role: "director" | "agent";
  /** Optional environment variable holding the password (otherwise generated). */
  passwordEnvVar: string;
  label: string;
};

export const FIXTURE_USERS: readonly FixtureUser[] = [
  {
    key: "directorA",
    id: fixtureUuid("user:director-a"),
    email: `directrice.calanques@${FIXTURE_EMAIL_DOMAIN}`,
    agency: "a",
    role: "director",
    passwordEnvVar: "FIXTURES_PASSWORD_DIRECTOR_A",
    label: "Directrice — Calanques Immobilier (fictive)",
  },
  {
    key: "agentA",
    id: fixtureUuid("user:agent-a"),
    email: `agent.calanques@${FIXTURE_EMAIL_DOMAIN}`,
    agency: "a",
    role: "agent",
    passwordEnvVar: "FIXTURES_PASSWORD_AGENT_A",
    label: "Conseiller — Calanques Immobilier (fictive)",
  },
  {
    key: "userB",
    id: fixtureUuid("user:user-b"),
    email: `direction.isolation@${FIXTURE_EMAIL_DOMAIN}`,
    agency: "b",
    role: "director",
    passwordEnvVar: "FIXTURES_PASSWORD_USER_B",
    label: "Utilisateur — Agence Test Isolation (fictive)",
  },
] as const;

export const FIXTURE_USER_IDS = {
  directorA: FIXTURE_USERS[0]!.id,
  agentA: FIXTURE_USERS[1]!.id,
  userB: FIXTURE_USERS[2]!.id,
} as const;
