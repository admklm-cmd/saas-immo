import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { PIPELINE_STAGE_LABELS, type ContactListItem, type PipelineStage } from "@/features/contacts/types";

import { PipelineContactCard } from "./PipelineContactCard";

const TEXTS = APP_TEXTS.pipeline;

export type PipelineColumnProps = {
  stage: PipelineStage;
  contacts: readonly ContactListItem[];
  /**
   * `perdu` carries less visual weight than an active stage: dashed border,
   * muted surface and subdued text, never colour as the only signal (the
   * label and the dashed style both say it).
   */
  emphasis?: "default" | "muted";
  /** Display only: explains why leaving « Mandat signé » may be disabled. */
  canExitSignedMandate?: boolean;
};

/** One pipeline column: a real landmark (`section` + `h2`), never colour-only. */
export function PipelineColumn({
  stage,
  contacts,
  emphasis = "default",
  canExitSignedMandate = false,
}: PipelineColumnProps) {
  const muted = emphasis === "muted";
  const headingId = `pipeline-column-${stage}`;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`pipeline-column-${stage}`}
      className={cn(
        "flex h-full flex-col rounded-xl border p-4",
        muted ? "border-dashed border-line-strong bg-surface-muted" : "border-line bg-surface shadow-subtle",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id={headingId} className={cn("text-sm font-semibold", muted ? "text-ink-subtle" : "text-ink")}>
          {PIPELINE_STAGE_LABELS[stage]}
        </h2>
        <Badge tone={muted ? "dashed" : "outline"}>{TEXTS.columnCount(contacts.length)}</Badge>
      </header>

      {contacts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-subtle">{TEXTS.columnEmpty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {contacts.map((contact) => (
            <PipelineContactCard key={contact.id} contact={contact} canExitSignedMandate={canExitSignedMandate} />
          ))}
        </ul>
      )}
    </section>
  );
}
