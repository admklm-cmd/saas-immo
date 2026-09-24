import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { stepNumber } from "./agent-steps";
import styles from "./agents.module.css";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type StepNavigatorProps = {
  /** 1-based position of the open step, and the number of steps. */
  position: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
};

/**
 * Discreet navigation « ←  04 / 07  → ». Borderless round buttons with the
 * arrows of the glyph family. `aria-disabled` rather than `disabled` at both
 * ends: the focus never falls off the page.
 */
export function StepNavigator({ position, count, onPrevious, onNext }: StepNavigatorProps) {
  const atStart = position <= 1;
  const atEnd = position >= count;

  return (
    <div role="group" aria-label={TEXTS.navLabel} className={styles.nav}>
      <button
        type="button"
        aria-label={TEXTS.previous}
        aria-disabled={atStart || undefined}
        onClick={atStart ? undefined : onPrevious}
        data-testid="agents-previous"
        data-direction="previous"
        className={cn("ui-focus", styles.navButton)}
      >
        <Glyph name="arrowLeft" width={16} />
      </button>
      <span className={styles.navCount} data-testid="agents-position">
        <span className="sr-only">{TEXTS.stepPrefix} </span>
        <span className={styles.navCurrent}>{stepNumber(position)}</span>
        <span aria-hidden="true"> / </span>
        <span className="sr-only"> {TEXTS.positionOf} </span>
        {stepNumber(count)}
      </span>
      <button
        type="button"
        aria-label={TEXTS.next}
        aria-disabled={atEnd || undefined}
        onClick={atEnd ? undefined : onNext}
        data-testid="agents-next"
        data-direction="next"
        className={cn("ui-focus", styles.navButton)}
      >
        <Glyph name="arrowRight" width={16} />
      </button>
    </div>
  );
}
