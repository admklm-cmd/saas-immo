import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/features/contacts/types";

import { cn } from "./cn";

/**
 * Pipeline stage of a contact.
 *
 * No hue is used: progression is expressed by a 6-segment bar (position in the
 * pipeline) plus the label, and `perdu` is the only dashed, de-emphasised one.
 * Readable in greyscale and for colour-blind users.
 */
const STAGE_ORDER: readonly PipelineStage[] = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
];

const SEGMENTS = STAGE_ORDER.length;

export type PipelineStageBadgeProps = {
  stage: PipelineStage;
  className?: string;
};

export function PipelineStageBadge({ stage, className }: PipelineStageBadgeProps) {
  const label = PIPELINE_STAGE_LABELS[stage];
  const lost = stage === "perdu";
  const index = STAGE_ORDER.indexOf(stage);
  const filled = lost ? 0 : index + 1;

  return (
    <span
      data-stage={stage}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        lost
          ? "border border-dashed border-line-strong bg-surface text-ink-subtle"
          : stage === "mandat_signe"
            ? "bg-inverse text-ink-inverse"
            : "border border-line-strong bg-surface text-ink",
        className,
      )}
    >
      {lost ? null : (
        <span aria-hidden="true" className="flex items-center gap-0.5">
          {Array.from({ length: SEGMENTS }, (_, position) => (
            <span
              key={position}
              className={cn(
                "h-1 w-1 rounded-full",
                position < filled
                  ? stage === "mandat_signe"
                    ? "bg-ink-inverse"
                    : "bg-ink"
                  : stage === "mandat_signe"
                    ? "bg-white/30"
                    : "bg-line-strong",
              )}
            />
          ))}
        </span>
      )}
      {label}
    </span>
  );
}
