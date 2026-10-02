import { Icon } from "@/components/icons/Icon";

import { stepLabel, stepName, stepPill, type ProcessStep } from "./process-carousel";
import styles from "./process.module.css";
import { ProcessVisual } from "./visuals/ProcessVisual";
import type { VisualState } from "./visuals/VisualFrame";

export type ProcessCardProps = {
  step: ProcessStep;
  index: number;
  active: boolean;
  state: VisualState;
  /** Increments on each play: remounts the drawing so it plays from its start. */
  playKey: number;
  /** The armed active card, not seen yet: its drawing waits on its first frame. */
  paused: boolean;
  onSelect: (index: number) => void;
};

/**
 * One step of the process carousel (docs/design-system.md §2.11.8.5): the pill
 * « ÉTAPE N°1 » (+ « HUMAINE » with a double contour for the two human steps),
 * the animated window, then the icon, the title « Demande reçue · Léa » and
 * its paragraph. Inactive cards are dimmed and blurred, hidden from assistive
 * technology (nothing focusable inside) and stay clickable: a click makes them
 * active.
 */
export function ProcessCard({ step, index, active, state, playKey, paused, onSelect }: ProcessCardProps) {
  return (
    <div
      role="group"
      aria-roledescription="étape"
      aria-label={stepLabel(index)}
      aria-hidden={active ? undefined : true}
      className={styles.card}
      data-snap=""
      data-step={step.key}
      data-active={active ? "" : undefined}
      data-human={step.human ? "" : undefined}
      data-testid="process-card"
      onClick={active ? undefined : () => onSelect(index)}
    >
      <span className={styles.pill}>{stepPill(index)}</span>
      <ProcessVisual key={playKey} step={step} state={state} paused={paused} />
      <div className={styles.cardText}>
        <h3 className={styles.cardTitle}>
          <Icon name={step.glyph} px={16} />
          {stepName(step)}
        </h3>
        <p className={styles.cardBody}>{step.body}</p>
      </div>
    </div>
  );
}
