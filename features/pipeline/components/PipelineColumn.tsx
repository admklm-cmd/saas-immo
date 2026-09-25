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
 */
export function PipelineColumn({
  stage,
  contacts,
  position,
  total,
  canExitSignedMandate = false,
}: PipelineColumnProps) {
  const headingId = `pipeline-column-${stage}`;
  const outcome = stage === "mandat_signe";
  const last = position === total;
  const count = contacts.length;

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
              <p className="ml-2.5 text-xs font-medium text-ink-muted">{APP_TEXTS.dashboard.friezeMandateNote}</p>
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

        <p className="mt-3 text-xs text-ink-subtle sm:sr-only">{TEXTS.stageIndex(position, total)}</p>
        <h2 id={headingId} tabIndex={-1} className="mt-1 text-base font-semibold text-ink sm:mt-3">
          {PIPELINE_STAGE_LABELS[stage]}
        </h2>

        <p data-testid="pipeline-column-count" className="mt-1 flex items-baseline gap-1.5">
          <span className="text-heading font-semibold text-ink tabular-nums">{count}</span>{" "}
          <span className="text-xs text-ink-muted">{TEXTS.columnUnit(count)}</span>
        </p>
      </header>

      {count === 0 ? (
        <p className="flex min-h-20 items-center justify-center self-start rounded-xl border border-dashed border-line-strong px-4 text-center text-sm text-ink-subtle">
          {TEXTS.columnEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5 self-start">
          {contacts.map((contact) => (
            <PipelineContactCard key={contact.id} contact={contact} canExitSignedMandate={canExitSignedMandate} />
          ))}
        </ul>
      )}
    </section>
  );
}
