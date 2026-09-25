import type { CSSProperties, ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";

import { AgentAppIcon } from "../icons/AgentAppIcon";
import { type FollowUpGate } from "./follow-up-sieve";
import styles from "./SieveFunnel.module.css";

const TEXTS = APP_TEXTS.emmaFollowUps;

/** Cap of the dots drawn under one number (the number is always written in full). */
export const SIEVE_DOT_CAP = 30;

export const GATE_LABELS: Readonly<Record<FollowUpGate, string>> = {
  takeover: TEXTS.gateTakeover,
  pendingDraft: TEXTS.gatePendingDraft,
  consent: TEXTS.gateConsent,
};

/** Anchor of the group of files stopped at a gate. */
export const gateAnchor = (gate: FollowUpGate) => `arret-${gate}`;
export const READY_ANCHOR = "prets";

export type SieveFunnelProps = {
  total: number;
  ready: number;
  steps: readonly { gate: FollowUpGate; arriving: number; stopped: number }[];
  /** The rule of the screen, said once, at the end of the sieve. */
  rule: ReactNode;
};

/** Thickness of the flow after a step, from its real share of the files. */
function weight(count: number, total: number): string {
  return total === 0 ? "0" : (count / total).toFixed(3);
}

function Dots({ count, tone }: { count: number; tone: "stopped" | "ready" }) {
  const shown = Math.min(count, SIEVE_DOT_CAP);
  if (shown === 0) return null;
  return (
    <span className={styles.dots} data-tone={tone} aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

/**
 * The summary band of « Relances Emma », drawn as the sieve itself
 * (docs/design-system.md §3.1.2): the files enter on the left, each gate lets
 * some of them stop — the count, and one dot per file — and the flow thins
 * out until the files that passed every check reach the human validation.
 * Every number is a count of the list the page received; the thickness of the
 * line is that same count, nothing else. Server-safe, static.
 */
export function SieveFunnel({ total, ready, steps, rule }: SieveFunnelProps) {
  const capped = Math.max(ready, ...steps.map((step) => step.stopped)) > SIEVE_DOT_CAP;

  return (
    <figure className={styles.funnel} data-testid="sieve-summary" aria-label={TEXTS.sieveLabel}>
      <ol className={styles.steps}>
        <li className={styles.step} data-kind="start">
          <span className={styles.head} />
          <span className={styles.track} aria-hidden="true">
            <span className={styles.seg} data-side="out" style={{ "--w": weight(total, total) } as CSSProperties} />
            <span className={styles.entry} />
          </span>
          <span className={styles.body}>
            <span className={styles.figure}>
              <span className={styles.big} data-testid="sieve-total">
                {total}
              </span>
              <span className={styles.unit}>{TEXTS.unitFiles(total)}</span>
            </span>
          </span>
        </li>

        {steps.map((step) => (
          <li key={step.gate} className={styles.step} data-kind="gate" data-stopped={step.stopped > 0 || undefined}>
            <span className={styles.head}>{GATE_LABELS[step.gate]}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.seg} data-side="in" style={{ "--w": weight(step.arriving, total) } as CSSProperties} />
              <span
                className={styles.seg}
                data-side="out"
                style={{ "--w": weight(step.arriving - step.stopped, total) } as CSSProperties}
              />
              <span className={styles.gate} />
              {step.stopped > 0 ? <span className={styles.drop} /> : null}
            </span>
            <span className={styles.body}>
              {step.stopped > 0 ? (
                <a href={`#${gateAnchor(step.gate)}`} className={styles.count} data-testid={`sieve-stopped-${step.gate}`}>
                  {TEXTS.stoppedAt(step.stopped)}
                </a>
              ) : (
                <span className={styles.none} data-testid={`sieve-stopped-${step.gate}`}>
                  {TEXTS.stoppedAt(0)}
                </span>
              )}
              <Dots count={step.stopped} tone="stopped" />
            </span>
          </li>
        ))}

        <li className={styles.step} data-kind="end">
          <span className={styles.head}>{TEXTS.gateEnd}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.seg} data-side="in" style={{ "--w": weight(ready, total) } as CSSProperties} />
            <span className={styles.tile}>
              <AgentAppIcon glyph="human" kind="human" size="sm" />
            </span>
          </span>
          <span className={styles.body}>
            <a href={`#${READY_ANCHOR}`} className={styles.readyLink} data-testid="sieve-ready">
              <span className={styles.big}>{ready}</span>
              <span className={styles.unit}>{TEXTS.unitReady(ready)}</span>
            </a>
            <Dots count={ready} tone="ready" />
          </span>
        </li>
      </ol>

      <figcaption className={styles.caption}>
        <span className={styles.legend} aria-hidden="true">
          <span className={styles.dots} data-tone="stopped">
            <i />
          </span>
          {TEXTS.dotLegend}
          {capped ? ` · ${TEXTS.dotsCapped(SIEVE_DOT_CAP)}` : null}
        </span>
        <div className={styles.rule}>{rule}</div>
      </figcaption>
    </figure>
  );
}
