import { APP_TEXTS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

import { groupContactsByStage, LOST_STAGE, PIPELINE_BOARD_STAGES } from "./groupContactsByStage";
import { PipelineColumn } from "./PipelineColumn";

const TEXTS = APP_TEXTS.pipeline;

/**
 * Read-only board of the agency's pipeline.
 *
 * Six active stages side by side (reflowing to fewer columns, never a
 * disgraceful horizontal scroll), then `perdu` on its own, narrower and
 * muted — a lost file is no longer worked actively (`docs/product.md` § 3).
 * No drag-and-drop, no stage change: every card only links to the contact
 * file. Changing a stage is a write and belongs to a future server action.
 */
export function PipelineBoard({ contacts }: { contacts: readonly ContactListItem[] }) {
  const groups = groupContactsByStage(contacts);

  return (
    <div className="animate-rise">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {PIPELINE_BOARD_STAGES.map((stage) => (
          <PipelineColumn key={stage} stage={stage} contacts={groups[stage]} />
        ))}
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <p className="max-w-sm text-xs text-ink-subtle">{TEXTS.lostSubtitle}</p>
        <div className="mt-3 max-w-sm">
          <PipelineColumn stage={LOST_STAGE} contacts={groups[LOST_STAGE]} emphasis="muted" />
        </div>
      </div>
    </div>
  );
}
