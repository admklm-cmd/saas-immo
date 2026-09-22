import type { ContactListItem, PipelineStage } from "@/features/contacts/types";

/**
 * Pipeline order from `CLAUDE.md`: `nouveau → qualifie → chaud → rdv_planifie →
 * estimation_faite → mandat_signe`. `perdu` is deliberately excluded from this
 * list: it is displayed separately, with less visual weight, because a lost
 * file is no longer worked actively (see `docs/product.md` § 3).
 */
export const PIPELINE_BOARD_STAGES: readonly PipelineStage[] = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
];

export const LOST_STAGE: PipelineStage = "perdu";

export type PipelineStageGroups = Readonly<Record<PipelineStage, readonly ContactListItem[]>>;

/**
 * Splits the agency's contacts by pipeline stage, most recently updated
 * first within each column. Read-only: this never writes a stage, it only
 * shapes what `getContacts()` already returned.
 */
export function groupContactsByStage(contacts: readonly ContactListItem[]): PipelineStageGroups {
  const groups = Object.fromEntries(
    [...PIPELINE_BOARD_STAGES, LOST_STAGE].map((stage) => [stage, [] as ContactListItem[]]),
  ) as Record<PipelineStage, ContactListItem[]>;

  for (const contact of contacts) {
    groups[contact.stage]?.push(contact);
  }

  for (const stage of Object.keys(groups) as PipelineStage[]) {
    groups[stage].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  return groups;
}
