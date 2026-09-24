import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import type { AppIconKind } from "./icons/AgentAppIcon";
import styles from "./OperationalRail.module.css";

type IconComponent = ComponentType<{ className?: string; width?: number | string; height?: number | string }>;

/**
 * State of a node, always read from something RECORDED (a step of the journal,
 * a run, a message review, an appointment, a stage change):
 *   * `pending`  — not reached yet: nothing recorded (never invented);
 *   * `running`  — recorded as still in progress;
 *   * `done`     — recorded as finished;
 *   * `human`    — recorded, and waiting for a human decision;
 *   * `blocked`  — refused by a guard rail (the signal stops, not an error);
 *   * `stopped`  — stopped by a human (refusal, cancellation): the signal stops;
 *   * `failed`   — technical error (distinct rendering);
 *   * `untraced` — nothing recorded here although a LATER node is: stated, not filled in.
 */
export type RailState = "pending" | "running" | "done" | "human" | "blocked" | "stopped" | "failed" | "untraced";

/** Node of the replay driven from outside (`AgentRunReplay`). */
export type RailPlay = "pending" | "active" | "done";

export type RailNode = {
  key: string;
  icon: IconComponent;
  /** Who or what: « Hugo », « Validation humaine », « Garde-fous ». */
  name: string;
  /** What concretely happened or will happen, one short line. */
  action?: ReactNode;
  state: RailState;
  /**
   * Human checkpoint (a validation or a confirmation by a person of the
   * agency): drawn with a double contour, in grey or black like the rest of the
   * network. It only takes the cobalt accent when its state is `human`, i.e.
   * when a decision is really awaited.
   */
  checkpoint?: boolean;
  /**
   * Who acts at this node, in the app-icon family (docs/design-system.md §2.8):
   * `agent` (rounded square, dark tile once the agent has worked), `human`
   * (circle), `outcome` (circle, filled once confirmed), `neutral`. Omitted
   * for the phases of a run, which keep the plain square.
   */
  tone?: AppIconKind;
  /** Written status (« Terminé », « Bloqué »…): the words carry the meaning. */
  statusLabel: string;
  /** Measured duration, already formatted. Omitted when nothing was measured. */
  duration?: string;
  /** Opens the record behind the node (a replay, a queue). */
  href?: string;
  /**
   * Timing of the activation, in ms from the start of the rail playback:
   * `at` when the node lights up, `linkAt` / `linkDur` when the signal travels
   * on the incoming line. Only used by the `measured` playback.
   */
  at?: number;
  linkAt?: number;
  linkDur?: number;
  /** State of the node in an `external` playback (the replay drives it). */
  play?: RailPlay;
};

export type RailPlayback =
  /** Recorded nodes light up one after the other, `--rail-step` apart (order only, no duration claimed). */
  | "stagger"
  /** Timing from the MEASURED durations (`at`, `linkAt`, `linkDur`), slowed by an announced factor only. */
  | "measured"
  /** The parent drives each node with `play` (the full replay). */
  | "external"
  /** Final state, no motion. */
  | "none";

export type OperationalRailProps = {
  nodes: readonly RailNode[];
  /** Accessible name of the list. */
  label: string;
  playback?: RailPlayback;
  /** Changing it replays the CSS playback (restart of a replay). */
  cycle?: number;
  className?: string;
  testId?: string;
};

/** A node is reached when something was recorded for it. */
export function isReached(state: RailState): boolean {
  return state !== "pending" && state !== "untraced";
}

/** A node after which the signal does not go on. */
export function stopsSignal(state: RailState): boolean {
  return state === "blocked" || state === "stopped" || state === "failed";
}

/**
 * Position of each node among the REACHED nodes (0, 1, 2…), in order; the last
 * reached position for a node that was not reached. Drives the stagger only.
 */
export function staggerOrder(nodes: readonly Pick<RailNode, "state">[]): number[] {
  const order: number[] = [];
  let reached = -1;
  for (const node of nodes) {
    if (isReached(node.state)) reached += 1;
    order.push(reached);
  }
  return order;
}

function ms(value: number | undefined): string {
  return `${Math.max(0, Math.round(value ?? 0))}ms`;
}

