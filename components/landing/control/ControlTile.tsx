import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import styles from "./control.module.css";

export type ControlFact = { title: string; body: string };

export type ControlTileProps = {
  /** 0 or 1: arrival order (80 ms apart). */
  index: number;
  title: string;
  body: string;
  /** The three guard rails written under the visual (`control.facts`, word for word). */
  facts: readonly ControlFact[];
  /** « Simulation » + this label in the frame (the timeline only), or null. */
  fictive: string | null;
  children: ReactNode;
};

/**
 * One tile of the control section (docs/design-system.md §2.11.8.7 L3-D): a
 * white tile (24 px), a framed visual on top, then a legend — title in 500, one
 * grey sentence and three guard rails as real text (readable with no
 * JavaScript and under reduced motion). Server Component: the arrival is CSS,
 * once, under its own `Reveal`; not a control (no link, no focus).
 */
export function ControlTile({ index, title, body, facts, fictive, children }: ControlTileProps) {
  return (
    <li className={styles.cell} data-testid="control-tile">
      <Reveal frame="still">
        <article className={styles.tile} style={{ "--tile-index": index } as CSSProperties} data-network-cover="">
          <div className={styles.frame}>
            {fictive ? (
              <p className={styles.fictive} data-testid="control-fictive">
                <SimulationBadge />
                <span>{fictive}</span>
              </p>
            ) : null}
            {children}
          </div>
          <div className={styles.legend}>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.body}>{body}</p>
            <ul className={styles.facts} data-testid="control-facts">
              {facts.map((fact) => (
                <li key={fact.title} className={styles.fact} data-testid="control-fact">
                  <Icon name="check" px={14} className={styles.factIcon} />
                  <span>
                    <strong className={styles.factName}>{fact.title}</strong>
                    <span className={styles.factBody}> — </span>
                    <span className={styles.factBody}>{fact.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </Reveal>
    </li>
  );
}
