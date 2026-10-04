import type { ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import { AppTile, type AppTileTone } from "./AppTile";
import { checkKey, pillFull, type CheckBy, type CheckRef, type EcosystemFrame } from "./ecosystem-timeline";
import styles from "./ecosystem.module.css";

const TEXTS = LANDING_TEXTS.journey;

type LineTexts = { icon: IconName; label: string; by: CheckBy; detail?: string };
type GroupTexts = { agent?: string; glyph?: IconName; label?: string; lines: readonly LineTexts[] };

export type EcosystemBlockTexts = {
  key: string;
  name: string;
  members: string;
  nature: "agents" | "human";
  glyph: IconName;
  tone: AppTileTone;
  groups: readonly GroupTexts[];
};

/** The white check of a box, traced (`stroke-dashoffset`) once the box is filled. Geometry of our `check` icon. */
function CheckMark() {
  return (
    <svg className={styles.checkMark} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M5 12.6l4.4 4.4L19 7.4" pathLength={1} />
    </svg>
  );
}

function Line({
  line,
  refKey,
  frame,
  pressedKey,
  children,
}: {
  line: LineTexts;
  refKey: string;
  frame: EcosystemFrame;
  pressedKey: string | null;
  children?: ReactNode;
}) {
  const missing = line.by === "missing";
  const checked = !missing && frame.checked.has(refKey);
  return (
    <li className={styles.line} data-missing={missing ? "" : undefined}>
      <Icon name={line.icon} px={14} dimmed />
      {line.detail ? (
        // The missing line only: label over detail, both kept whole.
        <span className={cn(styles.lineLabel, styles.lineStacked)} data-stacked="">
          <span>{line.label}</span>
          <span className={styles.lineDetail}>{line.detail}</span>
        </span>
      ) : (
        <span className={styles.lineLabel}>{line.label}</span>
      )}
      <span
        className={cn(styles.box, line.by === "you" ? styles.boxYou : styles.boxAgent)}
        data-case={refKey}
        data-check={line.by}
        data-checked={checked ? "true" : "false"}
        data-traced={missing ? (frame.missingTraced ? "true" : "false") : undefined}
        data-pressed={pressedKey === refKey ? "" : undefined}
      >
        {missing ? null : (
          <span className={styles.boxFill}>
            <CheckMark />
          </span>
        )}
        {children}
      </span>
    </li>
  );
}

/**
 * One block of block A (docs/design-system.md §2.11.8.8 L4-A): its app tile,
 * its name over its members, a pill (« Agents » or « Vous »), and its groups —
 * one per agent (small icon + first name) or, for the human block, one per
 * decision (« Premier message », « Mandat »). Each line is a bordered pill
 * with a grey icon, a label and a box. The SHAPE says who checks: a square
 * box for an agent, a round double-ringed box for you; the missing
 * information is dashed and never checked. Server-safe and stateless:
 * `frame` decides what is checked. `stillCursor` is placed in the box of
 * `stillAt` (server HTML, reduced motion).
 */
export function EcosystemBlock({
  block,
  index,
  frame,
  pressedKey,
  stillAt,
  stillCursor,
}: {
  block: EcosystemBlockTexts;
  index: number;
  frame: EcosystemFrame;
  /** Key of the box under the pressed cursor, if any. */
  pressedKey: string | null;
  stillAt?: CheckRef;
  stillCursor?: ReactNode;
}) {
  const human = block.nature === "human";
  return (
    <div
      className={styles.block}
      data-block={block.key}
      data-nature={block.nature}
      data-active={frame.ring === index ? "" : undefined}
      data-network-cover=""
    >
      <div className={styles.blockHead}>
        <AppTile glyph={block.glyph} tone={block.tone} animate={frame.story === index} />
        <span className={styles.blockName}>
          <span className={styles.blockTitle}>{block.name}</span>
          <span className={styles.blockMembers}>{block.members}</span>
        </span>
        {human ? (
          <span className={cn(styles.pill, styles.pillYou)} data-pill="you" data-full={pillFull(frame, index) ? "" : undefined}>
            {TEXTS.pills.you}
            <span className={styles.pillDot} />
          </span>
        ) : (
          <span className={cn(styles.pill, styles.pillAgent)} data-pill="agents">
            {TEXTS.pills.agents}
          </span>
        )}
      </div>
      <div className={styles.groups}>
        {block.groups.map((group, groupIndex) => (
          <div key={group.agent ?? group.label} className={styles.group} data-group={groupIndex}>
            <div className={styles.groupHead}>
              {group.agent && group.glyph ? (
                <>
                  <Icon name={group.glyph} px={14} />
                  <span className={styles.groupAgent}>{group.agent}</span>
                </>
              ) : (
                <span className={styles.groupLabel}>{group.label}</span>
              )}
            </div>
            <ul className={styles.lines}>
              {group.lines.map((line, lineIndex) => {
                const ref = { block: index, group: groupIndex, line: lineIndex };
                const key = checkKey(ref);
                const still = stillAt && checkKey(stillAt) === key;
                return (
                  <Line key={key} line={line} refKey={key} frame={frame} pressedKey={pressedKey}>
                    {still ? stillCursor : null}
                  </Line>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
