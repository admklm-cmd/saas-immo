"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { PendingMessageView } from "../types";
import { Glyph } from "./icons/Glyph";
import { PendingMessageCard } from "./PendingMessageCard";
import type { MessageOutcome } from "./validation/message-rail";
import { MessageQueueItem } from "./validation/MessageQueueItem";
import { initialSelection, nextSelection, queueKeyTarget, type QueueView } from "./validation/queue-selection";
import { ResolvedMessage } from "./validation/ResolvedMessage";
import styles from "./validation/ValidationDesk.module.css";

const TEXTS = APP_TEXTS.validationQueue;
const QUEUE_PATH = "/agents-ia/a-valider";
/** Same width as the `xl` breakpoint: side by side from here. */
const DUAL_VIEW_QUERY = "(min-width: 80rem)";

type Resolved = {
  message: PendingMessageView;
  outcome: Extract<MessageOutcome, "rejected" | "sent">;
  /** Ids that followed it in the queue when it was decided on. */
  following: readonly string[];
};

export type PendingMessagesListProps = {
  messages: readonly PendingMessageView[];
  /** `?message=` of the URL, read by the page (no extra query). */
  initialSelectedId?: string | null;
};

const tabId = (id: string) => `queue-tab-${id}`;
const panelId = (id: string) => `queue-panel-${id}`;
const headingId = (id: string) => `queue-letter-${id}`;

function isDualView(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DUAL_VIEW_QUERY).matches;
}

/**
 * The validation desk — docs/design-system.md §3.1.1.
 *
 * Left, the queue (a vertical tab list); right, the selected message as a
 * letter, under its rail. Every message of the queue is in the HTML (the
 * others are `hidden` panels): switching is instant, needs no new request,
 * and without JavaScript each tab is a real link (`?message=`) that reloads
 * the page on that message. Below 1280 px: the queue, then the letter with
 * « Retour à la file ».
 *
 * After a decision the confirmation stays on screen (polite live region) and
 * the queue is re-read server-side. A message that leaves the queue (refused,
 * sent) stays visible in its final state until another one is chosen.
 */
