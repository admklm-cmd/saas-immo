import { APP_TEXTS } from "@/components/texts";

import { StopMark } from "../flow/StopMark";
import { AgentAppIcon } from "../icons/AgentAppIcon";
import { FOLLOW_UP_GATES, type FollowUpGate, type GateState } from "./follow-up-sieve";
import styles from "./FollowUpRow.module.css";
import { GATE_LABELS } from "./SieveFunnel";

const TEXTS = APP_TEXTS.emmaFollowUps;

export type FollowUpGatesProps = {
  contactName: string;
  gates: Readonly<Record<FollowUpGate, GateState>>;
  reached: Readonly<Record<FollowUpGate, boolean>>;
  /** Channel retained by the code when the consent gate is open (« Email »). */
  channelLabel: string | null;
  /** A draft of Emma really waits for a human: the end node carries the cobalt ring. */
  waitingHuman: boolean;
  /** The server just confirmed a draft for this file: one signal runs to the end node. */
  signal?: boolean;
};

/**
 * The checks of one file, drawn as gates on a line (docs/design-system.md
 * §3.1.2): ink where the file went through, a stop mark where the server
 * stops it, dashed after. Each gate also says its state in words for screen
 * readers; the column headers say which check it is.
 */
export function FollowUpGates({ contactName, gates, reached, channelLabel, waitingHuman, signal = false }: FollowUpGatesProps) {
  const allOpen = FOLLOW_UP_GATES.every((gate) => gates[gate] === "open");

  return (
    <ul className={styles.gates} aria-label={TEXTS.rowControls(contactName)} data-testid="follow-up-gates">
      {FOLLOW_UP_GATES.map((gate) => {
        const state = gates[gate];
        const isReached = reached[gate];
        const passes = isReached && state === "open";
        return (
          <li
            key={gate}
            className={styles.cell}
            data-gate={gate}
            data-state={state}
            data-reached={isReached || undefined}
            data-stop={(isReached && state === "closed") || undefined}
          >
            <span className={styles.half} data-side="in" data-lit={isReached || undefined} aria-hidden="true" />
            <span className={styles.half} data-side="out" data-lit={passes || undefined} aria-hidden="true" />
            <span className={styles.node} aria-hidden="true">
              {state === "closed" ? <StopMark tone={isReached ? "ink" : "muted"} className={styles.stop} /> : <span className={styles.ring} />}
            </span>
            {gate === "consent" && state === "open" && channelLabel ? (
              <span className={styles.channel} aria-hidden="true">
                {channelLabel}
              </span>
            ) : null}
            <span className="sr-only">
              {GATE_LABELS[gate]} : {state === "open" ? TEXTS.gatePassed : TEXTS.gateStopped}
              {gate === "consent" && state === "open" && channelLabel ? ` (${channelLabel})` : null}
            </span>
          </li>
        );
      })}
      <li className={styles.cell} data-gate="end" data-reached={allOpen || undefined}>
        <span className={styles.half} data-side="in" data-lit={allOpen || undefined} aria-hidden="true" />
        <span className={styles.node} aria-hidden="true">
          <AgentAppIcon
            glyph="human"
            kind="human"
            size="sm"
            state={waitingHuman ? "active" : allOpen ? "idle" : "inactive"}
          />
        </span>
        <span className="sr-only">
          {TEXTS.gateEnd}
          {waitingHuman ? ` : ${TEXTS.waitingHuman}` : null}
        </span>
      </li>
      {signal ? (
        <li className={styles.signalLane} aria-hidden="true" data-testid="follow-up-signal">
          <span className={styles.signal} />
        </li>
      ) : null}
    </ul>
  );
}
