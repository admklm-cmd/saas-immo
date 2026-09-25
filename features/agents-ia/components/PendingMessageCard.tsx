"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS, CONSENT_STATUS_LABELS } from "@/components/texts";
import { AnimatedErrorState } from "@/components/ui/AnimatedErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { PendingDots } from "@/components/ui/PendingDots";
import { isRetryableErrorCode } from "@/components/ui/retryable";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { useSingleFlight } from "@/components/ui/use-single-flight";
import {
  editDraft,
  refuseMessage,
  sendValidatedMessage,
  validateMessage,
} from "@/features/agents-ia/actions";

import { MESSAGE_REJECTION_REASON_LABELS, type PendingMessageView } from "../types";
import { DraftEditForm } from "./DraftEditForm";
import { MessageRejectionForm } from "./MessageRejectionForm";
import { MessageDecisionRail } from "./validation/MessageDecisionRail";
import { type MessageOutcome } from "./validation/message-rail";
import { MessageLetterView } from "./validation/MessageLetterView";
import { messageRailFor } from "./validation/message-rail-view";

const TEXTS = APP_TEXTS.validationQueue;

type CardState =
  | { kind: "idle" }
  | { kind: "rejecting" }
  | { kind: "editing" }
  | { kind: "pending"; action: "send" | "other" }
  | { kind: "error"; message: string; retryable: boolean };

type Attempt = {
  action: () => Promise<{ error: { code: string; message: string } | null }>;
  summary: string;
  kind: "send" | "other";
  outcome: MessageOutcome | null;
};

export type PendingMessageCardProps = {
  message: PendingMessageView;
  /** Announced by the list, which also refreshes the server data. */
  onDecided: (summary: string) => void;
  /**
   * Called just before `onDecided` when the server confirmed a decision that
   * moves the message on its rail (validated, refused, sent) — never for a
   * correction, never on an error.
   */
  onResolved?: (outcome: MessageOutcome) => void;
  /** Id of the panel heading (the recipient), for the tab that controls it. */
  headingId?: string;
  className?: string;
};

/**
 * One draft waiting for a human decision, drawn as the message it will be:
 * its rail (« Préparé par … → Vous → Envoi (simulation) »), the letter, and
 * the decision bar (docs/design-system.md §3.1.1).
 *
 * Product rule made visible (CLAUDE.md): **nothing is sent by an agent**.
 * Validating is not sending — the two are separate clicks — and "envoyer"
 * means a simulated send, said in as many words.
 *
 * `canBeSent` only greys a button out: the server re-reads the consent of the
 * channel at the moment of the send, and the database checks it again.
 */
