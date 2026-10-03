import type { CSSProperties } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import styles from "./control-team.module.css";

const TEXTS = LANDING_TEXTS.control.tiles.team;

/** The lines of the chart, in the coordinates of each scene (§2.11.8.7 L3-D). */
const PATHS = {
  wide: {
    you: "M84 132 H152",
    trunk: "M288 132 H320",
    branches: [
      "M320 132 V36 Q320 28 328 28 H352",
      "M320 132 V88 Q320 80 328 80 H352",
      "M320 132 H352",
      "M320 132 V176 Q320 184 328 184 H352",
      "M320 132 V228 Q320 236 328 236 H352",
    ],
    width: 518,
    height: 264,
  },
  narrow: {
    you: "M52 102 V126",
    trunk: "M100 176 H124",
    branches: [
      "M124 176 V48 Q124 40 132 40 H148",
      "M124 176 V100 Q124 92 132 92 H148",
      "M124 176 V152 Q124 144 132 144 H148",
      "M124 176 V188 Q124 196 132 196 H148",
      "M124 176 V240 Q124 248 132 248 H148",
    ],
    width: 286,
    height: 288,
  },
} as const;

function Lines({ variant }: { variant: keyof typeof PATHS }) {
  const paths = PATHS[variant];
  return (
    <svg
      className={cn(styles.lines, variant === "wide" ? styles.wideOnly : styles.narrowOnly)}
      width={paths.width}
      height={paths.height}
      viewBox={`0 0 ${paths.width} ${paths.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.lineYou} d={paths.you} pathLength={1} />
      <path className={styles.lineTree} d={paths.trunk} pathLength={1} />
      {paths.branches.map((d) => (
        <path key={d} className={styles.lineTree} d={d} pathLength={1} />
      ))}
    </svg>
  );
}

/**
 * Tile 1 of the control section — the chart (docs/design-system.md §2.11.8.7
 * L3-D): « Vous » (verified advisor) linked to the agency space, from which the
 * five agents branch out; a kill switch under the space suspends them all.
 * Server Component: a fixed scene (518 × 264, 286 × 288 under 640 px), no
 * measure; the arrival is CSS, once, filled backwards (the final state is the
 * default style) and absent under reduced motion. No photo.
 */
export function TeamChartVisual() {
  return (
    <div className={styles.visual} role="img" aria-label={TEXTS.visualLabel} data-testid="control-team">
      <div className={styles.scene} aria-hidden="true">
        <Lines variant="wide" />
        <Lines variant="narrow" />

        <div className={styles.you} data-testid="control-team-you">
          <AgentAppIcon glyph="humanValidation" kind="human" size="lg" className={styles.wideOnly} />
          <AgentAppIcon glyph="humanValidation" kind="human" size="md" className={styles.narrowOnly} />
          <span className={styles.youName}>{TEXTS.you}</span>
          <span className={styles.youRole}>{TEXTS.youRole}</span>
        </div>
        <span className={styles.verified} data-testid="control-team-verified">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 12.6l4.4 4.4L19 7.4" />
          </svg>
        </span>

        <div className={styles.hub}>
          <AgentAppIcon glyph="dashboard" kind="neutral" size="md" className={styles.wideOnly} />
          <AgentAppIcon glyph="dashboard" kind="neutral" size="sm" className={styles.narrowOnly} />
          <span className={styles.hubName}>{TEXTS.hub}</span>
          <span className={cn(styles.hubSub, styles.wideOnly)}>{TEXTS.hubSub}</span>
          <span className={cn(styles.hubSub, styles.narrowOnly)}>{TEXTS.hubSubShort}</span>
        </div>
        <span className={styles.killSwitch} data-testid="control-team-kill-switch">
          <Icon name="lock" px={12} />
          {TEXTS.killSwitch}
        </span>

        <ul className={styles.roles}>
          {TEXTS.agents.map((agent, index) => (
            <li
              key={agent.name}
              className={styles.role}
              style={{ "--role-index": index } as CSSProperties}
              data-team-role={agent.name}
            >
              <span className={styles.roleDisc}>
                <Icon name={agent.glyph as IconName} px={18} />
              </span>
              <span className={styles.roleText}>
                <span className={styles.roleName}>{agent.name}</span>
                <span className={styles.roleRole}>{agent.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
