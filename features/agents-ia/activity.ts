/**
 * Pure assembly of the activity figures of the "Agents IA" screen.
 *
 * Nothing here touches the database: the aggregation itself is done in SQL
 * (`public.agent_activity_summary`, one exact count per agent and per window),
 * and this file only turns the rows into the shape the UI reads, with the
 * French labels attached.
 *
 * It is kept separate from `data.ts` so the rules that matter can be tested
 * without a database:
 *   * a figure that could not be read is an ERROR, never a zero;
 *   * an agent that never ran says "Jamais exécuté", it does not borrow the
 *     figures of another agent nor invent a date;
 *   * `runsTodayAgainstLimit` excludes the `blocked` attempts, exactly like the
 *     database guard that enforces the daily limit.
 */

import { z } from "zod";

import { failFromDatabase, failWith } from "@/lib/agents/errors";
import type { DatabaseErrorLike } from "@/lib/agents/errors";
import {
  AGENT_ACTIVITY_TEXTS,
  AGENT_ACTIVITY_WINDOW_DAYS,
  AGENT_LABELS,
  AGENT_MISSIONS,
  AGENT_ORDER,
  AGENT_RUN_STATUS_LABELS,
} from "@/lib/agents/messages";
import type { AiAgentName } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import type {
  AgentActivity,
  AgentActivityWindow,
  AgentOverview,
  AgentRunCounts,
  AgentRunError,
  AgentRunSummary,
} from "./types";

/** How many past failures the screen shows per agent. */
export const AGENT_LAST_ERRORS_LIMIT = 3;

/** One row of `public.agent_activity_summary`, as PostgREST returns it. */
export type AgentActivityRow = {
  agent_name: AiAgentName;
  today_total: number;
  today_succeeded: number;
  today_failed: number;
  today_blocked: number;
  today_running: number;
  today_input_tokens: number;
  today_output_tokens: number;
  window_total: number;
  window_succeeded: number;
  window_failed: number;
  window_blocked: number;
  window_running: number;
  window_input_tokens: number;
  window_output_tokens: number;
};

/**
 * A `count(*)` of Postgres is a bigint, which PostgREST may serialise as a
 * string. Either form is accepted; anything else (null, a missing key, a
 * negative number) makes the whole payload invalid rather than turning into a
 * zero — the one thing this screen must never display.
 */
const exactCount = z.union([
  z.int().min(0),
  z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value))
    .pipe(z.int().min(0)),
]);

const agentActivityRowSchema = z.object({
  // Deliberately NOT an enum of the five known agents: a sixth agent added to
  // the database enum must still be counted in the agency's daily volume.
  agent_name: z.string().min(1),
  today_total: exactCount,
  today_succeeded: exactCount,
  today_failed: exactCount,
  today_blocked: exactCount,
  today_running: exactCount,
  today_input_tokens: exactCount,
  today_output_tokens: exactCount,
  window_total: exactCount,
  window_succeeded: exactCount,
  window_failed: exactCount,
  window_blocked: exactCount,
  window_running: exactCount,
  window_input_tokens: exactCount,
  window_output_tokens: exactCount,
});

const agentActivityPayloadSchema = z.array(agentActivityRowSchema);

/**
 * Validates what `public.agent_activity_summary` returned before a single
 * figure is displayed.
 *
 * A payload that is not the expected shape means the figures are UNKNOWN. They
 * are reported as an error, never rendered as zeros: "0 exécution aujourd'hui"
 * is a statement about the product, and it must only ever be a measured one.
 */
export function parseAgentActivityRows(payload: unknown): Result<AgentActivityRow[]> {
  const parsed = agentActivityPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[agents] agent_activity_summary: unexpected payload shape");
    return failWith<AgentActivityRow[]>("unexpected_error");
  }
  return ok(parsed.data as AgentActivityRow[]);
}

/** Shape of a PostgREST `count: "exact", head: true` response. */
export type ExactCountResponse = {
  count: number | null;
  error: DatabaseErrorLike | null;
};

/**
 * Turns a PostgREST exact count into a number — or into an error.
 *
 * `count ?? 0` is the bug this function exists to make impossible: a count that
 * could not be made is UNKNOWN, and showing an unknown quantity as "0" tells
 * the agency "there is nothing waiting" when there may be a hundred drafts.
 */
export function requireExactCount(context: string, response: ExactCountResponse): Result<number> {
  if (response.error) return failFromDatabase<number>(context, response.error);
  if (typeof response.count !== "number" || !Number.isFinite(response.count)) {
    console.error(`[agents] ${context}: exact count missing from the response`);
    return failWith<number>("unexpected_error");
  }
  return ok(response.count);
}

export function emptyRunCounts(): AgentRunCounts {
  return { total: 0, succeeded: 0, failed: 0, blocked: 0, running: 0 };
}

export function emptyActivity(): AgentActivity {
  return { runs: emptyRunCounts(), tokens: { input: 0, output: 0 } };
}

