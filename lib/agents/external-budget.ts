/**
 * Daily spending ceiling for EXTERNAL (paid) AI calls, per agency.
 *
 * It sits next to — and is stricter than — `agencies.ai_daily_run_limit`, which
 * counts every run, simulated or not. It is checked by the runner BEFORE the
 * run is opened, hence before any call, from runs already journaled in
 * `ai_agent_runs` (`is_simulation = false`): no new table.
 *
 * Unit: AI calls. A run makes at most `MAX_AI_ATTEMPTS` provider attempts (the
 * first one plus the bounded retry on an invalid answer), so the number of runs
 * allowed per day is `floor(limit / MAX_AI_ATTEMPTS)`: the ceiling holds even
 * if every run needs its retry. The SDK's own transport retries are bounded
 * separately (`AI_MAX_RETRIES`, lib/claude/anthropic.ts).
 */

import { MAX_AI_ATTEMPTS } from "./ai-task";

/** Prudent default: 100 calls a day = 50 runs for one agency. */
export const DEFAULT_EXTERNAL_DAILY_CALL_LIMIT = 100;
export const MAX_EXTERNAL_DAILY_CALL_LIMIT = 10_000;

/**
 * Reads `AI_EXTERNAL_DAILY_CALL_LIMIT`. Missing or invalid -> the prudent
 * default (never "unlimited"); `0` is valid and blocks every external call.
 */
export function readExternalDailyCallLimit(raw: string | undefined): number {
  const trimmed = (raw ?? "").trim();
  if (!/^\d{1,6}$/.test(trimmed)) return DEFAULT_EXTERNAL_DAILY_CALL_LIMIT;
  return Math.min(Number(trimmed), MAX_EXTERNAL_DAILY_CALL_LIMIT);
}

/** Number of external runs an agency may open per Paris day for that limit. */
export function externalRunsAllowedPerDay(callLimit: number): number {
  return Math.floor(callLimit / MAX_AI_ATTEMPTS);
}
