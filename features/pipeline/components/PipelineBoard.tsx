import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import type { ContactListItem } from "@/features/contacts/types";

import { groupContactsByStage, LOST_STAGE, PIPELINE_BOARD_STAGES } from "./groupContactsByStage";
import styles from "./PipelineBoard.module.css";
import { PipelineColumn, pipelineColumnId } from "./PipelineColumn";
import { PipelineLostLane } from "./PipelineLostLane";
import { PipelineStageChangeProvider } from "./PipelineStageChangeProvider";
import { PipelineStageNav } from "./PipelineStageNav";

const TEXTS = APP_TEXTS.pipeline;
const SCROLLER_ID = "pipeline-board";

export type PipelineBoardProps = {
  contacts: readonly ContactListItem[];
  /** Display only (from `getPipelineViewer()`): the database stays the authority. */
  canExitSignedMandate?: boolean;
};

/**
 * Board of the agency's pipeline — docs/design-system.md §3.2.
 *
 * The six active stages on ONE line, left to right, in the order of the
 * seller's journey; their headers sit on the line of the dashboard frieze and
 * the cards under them are the dossiers. The line scrolls natively when the
 * screen is narrower than six columns (touch, trackpad, keyboard once the
 * focusable scroller has the focus, Tab through the cards); a map of the
 * stages above it says where you are and jumps to a stage. `perdu` sits
 * apart, under the line, dashed.
 *
 * No drag-and-drop: each card offers a keyboard-first « Changer d'étape »
 * (the only client islands are that menu and the map); everything else is a
 * Server Component, complete without JavaScript. The provider hosts the live
 * region that confirms a move once the card has changed column.
 */
export function PipelineBoard({ contacts, canExitSignedMandate = false }: PipelineBoardProps) {
  const groups = groupContactsByStage(contacts);
  const total = PIPELINE_BOARD_STAGES.length;

  return (
    <PipelineStageChangeProvider>
      <div className={cn(styles.board, "animate-rise")}>
        <PipelineStageNav
          scrollerId={SCROLLER_ID}
          stages={PIPELINE_BOARD_STAGES.map((stage) => ({
            stage,
            count: groups[stage].length,
            targetId: pipelineColumnId(stage),
          }))}
          lost={{ stage: LOST_STAGE, count: groups[LOST_STAGE].length, targetId: pipelineColumnId(LOST_STAGE) }}
        />

        <div
          id={SCROLLER_ID}
          role="region"
          aria-label={TEXTS.boardLabel}
          tabIndex={0}
          data-testid="pipeline-scroller"
          className={cn(styles.scroller, "mt-6")}
        >
          <div className={styles.track}>
            {PIPELINE_BOARD_STAGES.map((stage, index) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                position={index + 1}
                total={total}
                contacts={groups[stage]}
                canExitSignedMandate={canExitSignedMandate}
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <PipelineLostLane contacts={groups[LOST_STAGE]} canExitSignedMandate={canExitSignedMandate} />
        </div>
      </div>
    </PipelineStageChangeProvider>
  );
}