export function PendingMessagesList({ messages, initialSelectedId = null }: PendingMessagesListProps) {
  const router = useRouter();
  const initial = initialSelection(messages, initialSelectedId);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [view, setView] = useState<QueueView>(initial.view);
  const [decision, setDecision] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const tabs = useRef(new Map<string, HTMLAnchorElement>());
  const resolvedRef = useRef<HTMLElement>(null);
  const focusLetter = useRef(false);

  const inQueue = selectedId !== null && messages.some((message) => message.id === selectedId);
  const showResolved = !inQueue && resolved !== null && resolved.message.id === selectedId;
  // A selection that left the queue without a snapshot (decided in another
  // tab): the first message takes its place.
  const activeId = inQueue ? selectedId : showResolved ? null : (messages[0]?.id ?? null);
  const focusableId = activeId ?? messages[0]?.id ?? null;

  const onDecided = useCallback(
    (summary: string) => {
      setDecision(summary);
      // Re-reads the queue server-side: a handled draft leaves the list.
      router.refresh();
    },
    [router],
  );

  function syncUrl(id: string | null) {
    const url = id ? `${QUEUE_PATH}?message=${encodeURIComponent(id)}` : QUEUE_PATH;
    window.history.replaceState(window.history.state, "", url);
  }

  function select(id: string, open: boolean) {
    setSelectedId(id);
    syncUrl(id);
    if (open) {
      setView("message");
      // On a phone the letter replaces the queue: take the focus there.
      focusLetter.current = !isDualView();
    }
  }

  function onTabClick(id: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      // Let the browser open a new tab or window as usual.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      select(id, true);
    };
  }

  function onTabKeyDown(index: number) {
    return (event: KeyboardEvent<HTMLAnchorElement>) => {
      if (event.key === " ") {
        event.preventDefault();
        const id = messages[index]?.id;
        if (id) select(id, true);
        return;
      }
      const target = queueKeyTarget(event.key, index, messages.length);
      if (target === null) return;
      event.preventDefault();
      const id = messages[target]?.id;
      if (!id) return;
      // Selection follows the focus (the letter is already in the page).
      select(id, false);
      tabs.current.get(id)?.focus();
    };
  }

  function backToQueue(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setView("list");
    syncUrl(null);
    const id = activeId ?? focusableId;
    if (id) requestAnimationFrame(() => tabs.current.get(id)?.focus());
  }

  function onResolved(message: PendingMessageView) {
    return (outcome: MessageOutcome) => {
      if (outcome === "validated") return;
      const index = messages.findIndex((candidate) => candidate.id === message.id);
      setResolved({ message, outcome, following: messages.slice(index + 1).map((next) => next.id) });
    };
  }

  const nextId = resolved ? nextSelection(messages, resolved.following) : null;

  // The letter of a phone view takes the focus once, after it is shown.
  useEffect(() => {
    if (!focusLetter.current || activeId === null) return;
    focusLetter.current = false;
    document.getElementById(headingId(activeId))?.closest<HTMLElement>("[role='tabpanel']")?.focus();
  }, [activeId, view]);

  // A refused or sent message has just left the queue: its final state takes
  // the focus the vanished buttons had.
  useEffect(() => {
    if (!showResolved) return;
    const active = document.activeElement;
    if (active === null || active === document.body) resolvedRef.current?.focus();
  }, [showResolved]);

  const summary = (
    <div aria-live="polite">
      {decision ? (
        <Alert tone="success" testId="decision-summary">
          {decision}
          {/* A send is ALWAYS simulated here: the confirmation says so with the badge too. */}
          {decision === TEXTS.successSent ? (
            <span className="mt-2 flex">
              <SimulationBadge />
            </span>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );

  if (messages.length === 0 && !showResolved) {
    return (
      <div className="flex flex-col gap-6">
        {summary}
        <EmptyState
          title={TEXTS.emptyTitle}
          description={TEXTS.emptyBody}
          action={
            <ButtonLink href="/contacts" variant="secondary">
              {TEXTS.emptyAction}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const back = (
    <a
      href={QUEUE_PATH}
      onClick={backToQueue}
      data-testid="back-to-queue"
      className="ui-focus mb-5 inline-flex w-fit items-center gap-1.5 rounded-xs text-sm font-medium text-ink-muted hover:text-ink xl:hidden"
    >
      <Glyph name="arrowLeft" width={16} />
      {TEXTS.backToQueue}
    </a>
  );

  return (
    <div className={styles.desk} data-view={view} data-testid="validation-desk">
      <div className={styles.queue}>
        <div className={styles.queueInner}>
          <h2 className="px-3 pt-1 pb-3 text-overline font-semibold text-ink-subtle uppercase">
            {TEXTS.queueHeading}
          </h2>
          {messages.length > 0 ? (
            <div role="tablist" aria-orientation="vertical" aria-label={TEXTS.queueLabel}>
              {messages.map((message, index) => (
                <MessageQueueItem
                  key={message.id}
                  ref={(node) => {
                    if (node) tabs.current.set(message.id, node);
                    else tabs.current.delete(message.id);
                  }}
                  message={message}
                  selected={message.id === activeId}
                  tabId={tabId(message.id)}
                  panelId={panelId(message.id)}
                  href={`${QUEUE_PATH}?message=${encodeURIComponent(message.id)}`}
                  focusable={message.id === focusableId}
                  onSelect={onTabClick(message.id)}
                  onKeyDown={onTabKeyDown(index)}
                />
              ))}
            </div>
          ) : (
            <div className="px-3 pb-2 text-sm text-ink-muted">
              <p className="font-semibold text-ink">{TEXTS.emptyTitle}</p>
              <ButtonLink href="/contacts" variant="secondary" size="sm" className="mt-4">
                {TEXTS.emptyAction}
              </ButtonLink>
            </div>
          )}
        </div>
      </div>

      <div className={styles.pane}>
        {summary}
        <div className={cn(decision ? "mt-6" : "")}>
          {messages.map((message) => (
            <div
              key={message.id}
              role="tabpanel"
              id={panelId(message.id)}
              aria-labelledby={tabId(message.id)}
              tabIndex={-1}
              hidden={message.id !== activeId}
              className="animate-rise-soft rounded-xs outline-none"
            >
              {back}
              <PendingMessageCard
                message={message}
                headingId={headingId(message.id)}
                onDecided={onDecided}
                onResolved={onResolved(message)}
              />
            </div>
          ))}
          {showResolved && resolved ? (
            <div>
              {back}
              <ResolvedMessage
                ref={resolvedRef}
                message={resolved.message}
                outcome={resolved.outcome}
                onNext={nextId ? () => select(nextId, true) : undefined}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
