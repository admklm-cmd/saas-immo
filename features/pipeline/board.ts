/**
 * Pipeline domain — bounded board read (one column per stage).
 *
 * The board used to receive EVERY contact of the agency and group them in the
 * browser. With a year of history, most dossiers are closed (`mandat_signe`,
 * `perdu`): showing them all would bury the dossiers that still need an action,
 * and the payload grows without bound. Here each column carries:
 *   * `total`  — the EXACT number of dossiers at that stage (database count);
 *   * `items`  — at most `limit` cards (same shape as the contacts list);
 *   * `hasMore`— `total > items.length`, so the screen can say « 12 sur 222 »
 *     instead of pretending the list is complete.
 * The total is never the length of the cut list.
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts`, a
 * real session in the integration tests): RLS applies, the agency is resolved
 * server-side, no service_role.
 */

import { requireExactCount } from "@/features/agents-ia/activity";
import { CONTACT_LIST_COLUMNS, withPropertiesAndOpenTasks, type ContactRow } from "@/features/contacts/data";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected } from "@/lib/agents/errors";
import type { TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  PIPELINE_BOARD_CLOSED_STAGES,
  PIPELINE_BOARD_OPEN_LIMIT,
  PIPELINE_STAGES,
  pipelineBoardInputSchema,
  type PipelineBoard,
  type PipelineBoardColumn,
  type PipelineBoardInput,
} from "./types";

const INVALID_INPUT = {
  code: "stage_invalid_input",
  message: "Demande invalide : le tableau du pipeline n'a pas pu être chargé.",
} as const;

/**
 * The pipeline board of the caller's agency, bounded.
 *
 * `closedLimit` (default 12, 1..100) caps the closed columns (`mandat_signe`,
 * `perdu`); the open columns are capped at 100 (a real agency has far fewer
 * dossiers in progress, and the cap is reported through `hasMore` if it is ever
 * reached). `{ data: null, error }` on any failure: no column is ever returned
 * with a guessed total.
 */
export async function buildPipelineBoard(
  client: TypedClient,
  input: PipelineBoardInput = {},
): Promise<Result<PipelineBoard>> {
  try {
    const parsed = pipelineBoardInputSchema.safeParse(input);
    if (!parsed.success) return { data: null, error: INVALID_INPUT };
    const closedLimit = parsed.data.closedLimit;

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const agencyId = contextResult.data.agencyId;

    const columns = await Promise.all(
      PIPELINE_STAGES.map(async (stage): Promise<Result<PipelineBoardColumn>> => {
        const isClosed = (PIPELINE_BOARD_CLOSED_STAGES as readonly string[]).includes(stage);
        const limit = isClosed ? closedLimit : PIPELINE_BOARD_OPEN_LIMIT;

        const base = client.from("contacts").select(CONTACT_LIST_COLUMNS).eq("agency_id", agencyId).eq("stage", stage);
        const [countResponse, pageResponse] = await Promise.all([
          client
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("agency_id", agencyId)
            .eq("stage", stage),
          // Closed columns: the most recently touched first (the latest signed / lost);
          // open columns: the most recent request first, as in the contacts list.
          (isClosed
            ? base.order("updated_at", { ascending: false })
            : base.order("created_at", { ascending: false })
          )
            .order("id", { ascending: true })
            .range(0, limit - 1),
        ]);

        const total = requireExactCount(`pipelineBoard.count.${stage}`, countResponse);
        if (total.error) return { data: null, error: total.error };
        if (pageResponse.error) {
          return failFromDatabase<PipelineBoardColumn>(`pipelineBoard.${stage}`, pageResponse.error);
        }

        const items = await withPropertiesAndOpenTasks(
          client,
          agencyId,
          (pageResponse.data ?? []) as ContactRow[],
          `pipelineBoard.${stage}`,
        );
        if (items.error) return { data: null, error: items.error };

        return ok({
          stage,
          total: total.data,
          items: items.data,
          limit,
          hasMore: total.data > items.data.length,
          order: isClosed ? ("updated_desc" as const) : ("created_desc" as const),
        });
      }),
    );

    const built: PipelineBoardColumn[] = [];
    for (const column of columns) {
      if (column.error) return { data: null, error: column.error };
      built.push(column.data);
    }

    return ok({
      generatedAt: new Date().toISOString(),
      totalContacts: built.reduce((sum, column) => sum + column.total, 0),
      columns: built,
    });
  } catch (cause) {
    return failFromUnexpected<PipelineBoard>("buildPipelineBoard", cause);
  }
}
