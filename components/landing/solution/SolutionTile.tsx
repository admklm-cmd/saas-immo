import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { cn } from "@/components/ui/cn";

import styles from "./solution.module.css";

export type SolutionTileProps = {
  /** 1 to 5: grid place, arrival order (80 ms apart) and `data-tile`. */
  index: number;
  icon: IconName;
  title: string;
  body: string;
  /** Accessible name of the drawing (`role="img"`); `null`: the visual is plain text, read as is (tile 5). */
  visualLabel: string | null;
  /** « Simulation » + « Exemple fictif » in the frame (tiles 1 to 4, never on the real rules of tile 5). */
  fictive: boolean;
  /** Tile 1: the frame fills the two rows. */
  tall?: boolean;
  /** Tile 5: the frame grows with its text (min. 200 px) instead of clipping it. */
  fluid?: boolean;
  children: ReactNode;
};

/**
 * One tile of block B (docs/design-system.md §2.11.8.4): a white rounded tile
 * (24 px), a framed visual on top, then the icon, the title in 500 and a short
 * grey paragraph. Server Component: the movement is CSS, triggered once by its
 * own `Reveal` (`[data-reveal="entering"]`); the server HTML, reduced motion
 * and missing JavaScript show the final state. Not a control: no link, no
 * focus; hovering it (fine pointer) lifts it by 2 px and plays the icon story.
 */
export function SolutionTile({ index, icon, title, body, visualLabel, fictive, tall = false, fluid = false, children }: SolutionTileProps) {
  return (
    <li className={cn(styles.cell, styles[`cell${index}`])} data-tile={index}>
      <Reveal frame="still">
        <div
          className={cn(styles.tile, tall && styles.tall)}
          style={{ "--tile-index": index - 1 } as CSSProperties}
          data-network-cover=""
          data-icon-trigger=""
        >
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
          <div className={styles.text}>
            <h3 className={styles.title}>
              <Icon name={icon} px={16} className={styles.icon} />
              {title}
            </h3>
            <p className={styles.body}>{body}</p>
          </div>
        </div>
      </Reveal>
    </li>
  );
}
