import type { ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { checkKey, type CheckBy, type EcosystemFrame } from "./ecosystem-timeline";
import styles from "./ecosystem.module.css";

const TEXTS = LANDING_TEXTS.journey;

export type EcosystemCardTexts = {
  key: string;
  name: string;
  role: string;
  nature: "agent" | "human" | "outcome";
  glyph: IconName;
  lines: readonly { icon: IconName; label: string; by: CheckBy; detail?: string }[];
};

/** The white check of a box, traced (`stroke-dashoffset`) once the box is filled. Geometry of our `check` icon. */
function CheckMark() {
  return (
    <svg className={styles.checkMark} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M5 12.6l4.4 4.4L19 7.4" pathLength={1} />
    </svg>
  );
}

/**
 * One work card of block A (docs/design-system.md §2.11.8.3): the tile of the
 * agent (or of the human step), its name and role, a pill (« Agent » or
 * « Vous »), and its lines — each a bordered pill with a grey icon, a label
 * and a box. The SHAPE says who checks: a square box for an agent, a round
 * double-ringed box for you; the missing information is dashed and never
 * checked. Server-safe and stateless: `frame` decides what is checked.
 */
export function EcosystemCard({
  card,
  index,
  frame,
  pressedKey,
  children,
}: {
  card: EcosystemCardTexts;
  index: number;
  frame: EcosystemFrame;
  /** Key of the box under the pressed cursor, if any. */
  pressedKey: string | null;
  /** Extra content placed in the card (the still cursor of the server HTML). */
  children?: ReactNode;
}) {
  const human = card.nature !== "agent";
  const allYours = card.lines.every((line, lineIndex) => line.by === "you" && frame.checked.has(checkKey({ card: index, line: lineIndex })));
  return (
    <div
      className={styles.card}
      data-card={card.key}
      data-nature={card.nature}
      data-active={frame.ring === index ? "" : undefined}
      data-network-cover=""
    >
      <div className={styles.cardHead}>
        <AgentAppIcon glyph={card.glyph} kind={card.nature} size="sm" />
        <span className={styles.cardName}>
          <span className={styles.cardTitle}>{card.name}</span>
          {/* Role and pill share the second row: « Validation humaine » keeps the whole width. */}
          <span className={styles.cardMeta}>
            <span className={styles.cardRole}>{card.role}</span>
            {human ? (
              <span className={cn(styles.pill, styles.pillYou)} data-pill="you" data-full={allYours ? "" : undefined}>
                {TEXTS.pills.you}
                <span className={styles.pillDot} />
              </span>
            ) : (
              <span className={cn(styles.pill, styles.pillAgent)} data-pill="agent">
                {TEXTS.pills.agent}
              </span>
            )}
          </span>
        </span>
      </div>
      <ul className={styles.lines}>
        {card.lines.map((line, lineIndex) => {
          const key = checkKey({ card: index, line: lineIndex });
          const missing = line.by === "missing";
          const checked = !missing && frame.checked.has(key);
          return (
            <li key={key} className={styles.line} data-missing={missing ? "" : undefined}>
              <Icon name={line.icon} px={14} dimmed />
              <span className={styles.lineLabel}>
                {line.label}
                {line.detail ? <span className={styles.lineDetail}> {line.detail}</span> : null}
              </span>
              <span
                className={cn(styles.box, line.by === "you" ? styles.boxYou : styles.boxAgent)}
                data-case={key}
                data-check={line.by}
                data-checked={checked ? "true" : "false"}
                data-traced={missing ? (frame.missingTraced ? "true" : "false") : undefined}
                data-pressed={pressedKey === key ? "" : undefined}
              >
                {missing ? null : (
                  <span className={styles.boxFill}>
                    <CheckMark />
                  </span>
                )}
                {line.by === "you" && lineIndex === card.lines.length - 1 ? children : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
