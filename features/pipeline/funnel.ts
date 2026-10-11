/**
 * Pipeline domain — conversion funnel (read implementation).
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts`, a
 * real session in the integration tests): RLS always applies, the service_role
 * client is never used here, and the agency is resolved server-side.
 *
 * How a step is counted ("reached at least this stage"):
 *   * a dossier that is still in the pipeline reached every stage up to the one
 *     it sits at (the journey is ordered; a skipped stage still counts as
 *     passed through) — exact counts made in the database;
 *   * a LOST dossier reached the furthest stage that its recorded history
 *     shows: the stages named in the stage-move activities
 *     (`previous_stage` / `stage`, see `STAGE_TRANSITION_ACTIVITY_TYPES`) and
 *     `rdv_planifie` when an appointment was confirmed. With no history it is
 *     counted at `nouveau` only and reported in `lost.untraced`: a lower
 *     bound, never an invented path.
 *
 * Any failure makes the WHOLE funnel an error: a funnel with a missing step
 * would be a wrong funnel. The UI shows « Indisponible », never zeros.
 */

import { requireExactCount } from "@/features/agents-ia/activity";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromUnexpected } from "@/lib/agents/errors";
import { fetchAllPages } from "@/lib/agents/paginate";
import type { PipelineStage, TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  FUNNEL_RDV_ACTIVITY_TYPE,
  PIPELINE_FUNNEL_STAGES,
  STAGE_TRANSITION_ACTIVITY_TYPES,
  type PipelineFunnel,
  type PipelineFunnelStage,
  type PipelineFunnelStep,
} from "./types";

/** Contacts per `in (...)` request: keeps the URL far below any proxy limit. */
const CONTACT_CHUNK = 100;

// -----------------------------------------------------------------------------
// Pure computation
// -----------------------------------------------------------------------------

function funnelRank(stage: unknown): number {
  return typeof stage === "string" ? PIPELINE_FUNNEL_STAGES.indexOf(stage as PipelineFunnelStage) : -1;
}

/** One recorded activity, as far as the funnel is concerned. */
export type FunnelActivity = { type: string; payload: unknown };

/**
 * Furthest stage of the journey that a dossier's recorded activities show.
 * `nouveau` when they show nothing (every dossier was a `nouveau` one day).
 * `perdu` and unknown values in a payload are ignored.
 */
export function furthestStageFromActivities(activities: readonly FunnelActivity[]): {
  stage: PipelineFunnelStage;
  traced: boolean;
} {
  let best = 0;
  let traced = false;
  for (const activity of activities) {
    if ((STAGE_TRANSITION_ACTIVITY_TYPES as readonly string[]).includes(activity.type)) {
      const payload =
        activity.payload && typeof activity.payload === "object" && !Array.isArray(activity.payload)
          ? (activity.payload as Record<string, unknown>)
          : {};
      for (const value of [payload.previous_stage, payload.stage]) {
        const rank = funnelRank(value);
        if (rank >= 0) {
          traced = true;
          best = Math.max(best, rank);
        }
      }
    } else if (activity.type === FUNNEL_RDV_ACTIVITY_TYPE) {
      traced = true;
      best = Math.max(best, PIPELINE_FUNNEL_STAGES.indexOf("rdv_planifie"));
    }
  }
  return { stage: PIPELINE_FUNNEL_STAGES[best]!, traced };
}

/**
 * Assembles the funnel from its inputs. Pure: no I/O, so every rule is unit
 * tested (decreasing counts, rates, lost dossiers, empty agency).
 */
