import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import { AgentAppIcon, type AppIconState } from "../icons/AgentAppIcon";
import { Glyph } from "../icons/Glyph";
import type { GlyphName } from "../icons/glyphs";
import type { MessageRailModel } from "./message-rail";
import styles from "./MessageDecisionRail.module.css";

export type MessageDecisionRailProps = {
  model: MessageRailModel;
  /** Accessible name of the rail. */
  label: string;
  author: { name: string; glyph: GlyphName; kind: "agent" | "human"; status: ReactNode };
  human: { name: string; status: ReactNode; consent: ReactNode };
  send: { name: string; status: ReactNode };
  className?: string;
};

const HUMAN_TILE: Readonly<Record<MessageRailModel["human"], AppIconState>> = {
  waiting: "active",
  done: "idle",
  stopped: "idle",
};

const SEND_TILE: Readonly<Record<MessageRailModel["send"], AppIconState>> = {
  idle: "inactive",
  waiting: "active",
  blocked: "inactive",
  done: "idle",
  never: "inactive",
};

function DoneMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <Glyph name="check" width={10} />
    </span>
  );
}

/**
 * The short rail above a message: « Préparé par … → Vous → Envoi
 * (simulation) » (docs/design-system.md §3.1.1).
 *
 * « Vous » is the human checkpoint (double contour, cobalt ring only while a
 * decision is really awaited); the consent of the channel is posed on it. A
 * small letter token stands on the line: in front of « Vous » while the
 * message waits, past it once validated, inside the send once the (simulated)
 * send is done, pushed back behind a stop mark when refused. The token moves
 * only when the state changes — i.e. after the server's answer — and every
 * state is also written under its node. Server-safe; reduced motion shows the
 * final state at once.
 */
export function MessageDecisionRail({ model, label, author, human, send, className }: MessageDecisionRailProps) {
  return (
    <div
      className={cn(styles.rail, className)}
      data-testid="message-rail"
      data-stage={model.stage}
      data-human={model.human}
      data-send={model.send}
      data-send-cut={model.sendCut || undefined}
      data-token={model.token}
    >
      <div className={styles.track} aria-hidden="true">
        <span className={styles.seg} data-seg="in" />
        <span className={styles.seg} data-seg="out">
          <span className={styles.fill} />
        </span>
        <span className={styles.stop} data-at="human" />
        <span className={styles.stop} data-at="send" />
        <span className={styles.lane}>
          <span className={styles.token}>
            <Glyph name="mail" width={12} />
          </span>
        </span>
      </div>

      <ol aria-label={label} className={styles.nodes}>
        <li className={styles.node} data-node="author">
          <span className={styles.tile}>
            <AgentAppIcon glyph={author.glyph} kind={author.kind} size="md" />
          </span>
          <span className={styles.name}>{author.name}</span>
          <span className={styles.status}>{author.status}</span>
        </li>

        <li className={styles.node} data-node="human">
          <span className={styles.tile}>
            <AgentAppIcon glyph="human" kind="human" size="md" state={HUMAN_TILE[model.human]} />
            {model.human === "done" ? <DoneMark /> : null}
          </span>
          <span className={styles.name}>{human.name}</span>
          <span className={styles.status}>{human.status}</span>
          <span className={styles.consent}>{human.consent}</span>
        </li>

        <li className={styles.node} data-node="send" data-reached={model.send === "done" || undefined}>
          <span className={styles.tile}>
            <AgentAppIcon glyph="mail" kind="neutral" size="md" state={SEND_TILE[model.send]} />
            {model.send === "done" ? <DoneMark /> : null}
          </span>
          <span className={styles.name}>{send.name}</span>
          <span className={styles.status}>{send.status}</span>
        </li>
      </ol>
    </div>
  );
}
