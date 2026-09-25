import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PIPELINE_STAGE_LABELS, type ContactListItem } from "@/features/contacts/types";

import styles from "./PipelineBoard.module.css";
import { pipelineColumnId } from "./PipelineColumn";
import { PipelineContactCard } from "./PipelineContactCard";

const TEXTS = APP_TEXTS.pipeline;
const LOST = "perdu" as const;

export type PipelineLostLaneProps = {
  contacts: readonly ContactListItem[];
  canExitSignedMandate?: boolean;
};

/**
 * « Perdu », off the line: a lost file is no longer worked actively
 * (`docs/product.md` § 3). Same signs as the dashboard frieze — dashed
 * frame, muted surface, subdued figure — never colour alone: the label and
 * the dashed style both say it. Its cards wrap in a grid (no scrolling).
 */
export function PipelineLostLane({ contacts, canExitSignedMandate = false }: PipelineLostLaneProps) {
  const headingId = `pipeline-column-${LOST}`;
  const count = contacts.length;

  return (
    <section
      id={pipelineColumnId(LOST)}
      aria-labelledby={headingId}
      data-testid={`pipeline-column-${LOST}`}
      data-pipeline-column={LOST}
      className="scroll-mt-24 rounded-2xl border border-dashed border-line-strong bg-surface-muted p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          aria-hidden="true"
          className={cn(styles.node, "block size-2.5 rounded-full border-[1.5px] border-dashed border-ink-subtle")}
        />
        <h2 id={headingId} tabIndex={-1} className="text-base font-semibold text-ink-subtle">
          {PIPELINE_STAGE_LABELS[LOST]}
        </h2>
        <p data-testid="pipeline-column-count" className="flex items-baseline gap-1.5">
          <span className="text-heading font-semibold text-ink-subtle tabular-nums">{count}</span>{" "}
          <span className="text-xs text-ink-muted">{TEXTS.columnUnit(count)}</span>
        </p>
        <p className="text-xs text-ink-subtle sm:ml-auto">{TEXTS.lostSubtitle}</p>
      </header>

      {count === 0 ? (
        <p className="mt-4 text-sm text-ink-subtle">{TEXTS.columnEmpty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 items-start gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
          {contacts.map((contact) => (
            <PipelineContactCard key={contact.id} contact={contact} canExitSignedMandate={canExitSignedMandate} />
          ))}
        </ul>
      )}
    </section>
  );
}