export function computeFunnel(input: {
  at: string;
  /** Dossiers sitting at each stage of the journey right now (`perdu` excluded). */
  currentByStage: Readonly<Record<PipelineFunnelStage, number>>;
  /** For each lost dossier: the furthest stage its history shows, and whether it shows anything. */
  lost: readonly { furthest: PipelineFunnelStage; traced: boolean }[];
}): PipelineFunnel {
  const lostHere = Object.fromEntries(PIPELINE_FUNNEL_STAGES.map((stage) => [stage, 0])) as Record<
    PipelineFunnelStage,
    number
  >;
  for (const entry of input.lost) lostHere[entry.furthest] += 1;

  const reachedAt = (rank: number): number =>
    PIPELINE_FUNNEL_STAGES.slice(rank).reduce((sum, stage) => sum + input.currentByStage[stage] + lostHere[stage], 0);

  const start = reachedAt(0);
  let previousReached: number | null = null;
  const steps: PipelineFunnelStep[] = PIPELINE_FUNNEL_STAGES.map((stage, rank) => {
    const reached = reachedAt(rank);
    const step: PipelineFunnelStep = {
      stage,
      reached,
      current: input.currentByStage[stage],
      lostHere: lostHere[stage],
      rateFromPrevious: previousReached === null || previousReached === 0 ? null : reached / previousReached,
      rateFromStart: start === 0 ? null : reached / start,
    };
    previousReached = reached;
    return step;
  });

  return {
    scope: { key: "all_dossiers", at: input.at },
    total: start,
    steps,
    lost: { total: input.lost.length, untraced: input.lost.filter((entry) => !entry.traced).length },
  };
}

// -----------------------------------------------------------------------------
// Read
// -----------------------------------------------------------------------------

type ActivityRow = { contact_id: string | null; type: string; payload: unknown };

/**
 * The conversion funnel of the caller's agency. `now` is injectable for tests.
 *
 * Cost: 6 exact counts (indexed by `contacts_agency_id_stage_idx`), the ids of
 * the lost dossiers, and their stage-move activities in chunks of 100 contacts
 * (indexed by `activities_agency_id_contact_id_occurred_at_idx`). It scales with
 * the number of LOST dossiers, not with the whole history of the agency.
 */
export async function buildPipelineFunnel(client: TypedClient, now: Date = new Date()): Promise<Result<PipelineFunnel>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const agencyId = contextResult.data.agencyId;

    const [counts, lostContacts] = await Promise.all([
      Promise.all(
        PIPELINE_FUNNEL_STAGES.map(async (stage) => ({
          stage,
          count: requireExactCount(
            `pipelineFunnel.count.${stage}`,
            await client
              .from("contacts")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("stage", stage),
          ),
        })),
      ),
      fetchAllPages<{ id: string }>("pipelineFunnel.lost", (from, to) =>
        client
          .from("contacts")
          .select("id")
          .eq("agency_id", agencyId)
          .eq("stage", "perdu" satisfies PipelineStage)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    const currentByStage = {} as Record<PipelineFunnelStage, number>;
    for (const entry of counts) {
      if (entry.count.error) return { data: null, error: entry.count.error };
      currentByStage[entry.stage] = entry.count.data;
    }
    if (lostContacts.error) return { data: null, error: lostContacts.error };

    const lostIds = lostContacts.data.map((row) => row.id);
    const activitiesByContact = new Map<string, FunnelActivity[]>();
    const types = [...STAGE_TRANSITION_ACTIVITY_TYPES, FUNNEL_RDV_ACTIVITY_TYPE];

    for (let offset = 0; offset < lostIds.length; offset += CONTACT_CHUNK) {
      const chunk = lostIds.slice(offset, offset + CONTACT_CHUNK);
      const rows = await fetchAllPages<ActivityRow>("pipelineFunnel.history", (from, to) =>
        client
          .from("activities")
          .select("contact_id, type, payload")
          .eq("agency_id", agencyId)
          .in("contact_id", chunk)
          .in("type", types)
          .order("occurred_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
      if (rows.error) return { data: null, error: rows.error };
      for (const row of rows.data) {
        if (!row.contact_id) continue;
        const list = activitiesByContact.get(row.contact_id) ?? [];
        list.push({ type: row.type, payload: row.payload });
        activitiesByContact.set(row.contact_id, list);
      }
    }

    return ok(
      computeFunnel({
        at: now.toISOString(),
        currentByStage,
        lost: lostIds.map((id) => {
          const { stage, traced } = furthestStageFromActivities(activitiesByContact.get(id) ?? []);
          return { furthest: stage, traced };
        }),
      }),
    );
  } catch (cause) {
    return failFromUnexpected<PipelineFunnel>("buildPipelineFunnel", cause);
  }
}
