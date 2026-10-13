import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import type { ContactListItem } from "@/features/contacts/types";

import type { PipelineBoardColumn } from "../types";
import { groupContactsByStage, LOST_STAGE, PIPELINE_BOARD_STAGES } from "./groupContactsByStage";
import styles from "./PipelineBoard.module.css";
import { PipelineColumn, pipelineColumnId } from "./PipelineColumn";
import { PipelineLostLane } from "./PipelineLostLane";
import { PipelineStageChangeProvider } from "./PipelineStageChangeProvider";
import { PipelineStageNav } from "./PipelineStageNav";

const TEXTS = APP_TEXTS.pipeline;
const SCROLLER_ID = "pipeline-board";
/** Closed stages pile up over the year: their cards are folded until asked for. */
const FOLDED_STAGES = new Set(["mandat_signe", "perdu"]);

export type PipelineBoardProps = {
  contacts?: readonly ContactListItem[];
  /** Bounded board (`getPipelineBoard`): the latest cards of each stage and the EXACT totals. Prime over `contacts`. */
  columns?: readonly PipelineBoardColumn[];
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
 * Fed by `getPipelineBoard` the columns are bounded: the count of a stage is the
 * database's, the cards are the latest ones (« 12 sur 46 »), and the two closed
 * stages are folded by default. No drag-and-drop: each card offers a keyboard-first
 * « Changer d'étape » (the only client islands are that menu and the map).
 */
export function PipelineBoard({ contacts = [], columns, canExitSignedMandate = false }: PipelineBoardProps) {
  const groups = columns
    ? (Object.fromEntries(columns.map((column) => [column.stage, column.items])) as unknown as ReturnType<typeof groupContactsByStage>)
    : groupContactsByStage(contacts);
  const totals = new Map(columns?.map((column) => [column.stage, column.total]));
  const countOf = (stage: (typeof PIPELINE_BOARD_STAGES)[number] | typeof LOST_STAGE) =>
    totals.get(stage) ?? (groups[stage]?.length ?? 0);
  const total = PIPELINE_BOARD_STAGES.length;

  return (
    <PipelineStageChangeProvider>
      <div className={cn(styles.board, "animate-rise")}>
        <PipelineStageNav
          scrollerId={SCROLLER_ID}
          stages={PIPELINE_BOARD_STAGES.map((stage) => ({
            stage,
            count: countOf(stage),
            targetId: pipelineColumnId(stage),
          }))}
          lost={{ stage: LOST_STAGE, count: countOf(LOST_STAGE), targetId: pipelineColumnId(LOST_STAGE) }}
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
                contacts={groups[stage] ?? []}
                exactTotal={columns ? countOf(stage) : undefined}
                collapsed={Boolean(columns) && FOLDED_STAGES.has(stage)}
                canExitSignedMandate={canExitSignedMandate}
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <PipelineLostLane
            contacts={groups[LOST_STAGE] ?? []}
            exactTotal={columns ? countOf(LOST_STAGE) : undefined}
            collapsed={Boolean(columns)}
            canExitSignedMandate={canExitSignedMandate}
          />
        </div>
      </div>
    </PipelineStageChangeProvider>
  );
}
