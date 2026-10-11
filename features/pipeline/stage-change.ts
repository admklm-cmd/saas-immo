/**
 * Pipeline domain — implementation of the human stage change.
 *
 * Takes an authenticated Supabase client, so the same code runs behind the
 * server action (session cookies) and in the integration tests. Never throws:
 * every failure is a `{ data: null, error }` with a French message.
 *
 * The database function `public.change_contact_stage` is the authority: it
 * re-checks membership, the mandate confirmation, the director-only exit and
 * the motive, locks the row and writes the append-only trace in the same
 * transaction. Nothing here can loosen those rules.
 */

import { resolveAgentContext } from "@/lib/agents/context";
import type { TypedClient } from "@/lib/agents/types";
import { fail, ok, type Result } from "@/lib/utils/result";

import {
  changeContactStageSchema,
  STAGE_CHANGE_ERROR_MESSAGES,
  stageChangeErrorCode,
  type ContactStageChange,
  type PipelineViewer,
  type StageChangeErrorCode,
} from "./types";

function failStage<T = never>(code: StageChangeErrorCode): Result<T> {
  return fail<T>(code, STAGE_CHANGE_ERROR_MESSAGES[code]);
}

/**
 * Validates `input` (unknown: a server action is a public endpoint), then asks
 * the database to change the stage.
 */
export async function changeStage(client: TypedClient, input: unknown): Promise<Result<ContactStageChange>> {
  try {
    const parsed = changeContactStageSchema.safeParse(input);
    if (!parsed.success) {
      const onReason = parsed.error.issues.some((issue) => issue.path[0] === "reason");
      // A malformed id answers like an unknown contact: never tell whether an
      // identifier is well-formed, known, or belongs to another agency.
      const onContact = parsed.error.issues.some((issue) => issue.path[0] === "contactId");
      return failStage(onReason ? "stage_reason_invalid" : onContact ? "contact_not_found" : "stage_invalid_input");
    }
    const { contactId, stage, mandateConfirmed, reason } = parsed.data;

    // Session re-checked server-side (the agency is resolved by the database
    // from auth.uid(), never from the browser).
    const context = await resolveAgentContext(client);
    if (context.error) {
      const code: StageChangeErrorCode =
        context.error.code === "not_authenticated" || context.error.code === "no_agency"
          ? context.error.code
          : "unexpected_error";
      return failStage(code);
    }

    const { data, error } = await client
      .rpc("change_contact_stage", {
        target_contact: contactId,
        new_stage: stage,
        mandate_confirmed: mandateConfirmed,
        ...(reason === null ? {} : { reason }),
      })
      .single();

    if (error || !data) {
      const code = error ? stageChangeErrorCode(error) : "unexpected_error";
      console.error(
        `[pipeline] changeStage refused (${error?.code ?? "?"}): ${error?.message ?? "no row returned"}`,
      );
      return failStage(code);
    }

    return ok({
      contactId: data.contact_id,
      previousStage: data.previous_stage,
      stage: data.current_stage,
      activityId: data.activity_id,
      changedAt: data.changed_at,
    });
  } catch (cause) {
    console.error("[pipeline] changeStage threw:", cause);
    return failStage("unexpected_error");
  }
}

/** Role of the caller in their agency, for the pipeline UI (explanations only). */
export async function resolvePipelineViewer(client: TypedClient): Promise<Result<PipelineViewer>> {
  try {
    const context = await resolveAgentContext(client);
    if (context.error) return { data: null, error: context.error };
    return ok({
      userId: context.data.userId,
      role: context.data.role,
      canExitSignedMandate: context.data.role === "director",
    });
  } catch (cause) {
    console.error("[pipeline] resolvePipelineViewer threw:", cause);
    return failStage("unexpected_error");
  }
}