/**
 * Rail « réseau opérationnel » — docs/design-system.md §3.1.
 *
 * One node per recorded step (or per stage of a dossier), linked to the next
 * one by a line carrying small relay points (visual marks only: a line exists
 * only between consecutive nodes). The static network is black, white and
 * grey; cobalt is kept for what is really active: the moving signal, the node
 * in progress, and a human validation that awaits an action. Activation: the
 * signal travels, the border lights up, the pictogram moves once, the status
 * appears, the next line takes over. The signal visibly stops after a blocked, stopped or failed node.
 *
 * Honest by construction: the nodes and their states are given by the caller
 * from recorded data; this component invents no node, no percentage and no
 * duration. Everything is written (name, action, status, duration): the motion
 * only emphasises it, and `prefers-reduced-motion` shows the final state at once.
 * Horizontal from 768 px, vertical below.
 */
export function OperationalRail({ nodes, label, playback = "stagger", cycle = 0, className, testId }: OperationalRailProps) {
  // Stagger: the reached nodes are numbered in order; the others wait.
  const reachedOrder = staggerOrder(nodes);

  return (
    <ol
      key={cycle}
      aria-label={label}
      data-testid={testId}
      data-playback={playback}
      className={cn(styles.rail, className)}
      style={{ "--node-count": nodes.length } as CSSProperties}
    >
      {nodes.map((node, index) => {
        const previous = index > 0 ? nodes[index - 1] : undefined;
        const reached = isReached(node.state);
        const reachedIndex = reachedOrder[index] ?? -1;
        const timing =
          playback === "measured"
            ? { "--at": ms(node.at), "--link-at": ms(node.linkAt), "--link-dur": ms(node.linkDur) }
            : playback === "stagger"
              ? {
                  "--at": `calc(${reachedIndex} * var(--rail-step))`,
                  "--link-at": `calc(${Math.max(0, reachedIndex - 1)} * var(--rail-step))`,
                  "--link-dur": "var(--rail-step)",
                }
              : playback === "external"
                ? { "--link-dur": ms(node.linkDur) }
                : {};
        const Icon = node.icon;
        const lineCut = previous ? stopsSignal(previous.state) : false;

        return (
          <li
            key={node.key}
            className={styles.node}
            data-state={node.state}
            data-checkpoint={node.checkpoint || undefined}
            data-reached={reached || undefined}
            data-play={playback === "external" ? (node.play ?? "done") : undefined}
            data-testid="rail-node"
            data-node={node.key}
            style={timing as CSSProperties}
          >
            {previous ? (
              <span
                className={styles.link}
                aria-hidden="true"
                data-cut={lineCut || undefined}
                data-lit={(reached && !lineCut) || undefined}
              >
                <span className={styles.fill} />
                <span className={styles.travel}>
                  <span className={styles.signal} />
                </span>
              </span>
            ) : null}
            {previous ? (
              <span
                className={styles.relays}
                aria-hidden="true"
                data-testid="rail-relays"
                data-cut={lineCut || undefined}
                data-lit={(reached && !lineCut) || undefined}
              >
                <span className={styles.relay} />
                <span className={styles.relay} />
                <span className={styles.relay} />
              </span>
            ) : null}

            <span className={styles.core} aria-hidden="true" data-testid="rail-core" data-tone={node.tone}>
              <Icon className={styles.icon} width={node.tone ? 20 : 18} height={node.tone ? 20 : 18} />
              <span className={styles.dot} />
            </span>

            <span className={styles.text}>
              <span className={styles.name}>
                {node.href ? (
                  <Link href={node.href} className="ui-focus rounded-xs underline-offset-4 hover:underline">
                    {node.name}
                  </Link>
                ) : (
                  node.name
                )}
              </span>
              {node.action ? <span className={styles.action}>{node.action}</span> : null}
              <span className={styles.status} data-testid="rail-node-status">
                {node.statusLabel}
                {node.duration ? <span className={styles.duration}> · {node.duration}</span> : null}
              </span>
            </span>

            {stopsSignal(node.state) && index === nodes.length - 1 ? (
              <span className={styles.endcap} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
