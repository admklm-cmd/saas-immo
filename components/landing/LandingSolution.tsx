import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";
import { GuardsVisual } from "./solution/GuardsVisual";
import { ProgressVisual } from "./solution/ProgressVisual";
import { ReportVisual } from "./solution/ReportVisual";
import { RoadmapVisual } from "./solution/RoadmapVisual";
import { SolutionTile } from "./solution/SolutionTile";
import { TeamVisual } from "./solution/TeamVisual";
import styles from "./solution/solution.module.css";

const TEXTS = LANDING_TEXTS.solution;
const TILES = TEXTS.tiles;

/**
 * Section « La solution » — block B (docs/design-system.md §2.11.8.4): one
 * idea, a dossier follows a known path between bounded agents and real guard
 * rails. The heading has no title effect (§2.11.8.2). Below it, the « partner »
 * grid: the roadmap of the seven steps (on two rows), the rising curve of a
 * fictitious dossier, the team around « Vous », Sarah's report, and the guard
 * rails as two true figures. Each tile arrives once, its drawing with it; no
 * loop. Tiles 1–4 are labelled « Simulation · Exemple fictif ».
 */
export function LandingSolution() {
  return (
    <section
      aria-labelledby="solution-title"
      data-living-scene="solution"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal frame="still">
        <LandingHeading
          id="solution-title"
          kicker={TEXTS.kicker}
          titleLines={TEXTS.titleLines}
          titleAccent={TEXTS.titleAccent}
          body={TEXTS.body}
        />
      </Reveal>

      <ul className={styles.grid} data-testid="solution-grid">
        <SolutionTile index={1} icon="pipeline" title={TILES.roadmap.title} body={TILES.roadmap.body} visualLabel={TILES.roadmap.visualLabel} fictive tall>
          <RoadmapVisual />
        </SolutionTile>
        <SolutionTile index={2} icon="growth" title={TILES.progress.title} body={TILES.progress.body} visualLabel={TILES.progress.visualLabel} fictive>
          <ProgressVisual />
        </SolutionTile>
        <SolutionTile index={3} icon="aiAgent" title={TILES.team.title} body={TILES.team.body} visualLabel={TILES.team.visualLabel} fictive>
          <TeamVisual />
        </SolutionTile>
        <SolutionTile index={4} icon="document" title={TILES.report.title} body={TILES.report.body} visualLabel={TILES.report.visualLabel} fictive>
          <ReportVisual />
        </SolutionTile>
        <SolutionTile index={5} icon="humanValidation" title={TILES.guards.title} body={TILES.guards.body} visualLabel={null} fictive={false} fluid>
          <GuardsVisual />
        </SolutionTile>
      </ul>
    </section>
  );
}
