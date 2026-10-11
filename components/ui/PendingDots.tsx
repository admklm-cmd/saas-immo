import { APP_TEXTS } from "@/components/texts";

import { cn } from "./cn";

export type PendingDotsProps = {
  /**
   * Visible label. Defaults to « En attente de validation ». `null` when the
   * text right next to the dots already says it (a status badge, a history
   * line): the dots are then decorative only.
   */
  label?: string | null;
  className?: string;
};

/**
 * PASSIVE wait: something is waiting for a decision of a member of the
 * agency. Nothing is being processed — never use it for a request in flight
 * (that is `ThreeDotLoader`).
 */
export function PendingDots({ label = APP_TEXTS.states.pendingValidation, className }: PendingDotsProps) {
  const dots = (
    <span aria-hidden="true" className="pending-dots" data-testid="pending-dots">
      <i />
      <i />
      <i />
    </span>
  );

  if (label === null) return dots;

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-ink-muted", className)}>
      {dots}
      <span>{label}</span>
    </span>
  );
}
