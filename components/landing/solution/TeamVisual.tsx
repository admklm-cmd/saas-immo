import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { TEAM_CENTRE, teamPosition } from "./solution-geometry";
import styles from "./solution-people.module.css";

const TEXTS = LANDING_TEXTS.solution.tiles.team;
/** Centre of « Vous », in % of the 200 px frame. */
const CENTRE_Y = (TEAM_CENTRE.yPx / 200) * 100;

/**
 * Tile 3 — the team: « Vous · Conseiller » in the middle, sharp and raised;
 * around it, on an ellipse and dimmed, the five agents (our tiles, no photo):
 * the three that prepare on the left, the two that follow on the right. Thin
 * lines tie each of them to you. On arrival they leave the centre for their
 * place (CSS, once).
 */
export function TeamVisual() {
  return (
    <div className={styles.team} data-testid="solution-team">
      <svg className={styles.teamLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {TEXTS.agents.map((agent, index) => {
          const position = teamPosition(index);
          return (
            <line
              key={agent.name}
              x1={position.x}
              y1={position.y}
              x2={TEAM_CENTRE.x}
              y2={CENTRE_Y}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {TEXTS.agents.map((agent, index) => {
        const position = teamPosition(index);
        return (
          <span
            key={agent.name}
            className={styles.agent}
            data-team-agent={agent.name}
            style={
              {
                left: `${position.x}%`,
                top: `${position.y}%`,
                "--team-from-x": `${TEAM_CENTRE.x - position.x}cqw`,
                "--team-from-y": `${CENTRE_Y - position.y}cqh`,
                "--agent-index": index,
              } as CSSProperties
            }
          >
            <AgentAppIcon glyph={agent.glyph} kind="agent" size="sm" />
            <span className={styles.agentName}>{agent.name}</span>
          </span>
        );
      })}
      <span className={styles.you} style={{ top: `${CENTRE_Y}%` }} data-testid="solution-team-you">
        <AgentAppIcon glyph="humanValidation" kind="human" size="md" />
        <span className={styles.youName}>{TEXTS.you}</span>
        <span className={styles.youRole}>{TEXTS.youRole}</span>
      </span>
    </div>
  );
}
