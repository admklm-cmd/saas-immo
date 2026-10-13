import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";
import { PIPELINE_STAGE_LABELS, type ContactListItem, type PipelineStage } from "@/features/contacts/types";

import styles from "./PipelineBoard.module.css";
import { PipelineContactCard } from "./PipelineContactCard";

const TEXTS = APP_TEXTS.pipeline;

export type PipelineColumnProps = {
  stage: PipelineStage;
  contacts: readonly ContactListItem[];
  /** 1-based position on the line of the journey, and the length of the line. */
  position: number;
  total: number;
  /** Display only: explains why leaving « Mandat signé » may be disabled. */
  canExitSignedMandate?: boolean;
  /** Exact number of dossiers at this stage when the cards are only the latest ones (bounded board). */
  exactTotal?: number;
  /** The cards are folded under a disclosure until the user asks for them. */
  collapsed?: boolean;
};

/** Id of a column, target of the stage links above the board. */
export function pipelineColumnId(stage: PipelineStage): string {
  return `etape-${stage}`;
}

/**
 * One active stage of the board: a real landmark (`section` + `h2`).
 *
 * Its header sits on the line of the journey, in the language of the
 * dashboard frieze: a hollow node per stage, the line running on to the next
 * stage, the label and the exact count. « Mandat signé » ends the line with
 * the outcome shape (filled disc, double contour) and says who seals it. The
 * cards below are the dossiers themselves — the dots of the frieze, opened.
 *
 * Bounded board: `exactTotal` is the database count, `contacts` only the latest
 * ones (« 12 sur 46 »); a `collapsed` column keeps its count and folds its cards.
 */
export function PipelineColumn({
  stage,
  contacts,
  position,
  total,
  canExitSignedMandate = false,
  exactTotal,
  collapsed = false,
}: PipelineColumnProps) {
  const headingId = `pipeline-column-${stage}`;
  const outcome = stage === "mandat_signe";
  const last = position === total;
  const count = exactTotal ?? contacts.length;
  const bounded = exactTotal !== undefined && exactTotal > contacts.length;
  const cards = (
    <ul className="flex flex-col gap-2.5 self-start">
      {contacts.map((contact) => (
        <PipelineContactCard key={contact.id} contact={contact} canExitSignedMandate={canExitSignedMandate} />
      ))}
    </ul>
  );

  return (
    <section
      id={pipelineColumnId(stage)}
      aria-labelledby={headingId}
      data-testid={`pipeline-column-${stage}`}
      data-pipeline-column={stage}
      className={cn(styles.column, "min-w-0")}
    >
      <header className="flex min-w-0 flex-col pb-4">
        {/* The line of the journey: each column draws its own segment up to the next node. */}
        <div className="relative flex h-7 items-center">
          {last ? null : (
            <span aria-hidden="true" className="absolute top-1/2 -right-3 left-1 h-px -translate-y-1/2 bg-line-strong" />
          )}
          {outcome ? (
            <>
              <AgentAppIcon glyph="mandate" kind="outcome" size="sm" className="-ml-1" />
              {/* The seal at the end of the line: who confirms a mandate. */}
              <p className="particle-veil particle-veil-tight ml-2.5 text-xs font-medium text-ink-muted">
                {APP_TEXTS.dashboard.friezeMandateNote}
              </p>
            </>
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                styles.node,
                "relative block size-2.5 rounded-full border-[1.5px] border-ink-subtle bg-surface",
              )}
            />
          )}
        </div>

        {/* Text on the canvas: a TIGHT veil, sized to the words (w-fit) and
            spaced from the line row above (mt-3), so it never covers the
            neighbouring column nor the connector line (docs/design-system.md §2.5.8). */}
        <div className="particle-veil particle-veil-tight mt-3 w-fit max-w-full min-w-0">
          <p className="text-xs text-ink-subtle sm:sr-only">{TEXTS.stageIndex(position, total)}</p>
          <h2 id={headingId} tabIndex={-1} className="mt-1 text-base font-semibold text-ink sm:mt-0">
            {PIPELINE_STAGE_LABELS[stage]}
          </h2>

          <p data-testid="pipeline-column-count" className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-heading font-semibold text-ink figure">{count}</span>{" "}
            <span className="text-xs text-ink-muted">{TEXTS.columnUnit(count)}</span>
            {bounded ? (
              <span className="text-xs text-ink-subtle" data-testid="pipeline-column-showing">
                · {TEXTS.columnShowing(contacts.length, count)}
              </span>
            ) : null}
          </p>
        </div>
      </header>

      {count === 0 ? (
        <p className="flex min-h-20 items-center justify-center self-start rounded-xl border border-dashed border-line-strong px-4 text-center text-sm text-ink-subtle">
          {TEXTS.columnEmpty}
        </p>
      ) : collapsed ? (
        <details data-testid={`pipeline-column-${stage}-details`} className="self-start">
          <summary className="ui-focus particle-veil particle-veil-tight inline-flex min-h-11 cursor-pointer items-center rounded-xs text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
            {TEXTS.columnExpand(contacts.length)}
          </summary>
          <div className="mt-2">{cards}</div>
          {bounded ? <p className="particle-veil particle-veil-tight mt-3 w-fit max-w-full text-xs text-ink-subtle">{TEXTS.columnMore}</p> : null}
        </details>
      ) : (
        cards
      )}
    </section>
  );
}