export function PendingMessageCard({ message, onDecided, onResolved, headingId, className }: PendingMessageCardProps) {
  const [state, setState] = useState<CardState>({ kind: "idle" });
  // The outcome the server confirmed, until the re-read of the queue catches
  // up: only valid while the recorded status is still the one decided on.
  const [settled, setSettled] = useState<{ from: PendingMessageView["status"]; outcome: MessageOutcome } | null>(
    null,
  );
  const fallbackId = useId();
  const titleId = headingId ?? fallbackId;
  const singleFlight = useSingleFlight();
  // The last attempt, so « Réessayer » relaunches exactly the same decision.
  const lastAttempt = useRef<Attempt | null>(null);

  const outcome = settled && settled.from === message.status ? settled.outcome : null;
  const rail = messageRailFor(message, outcome);
  const stage = rail.model.stage;

  const consentLabel = message.consentStatus
    ? CONSENT_STATUS_LABELS[message.consentStatus]
    : TEXTS.consentNone;

  async function run(
    action: Attempt["action"],
    summary: string,
    kind: Attempt["kind"] = "other",
    decided: MessageOutcome | null = null,
  ) {
    await singleFlight(async () => {
      lastAttempt.current = { action, summary, kind, outcome: decided };
      setState({ kind: "pending", action: kind });
      try {
        const { error } = await action();
        if (error) {
          // The server message is already French and already precise.
          setState({ kind: "error", message: error.message, retryable: isRetryableErrorCode(error.code) });
          return;
        }
        setState({ kind: "idle" });
        if (decided) {
          setSettled({ from: message.status, outcome: decided });
          onResolved?.(decided);
        }
        onDecided(summary);
      } catch {
        setState({ kind: "error", message: APP_TEXTS.states.unexpected, retryable: true });
      }
    });
  }

  function retry() {
    const attempt = lastAttempt.current;
    if (attempt) void run(attempt.action, attempt.summary, attempt.kind, attempt.outcome);
  }

  const busy = state.kind === "pending";
  const busyLabel = state.kind === "pending" && state.action === "send" ? TEXTS.sending : TEXTS.working;
  const handled = stage === "rejected" || stage === "sent";

  return (
    <article
      aria-labelledby={titleId}
      data-testid="pending-message"
      data-sensitive=""
      data-status={message.status}
      aria-busy={busy || undefined}
      className={cn("flex flex-col gap-6", className)}
    >
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
          status: (
            <>
              {/* Passive wait for a human: the words say it, the dots only
                  show that nothing moves until someone decides. Hidden while a
                  decision is really being recorded. */}
              {stage === "awaiting" && !busy ? <PendingDots label={null} /> : null}
              {rail.humanStatus}
            </>
          ),
          consent: (
            <>
              <span className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.consent}</span>
              <Badge tone={message.hasValidConsent ? "outline" : "solid"}>{consentLabel}</Badge>
            </>
          ),
        }}
        send={{ name: TEXTS.railSend, status: rail.sendStatus }}
      />

      {message.hasValidConsent ? null : (
        <p className="-mt-2 text-center text-sm font-medium text-pretty text-ink">{TEXTS.consentBlocked}</p>
      )}

      <MessageLetterView
        message={message}
        recipientId={titleId}
        recipient={
          <Link href={`/contacts/${message.contactId}`} className="ui-focus rounded-xs hover:underline">
            {message.contactName}
          </Link>
        }
        badges={
          <>
            {message.isFirstContact ? <Badge tone="dashed">{TEXTS.firstContact}</Badge> : null}
            {message.isSimulation ? <SimulationBadge /> : null}
          </>
        }
        footnote={TEXTS.untrusted}
      />

      {handled ? null : state.kind === "rejecting" ? (
        <MessageRejectionForm
          isPending={busy}
          onCancel={() => setState({ kind: "idle" })}
          onConfirm={(rejection) =>
            void run(
              () => refuseMessage(message.id, rejection),
              TEXTS.successRejected(MESSAGE_REJECTION_REASON_LABELS[rejection.reason]),
              "other",
              "rejected",
            )
          }
        />
      ) : state.kind === "editing" ? (
        <DraftEditForm
          message={message}
          isPending={busy}
          onCancel={() => setState({ kind: "idle" })}
          onSave={(draft) =>
            void run(
              () => editDraft(message.id, draft),
              // Editing an approved draft cancels its approval: say it.
              message.status === "approved" ? TEXTS.editSuccessRevalidation : TEXTS.editSuccess,
            )
          }
        />
      ) : (
        <div
          data-testid="decision-bar"
          className="sticky bottom-3 z-10 -mx-1 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl border border-line bg-surface/90 p-2 shadow-raised backdrop-blur-md sm:gap-x-3 sm:p-3"
        >
          {message.status === "pending_validation" && !outcome ? (
            <>
              <Button
                isLoading={busy}
                onClick={() => void run(() => validateMessage(message.id), TEXTS.successValidated, "other", "validated")}
                data-testid="validate-message"
              >
                {busy ? busyLabel : TEXTS.validate}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setState({ kind: "rejecting" })}
                data-testid="refuse-message"
              >
                {TEXTS.refuse}
              </Button>
            </>
          ) : (
            <Button
              isLoading={busy}
              disabled={!message.canBeSent}
              onClick={() => void run(() => sendValidatedMessage(message.id), TEXTS.successSent, "send", "sent")}
              data-testid="send-message"
            >
              {busy ? busyLabel : TEXTS.send}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setState({ kind: "editing" })}
            data-testid="edit-message"
          >
            {TEXTS.edit}
          </Button>
          {stage === "approved" ? (
            <p className="min-w-0 flex-1 basis-56 text-xs text-pretty text-ink-muted sm:text-right">
              <span className="font-medium text-ink">{TEXTS.approvedNotSent}</span>
              {!message.canBeSent && !outcome ? <span className="mt-0.5 block">{TEXTS.sendBlocked}</span> : null}
            </p>
          ) : null}
        </div>
      )}

      <div aria-live="polite">
        {state.kind === "error" ? (
          <AnimatedErrorState
            title={TEXTS.actionErrorTitle}
            testId="message-action-error"
            onRetry={state.retryable ? retry : undefined}
          >
            {state.message}
          </AnimatedErrorState>
        ) : null}
      </div>
    </article>
  );
}
