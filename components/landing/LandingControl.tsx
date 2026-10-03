import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { ControlTile } from "./control/ControlTile";
import { ControlTimeline } from "./control/ControlTimeline";
import { TeamChartVisual } from "./control/TeamChartVisual";
import styles from "./control/control.module.css";
import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.control;
const TEAM_FACTS = TEXTS.facts.filter((fact) => fact.tile === "team");
const TIMELINE_FACTS = TEXTS.facts.filter((fact) => fact.tile === "timeline");

/**
 * Section « Le contrôle reste humain » (docs/design-system.md §2.11.8.7 L3-C,
 * L3-D): a centred title, then two animated tiles — WHO decides (the chart)
 * and WHEN (the timeline of a fictitious dossier). The six guard rails stay
 * written in the legends, three per tile, and shown in the visuals.
 */
export function LandingControl() {
  return (
    <section
      aria-labelledby="control-title"
      data-living-scene="controle"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal frame="still">
        <LandingHeading
          id="control-title"
          kicker={TEXTS.kicker}
          titleLines={TEXTS.titleLines}
          titleAccent={TEXTS.titleAccent}
          body={TEXTS.body}
          accentEffect="tech"
          accentReplay
          align="center"
        />
      </Reveal>
      <div className={styles.gridWrap}>
        <div className={styles.separators} aria-hidden="true">
          <span className={styles.separator} data-testid="control-separator" />
          <span className={styles.separator} data-testid="control-separator" />
          <span className={styles.separator} data-testid="control-separator" />
        </div>
        <ul className={styles.grid} data-testid="control-grid">
          <ControlTile index={0} title={TEXTS.tiles.team.title} body={TEXTS.tiles.team.body} facts={TEAM_FACTS} fictive={null}>
            <TeamChartVisual />
          </ControlTile>
          <ControlTile
            index={1}
            title={TEXTS.tiles.timeline.title}
            body={TEXTS.tiles.timeline.body}
            facts={TIMELINE_FACTS}
            fictive={TEXTS.tiles.timeline.fictive}
          >
            <ControlTimeline />
          </ControlTile>
        </ul>
      </div>
    </section>
  );
}
