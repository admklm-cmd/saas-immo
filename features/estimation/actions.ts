"use server";

/**
 * Public estimation request (`/estimation`) — server action.
 *
 * The visitor is NOT signed in: this action never trusts an `agency_id` from
 * the browser (there is none in the input type) and never resolves the
 * target agency itself — that is done server-side, inside the database
 * function (`private.estimation_target_agency()`), which is also the one
 * source of truth for the guard rails (rate limiting, field bounds,
 * consent/coordinates coherence): `estimation.ts` revalidates with zod as a
 * first line of defence, but the database enforces everything again, because
 * its function is reachable directly with the public key.
 *
 * The visitor's IP address never reaches the browser and is never stored in
 * clear: `estimation.ts` turns it into a salted SHA-256 hash (see
 * `ip-hash.ts` — no fallback salt exists, a missing one aborts the request
 * before any write). See docs/security.md for the retention policy and what
 * this does and does not protect against.
 *
 * This file only resolves what needs `next/headers` (unavailable outside a
 * real request) and delegates to `estimation.ts`, which is what integration
 * tests exercise directly — same split as every agent's `actions.ts`.
 */

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { submitEstimationRequestForClient } from "./estimation";
import { resolveClientIp } from "./ip-hash";
import type { EstimationRequestInput, EstimationRequestResult } from "./types";

export async function submitEstimationRequest(
  input: EstimationRequestInput,
): Promise<Result<EstimationRequestResult>> {
  const headerList = await headers();
  const clientIp = resolveClientIp(headerList);
  const userAgent = (headerList.get("user-agent") ?? "").slice(0, 500);

  const client = await createClient();
  return submitEstimationRequestForClient(client, input, { clientIp, userAgent });
}
