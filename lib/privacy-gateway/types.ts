/**
 * Shared types of the Privacy Gateway.
 *
 * The gateway is the ONLY way out of the application towards an external AI
 * provider (docs/audits/2026-10-10-backend-security-privacy-cloud.md, §3). An
 * external transport can only receive a `SanitizedAiRequest`, a branded type
 * that this module's `sanitize.ts` is the sole producer of.
 */

import type { AiGeneration, AiTaskName, AiUsage } from "@/lib/claude/provider";
import type { Result } from "@/lib/utils/result";

/** Kinds of identifier the gateway replaces by an ephemeral pseudonym. */
export const PSEUDONYM_TYPES = [
  "PERSONNE",
  "PRENOM",
  "NOM",
  "EMAIL",
  "TEL",
  "URL",
  "ADRESSE",
  "IBAN",
  "ID",
  "SECU",
  "CARTE",
  "AGENCE",
] as const;
export type PseudonymType = (typeof PSEUDONYM_TYPES)[number];

/** Number of identifiers replaced, per type (occurrences, never values). */
export type ReplacementCounts = Partial<Record<PseudonymType, number>>;

declare const sanitizedBrand: unique symbol;

/**
 * A request that went through the gateway: system prompt, user content and
 * nothing else. Every field was produced by `sanitizeAiRequest`; there is no
 * facts object, no raw prospect text and no privacy context left in it.
 */
export type SanitizedAiRequest = {
  readonly [sanitizedBrand]: true;
  readonly task: AiTaskName;
  readonly promptVersion: string;
  readonly attempt: number;
  /** Versioned system prompt + the gateway's fixed pseudonym notice. */
  readonly system: string;
  /** Rendered, pseudonymised user message (facts, choices, untrusted data). */
  readonly user: string;
};

/**
 * What an external AI vendor adapter looks like. It deliberately does NOT
 * implement `AiProvider`: its only input is a `SanitizedAiRequest`, so no code
 * path can hand it raw CRM data. `createPrivacyGatewayProvider` turns it into
 * an `AiProvider`.
 */
export interface ExternalAiTransport {
  readonly name: string;
  readonly model: string;
  complete(request: SanitizedAiRequest): Promise<Result<AiGeneration>>;
}

export type TransportUsage = AiUsage;
