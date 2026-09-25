"use client";

import { useId, type Ref } from "react";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS, CONSENT_STATUS_LABELS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { MESSAGE_STATUS_LABELS } from "@/features/contacts/types";

import type { PendingMessageView } from "../../types";
import type { MessageOutcome } from "./message-rail";
import { messageRailFor } from "./message-rail-view";
import { MessageDecisionRail } from "./MessageDecisionRail";
import { MessageLetterView } from "./MessageLetterView";

const TEXTS = APP_TEXTS.validationQueue;

export type ResolvedMessageProps = {
  /** The message as it was when the member decided (kept by the list). */
  message: PendingMessageView;
  /** What the server confirmed: refused, or sent (simulation). */
  outcome: Extract<MessageOutcome, "rejected" | "sent">;
  onNext?: () => void;
  ref?: Ref<HTMLElement>;
};

/**
 * A message that just left the queue, shown where it was decided on, in its
 * final state: stopped at « Vous » behind a stop mark (refused), or at the end
 * of its rail with the « Simulation » badge (sent). Nothing more can be done on
 * it — it is the end of the scene, not a card to act on.
 */
export function ResolvedMessage({ message, outcome, onNext, ref }: ResolvedMessageProps) {
  const titleId = useId();
  const rail = messageRailFor(message, outcome);
  const consentLabel = message.consentStatus ? CONSENT_STATUS_LABELS[message.consentStatus] : TEXTS.consentNone;
  const finalStatus = outcome === "sent" ? MESSAGE_STATUS_LABELS.sent_simulated : MESSAGE_STATUS_LABELS.rejected;

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-status`}
      data-testid="resolved-message"
      data-outcome={outcome}
      className="flex flex-col gap-6 rounded-xs outline-none"
    >
      <p className="sr-only">{TEXTS.resolvedLabel}</p>
      <MessageDecisionRail
        model={rail.model}
        label={TEXTS.railLabel}
        author={{
          ...rail.author,
          status: (
            <span>
              {TEXTS.receivedAt} <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
            </span>
          ),
        }}
        human={{
          name: TEXTS.railYou,
          status: rail.humanStatus,
          consent: (
            <>
              <span className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.consent}</span>
              <Badge tone={message.hasValidConsent ? "outline" : "solid"}>{consentLabel}</Badge>
            </>
          ),
        }}
        send={{ name: TEXTS.railSend, status: rail.sendStatus }}
      />

      <MessageLetterView
        message={message}
        recipient={message.contactName}
        recipientId={titleId}
        muted
        stamp={
          <>
            <span
              id={`${titleId}-status`}
              className="rounded-full border-2 border-ink bg-surface px-3 py-1 text-xs font-semibold text-ink"
            >
              {finalStatus}
            </span>
            {outcome === "sent" ? <SimulationBadge /> : null}
          </>
        }
        footnote={TEXTS.untrusted}
      />

      {onNext ? (
        <div className="flex">
          <Button variant="secondary" arrow="forward" onClick={onNext} data-testid="next-message">
            {TEXTS.nextMessage}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
