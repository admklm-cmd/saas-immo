import type { CSSProperties, ReactNode } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { cn } from "@/components/ui/cn";

import styles from "./solution.module.css";

export type SolutionTileProps = {
  /** 1 to 5: grid place, arrival order (80 ms apart), `data-tile` and the id of the hidden title. */
  index: number;
  title: string;
  body: string;
  /** Accessible name of the drawing (`role="img"`); `null`: the visual is plain text, read as is (tile 5). */
  visualLabel: string | null;
  /** « Simulation » + « Exemple fictif » in the frame (tiles 1 to 4, never on the real rules of tile 5). */
  fictive: boolean;
  /** Tile 1: the frame fills the two rows. */
  tall?: boolean;
  /** Tile 5: the frame grows with its text instead of clipping it. */
  fluid?: boolean;
  children: ReactNode;
};

/**
 * One tile of block B (docs/design-system.md §2.11.8.4, §2.11.8.7 L3-B): a
 * white rounded tile (24 px) holding ONE framed illustration — no visible text
 * under it (decision of the user, 03/10). The title and the paragraph stay in
 * the DOM, visually hidden (`h3.sr-only` naming the `article`, `p.sr-only`), so
 * the grid still reads as five named tiles. Server Component: the movement is
 * CSS, triggered once by its own `Reveal` (`[data-reveal="entering"]`); the
 * server HTML, reduced motion and missing JavaScript show the final state. Not
 * a control: no link, no focus; hovering it (fine pointer) lifts it by 2 px.
 */
export function SolutionTile({ index, title, body, visualLabel, fictive, tall = false, fluid = false, children }: SolutionTileProps) {
  const titleId = `solution-tile-${index}-title`;
  return (
    <li className={cn(styles.cell, styles[`cell${index}`])} data-tile={index}>
      <Reveal frame="still">
        <article
          aria-labelledby={titleId}
          className={cn(styles.tile, tall && styles.tall)}
          style={{ "--tile-index": index - 1 } as CSSProperties}
          data-network-cover=""
        >
          <h3 id={titleId} className="sr-only">
            {title}
          </h3>
          <p className="sr-only">{body}</p>
          <div className={cn(styles.frame, fluid && styles.fluid)} data-testid="solution-visual">
            {fictive ? (
              <p className={styles.fictive} data-testid="solution-fictive">
                <SimulationBadge />
                <span>{LANDING_TEXTS.solution.fictive}</span>
              </p>
            ) : null}
            {visualLabel ? (
              <div role="img" aria-label={visualLabel} className={styles.drawing}>
                {children}
              </div>
            ) : (
              <div className={styles.drawing}>{children}</div>
            )}
          </div>
        </article>
      </Reveal>
    </li>
  );
}
