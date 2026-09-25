import type { AppIconKind } from "@/features/agents-ia/components/icons/AgentAppIcon";
import type { GlyphName } from "@/features/agents-ia/components/icons/glyphs";
import type { TimelineEntry } from "@/features/contacts/types";

/** Activity type written by the human stage change (`change_contact_stage`). */
export const STAGE_CHANGE_TYPE = "contact_stage_changed";

export type TimelineMark = { glyph: GlyphName; kind: AppIconKind };

/**
 * The tile drawn on the rail of the history, in the glyph family
 * (docs/design-system.md §2.8):
 *   * the SYMBOL says what happened — the agent's own symbol for an AI run,
 *     an envelope for a message, the task, the appointment, the line of the
 *     pipeline for a stage change, a document for anything else;
 *   * the SHAPE says who acted — dark tile for an AI agent, circle with a
 *     double contour for a person, light tile for the system; a stage change
 *     into « Mandat signé » is the outcome shape (filled disc), always a
 *     person's.
 * Read only from what the entry carries; nothing is inferred.
 */
export function timelineMark(entry: TimelineEntry): TimelineMark {
  const kind: AppIconKind =
    entry.actor.type === "ai_agent" ? "agent" : entry.actor.type === "user" ? "human" : "neutral";

  switch (entry.kind) {
    case "ai_run":
      return { glyph: entry.actor.agent ?? "network", kind: "agent" };
    case "message":
      return { glyph: "mail", kind };
    case "task":
      return { glyph: "tasks", kind };
    case "appointment":
      return { glyph: "appointment", kind };
    case "activity":
      if (entry.meta.type === STAGE_CHANGE_TYPE) {
        return entry.meta.stage === "mandat_signe" && entry.actor.type === "user"
          ? { glyph: "mandate", kind: "outcome" }
          : { glyph: "pipeline", kind };
      }
      return { glyph: "document", kind };
  }
}