/** Postgres `count()` comes back as a bigint; PostgREST may serialise it as a string. */
function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function todayActivity(row: AgentActivityRow): AgentActivity {
  return {
    runs: {
      total: toNumber(row.today_total),
      succeeded: toNumber(row.today_succeeded),
      failed: toNumber(row.today_failed),
      blocked: toNumber(row.today_blocked),
      running: toNumber(row.today_running),
    },
    tokens: {
      input: toNumber(row.today_input_tokens),
      output: toNumber(row.today_output_tokens),
    },
  };
}

function windowActivity(row: AgentActivityRow): AgentActivity {
  return {
    runs: {
      total: toNumber(row.window_total),
      succeeded: toNumber(row.window_succeeded),
      failed: toNumber(row.window_failed),
      blocked: toNumber(row.window_blocked),
      running: toNumber(row.window_running),
    },
    tokens: {
      input: toNumber(row.window_input_tokens),
      output: toNumber(row.window_output_tokens),
    },
  };
}

/**
 * Runs of the day that consume quota: every outcome except `blocked`.
 *
 * A refused attempt (kill switch, limit already reached, human takeover) is
 * journaled but costs nothing, and `private.guard_ai_agent_run` excludes it
 * from the limit. The screen must count it the same way, otherwise the number
 * shown next to "limite quotidienne" is not the number the limit applies to.
 */
export function runsAgainstLimit(counts: AgentRunCounts): number {
  return counts.total - counts.blocked;
}

/**
 * The runs of the current Paris day across EVERY agent of the agency.
 *
 * Summed over the rows as they come back from SQL, and NOT over the five known
 * agents: `private.guard_ai_agent_run` counts every run of the agency against
 * `ai_daily_run_limit`, whatever its `agent`. If a sixth agent were added to the
 * enum before this screen knew about it, counting only the five known ones would
 * quietly under-report the quota actually consumed.
 */
export function totalTodayRunCounts(rows: readonly AgentActivityRow[]): AgentRunCounts {
  return rows.reduce<AgentRunCounts>((totals, row) => {
    const counts = todayActivity(row).runs;
    return {
      total: totals.total + counts.total,
      succeeded: totals.succeeded + counts.succeeded,
      failed: totals.failed + counts.failed,
      blocked: totals.blocked + counts.blocked,
      running: totals.running + counts.running,
    };
  }, emptyRunCounts());
}

/** Names a window so the screen can never display a figure without its period. */
export function describeWindow(key: "today" | "last7Days", startsAt: Date): AgentActivityWindow {
  return key === "today"
    ? {
        key,
        label: AGENT_ACTIVITY_TEXTS.todayWindow,
        startsAt: startsAt.toISOString(),
        days: 1,
      }
    : {
        key,
        label: AGENT_ACTIVITY_TEXTS.last7DaysWindow,
        startsAt: startsAt.toISOString(),
        days: AGENT_ACTIVITY_WINDOW_DAYS,
      };
}

export type AgentOverviewsInput = {
  /** Agency kill switch: when on, no agent is active, whatever it did before. */
  aiPaused: boolean;
  /** One row per agent that has at least one run in the window. May be empty. */
  activity: readonly AgentActivityRow[];
  /** Most recent run per agent, read with a dedicated query. */
  lastRuns: ReadonlyMap<AiAgentName, AgentRunSummary | null>;
  /** Most recent failures per agent, most recent first. */
  lastErrors: ReadonlyMap<AiAgentName, readonly AgentRunError[]>;
};

/**
 * The five agents in the order of the seller's journey, always all five.
 *
 * An agent with no row in `activity` genuinely has no run in the window: it
 * shows zeros for that window — which is a measured zero, not a missing value —
 * and "Jamais exécuté" only when the dedicated `lastRun` query also found
 * nothing, whatever the window.
 */
export function buildAgentOverviews(input: AgentOverviewsInput): AgentOverview[] {
  const byAgent = new Map<AiAgentName, AgentActivityRow>();
  for (const row of input.activity) {
    if (AGENT_ORDER.includes(row.agent_name)) byAgent.set(row.agent_name, row);
  }

  return AGENT_ORDER.map((agent) => {
    const row = byAgent.get(agent);
    const today = row ? todayActivity(row) : emptyActivity();
    const last7Days = row ? windowActivity(row) : emptyActivity();
    const lastRun = input.lastRuns.get(agent) ?? null;

    return {
      agent,
      label: AGENT_LABELS[agent],
      mission: AGENT_MISSIONS[agent],
      isActive: !input.aiPaused,
      today,
      last7Days,
      runsTodayAgainstLimit: runsAgainstLimit(today.runs),
      lastRun,
      lastRunLabel: lastRun
        ? AGENT_RUN_STATUS_LABELS[lastRun.status]
        : AGENT_ACTIVITY_TEXTS.neverRan,
      lastErrors: [...(input.lastErrors.get(agent) ?? [])].slice(0, AGENT_LAST_ERRORS_LIMIT),
    } satisfies AgentOverview;
  });
}
