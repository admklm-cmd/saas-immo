import { APP_TEXTS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

import { groupContactsByStage, LOST_STAGE, PIPELINE_BOARD_STAGES } from "./groupContactsByStage";
import { PipelineColumn } from "./PipelineColumn";
import { PipelineStageChangeProvider } from "./PipelineStageChangeProvider";

const TEXTS = APP_TEXTS.pipeline;

export type PipelineBoardProps = {
  contacts: readonly ContactListItem[];
  /** Display only (from `getPipelineViewer()`): the database stays the authority. */
  canExitSignedMandate?: boolean;
};

/**
 * Board of the agency's pipeline.
 *
 * Six active stages side by side (reflowing to fewer columns, never a
 * disgraceful horizontal scroll), then `perdu` on its own, narrower and
 * muted — a lost file is no longer worked actively (`docs/product.md` § 3).
 * No drag-and-drop: each card offers a keyboard-first « Changer d'étape »
 * menu (the only client island); everything else stays a Server Component.
 * The provider hosts the live region that confirms a move once the card has
 * changed column.
 */
export function PipelineBoard({ contacts, canExitSignedMandate = false }: PipelineBoardProps) {
  const groups = groupContactsByStage(contacts);

  return (
    <PipelineStageChangeProvider>
      <div className="animate-rise">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {PIPELINE_BOARD_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              contacts={groups[stage]}
              canExitSignedMandate={canExitSignedMandate}
            />
          ))}
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <p className="max-w-sm text-xs text-ink-subtle">{TEXTS.lostSubtitle}</p>
          <div className="mt-3 max-w-sm">
            <PipelineColumn
              stage={LOST_STAGE}
              contacts={groups[LOST_STAGE]}
              emphasis="muted"
              canExitSignedMandate={canExitSignedMandate}
            />
          </div>
        </div>
      </div>
    </PipelineStageChangeProvider>
  );
}
