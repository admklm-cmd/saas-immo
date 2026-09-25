"use client";

import type { KeyboardEvent, MouseEvent, Ref } from "react";

import { APP_TEXTS, CONSENT_STATUS_LABELS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PendingDots } from "@/components/ui/PendingDots";

import type { PendingMessageView } from "../../types";
import { StopMark } from "../flow/StopMark";
import { AgentAppIcon } from "../icons/AgentAppIcon";
import { Glyph } from "../icons/Glyph";
import { messageRailFor } from "./message-rail-view";
import styles from "./ValidationDesk.module.css";

const TEXTS = APP_TEXTS.validationQueue;

export type MessageQueueItemProps = {
  message: PendingMessageView;
  selected: boolean;
  tabId: string;
  panelId: string;
  /** Real link: without JavaScript, it reloads the page on this message. */
  href: string;
  /** Roving tab index of the tab list. */
  focusable: boolean;
  onSelect: (event: MouseEvent<HTMLAnchorElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => void;
  ref?: Ref<HTMLAnchorElement>;
};

/**
 * One message of the queue, as a tab of the dual view: who it is for, the
 * channel, who prepared it, and where it stands (waiting, validated, stopped
 * by the consent). The selected one is lifted onto the pearl of the letter
 * pane it controls, with the cobalt marker of « you are here ».
 */
export function MessageQueueItem({
  message,
  selected,
  tabId,
  panelId,
  href,
  focusable,
  onSelect,
  onKeyDown,
  ref,
}: MessageQueueItemProps) {
  const { author } = messageRailFor(message);
  const preview = message.subject ?? message.body.split("\n").find((line) => line.trim() !== "") ?? "";

  return (
    <a
      ref={ref}
      id={tabId}
      href={href}
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={focusable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      data-testid="queue-item"
      data-status={message.status}
      className={cn(styles.item, "ui-focus")}
    >
      <span className={styles.marker} aria-hidden="true" />
      <AgentAppIcon glyph={author.glyph} kind={author.kind} size="sm" className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{message.contactName}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">
          {message.channelLabel} · {author.name}
        </span>
        <span className="mt-1 block truncate text-xs text-ink-subtle">{preview}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {message.status === "pending_validation" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <PendingDots label={null} />
              {message.statusLabel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span aria-hidden="true" className={styles.check}>
                <Glyph name="check" width={9} />
              </span>
              {message.statusLabel} · {TEXTS.railSendWaiting}
            </span>
          )}
          {message.isFirstContact ? (
            <span className="rounded-full border border-dashed border-line-strong px-1.5 py-px text-ink-subtle">
              {TEXTS.firstContact}
            </span>
          ) : null}
          {message.hasValidConsent ? null : (
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <StopMark size="sm" />
              {message.consentStatus
                ? `${TEXTS.consentShort} ${CONSENT_STATUS_LABELS[message.consentStatus].toLowerCase()}`
                : TEXTS.consentNone}
            </span>
          )}
        </span>
      </span>
    </a>
  );
}
