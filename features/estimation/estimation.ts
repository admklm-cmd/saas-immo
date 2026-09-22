/**
 * Public estimation request — core logic, independent of `next/headers`.
 *
 * Split from `actions.ts` the same way every agent splits its orchestration
 * (`features/agents-ia/<agent>/<agent>.ts`) from its thin `"use server"`
 * wrapper: this function takes an already-built Supabase client and the
 * client IP / user agent already read from the request headers, so it can be
 * exercised directly by integration tests against the local database,
 * without a Next.js request context (`headers()` only works inside one).
 *
 * It owns the IP hashing (see `ip-hash.ts`) on purpose: the salt is validated
 * here, before the first write, so "no credible salt ⇒ nothing is stored" is
 * enforced in the very function that writes, and can be proven by counting
 * rows in the integration tests.
 *
 * This is the visitor-facing half of Léa's front door
 * (`features/agents-ia/lea-acquisition/`): it writes the `inbound_leads` row
 * and the consents actually given, and nothing else. It never creates a
 * contact and never decides anything Léa is responsible for.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok, type Result } from "@/lib/utils/result";
import type { Database } from "@/types/database";

import { hashClientIp, ipHashSaltLogMessage, resolveIpHashSalt } from "./ip-hash";
import {
  ESTIMATION_ERROR_MESSAGES,
  estimationRequestSchema,
  PROPERTY_TYPE_CHOICE_TO_ENUM,
  type EstimationErrorCode,
  type EstimationRequestInput,
  type EstimationRequestResult,
} from "./types";

export type TypedClient = SupabaseClient<Database>;

type SubmitEstimationRequestArgs = Database["public"]["Functions"]["submit_estimation_request"]["Args"];

export type EstimationRequestMeta = {
  /**
   * Raw client IP, resolved from the request headers by `actions.ts`. It is
   * hashed here (salted SHA-256) and NEVER stored, logged or returned as is.
   */
  clientIp: string;
  /** Bounded, truncated by the caller. */
  userAgent: string;
};

/** Maps the database's stable exception messages to a safe French result. */
export function mapEstimationDatabaseError(message: string | undefined): EstimationErrorCode {
  const text = (message ?? "").trim();
  if (text === "estimation_rate_limited") return "rate_limited";
  if (text === "estimation_request_invalid") return "validation_failed";
  // Raised by `private.guard_inbound_lead_text()` (migration 20260923090000):
  // a control character or a line break inside an identity field. zod already
  // refuses it, so only a direct RPC caller can reach this — same generic
  // answer as any other invalid submission.
  if (text === "inbound_lead_unsafe_text") return "validation_failed";
  // "estimation_agency_unavailable" and anything unexpected: generic message,
  // no technical detail returned to the visitor.
  return "unavailable";
}

export async function submitEstimationRequestForClient(
  client: TypedClient,
  input: EstimationRequestInput,
  meta: EstimationRequestMeta,
): Promise<Result<EstimationRequestResult>> {
  // FIRST, before anything that could write: without a credible
  // `ESTIMATION_IP_HASH_SALT` we refuse the whole request. A misconfigured
  // server must never end up storing a lead, a consent or a rate-limit row
  // whose IP hash is reversible — and there is no fallback salt on purpose
  // (see ip-hash.ts). The visitor only gets the generic "unavailable"
  // message: naming the variable, or even hinting that a secret is missing,
  // would be free reconnaissance for an attacker.
  const saltResolution = resolveIpHashSalt();
  if (!saltResolution.ok) {
    console.error(ipHashSaltLogMessage(saltResolution.problem));
    return fail<EstimationRequestResult>("unavailable", ESTIMATION_ERROR_MESSAGES.unavailable);
  }

  const parsed = estimationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail<EstimationRequestResult>("validation_failed", ESTIMATION_ERROR_MESSAGES.validation_failed);
  }
  const data = parsed.data;

  // Honeypot: rejected exactly like a validation failure (see the migration
  // for why), so this response never tells a script it was caught.
  if (data.website.trim().length > 0) {
    return fail<EstimationRequestResult>("validation_failed", ESTIMATION_ERROR_MESSAGES.validation_failed);
  }

  if (!meta.clientIp) {
    return fail<EstimationRequestResult>("validation_failed", ESTIMATION_ERROR_MESSAGES.validation_failed);
  }

  const ipHash = hashClientIp(meta.clientIp, saltResolution.salt);

  // The generated `Database` types cannot express that these SQL parameters
  // are NULLABLE (Postgres function argument metadata has no such concept),
  // so this is a deliberate, narrow cast: at runtime these are ordinary SQL
  // NULLs, exactly like every other nullable text column in this schema.
  const args = {
    p_first_name: data.firstName,
    p_last_name: data.lastName,
    p_email: data.email,
    p_phone: data.phone,
    p_property_type: PROPERTY_TYPE_CHOICE_TO_ENUM[data.propertyType],
    p_city: data.city,
    p_postal_code: data.postalCode,
    p_surface_m2: data.surfaceM2,
    p_rooms: data.rooms,
    p_message: data.message,
    p_consent_email: data.consents.email,
    p_consent_sms: data.consents.sms,
    p_consent_whatsapp: data.consents.whatsapp,
    p_consent_phone: data.consents.phone,
    p_ip_hash: ipHash,
    p_user_agent: meta.userAgent,
    p_website: data.website,
  } as unknown as SubmitEstimationRequestArgs;

  const { error } = await client.rpc("submit_estimation_request", args);

  if (error) {
    console.error(`[estimation] submit_estimation_request failed (${error.code ?? "?"}): ${error.message}`);
    const code = mapEstimationDatabaseError(error.message);
    return fail<EstimationRequestResult>(code, ESTIMATION_ERROR_MESSAGES[code]);
  }

  return ok<EstimationRequestResult>({ status: "received" });
}
