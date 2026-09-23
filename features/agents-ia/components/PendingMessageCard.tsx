"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS, CONSENT_STATUS_LABELS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { MotionDots } from "@/components/ui/MotionDots";
import {
  editDraft,
  refuseMessage,
  sendValidatedMessage,
  validateMessage,
} from "@/features/agents-ia/actions";

import { MESSAGE_REJECTION_REASON_LABELS, type PendingMessageView } from "../types";
import { DraftEditForm } from "./DraftEditForm";
import { MessageRejectionForm } from "./MessageRejectionForm";

const TEXTS = APP_TEXTS.validationQueue;

type CardState =
  | { kind: "idle" }
  | { kind: "rejecting" }
  | { kind: "editing" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

export type PendingMessageCardProps = {
  message: PendingMessageView;
  /** Announced by the list, which also refreshes the server data. */
  onDecided: (summary: string) => void;
};

/**
 * One draft waiting for a human decision.
 *
 * Product rule made visible (CLAUDE.md): **nothing is sent by an agent**.
 * Validating is not sending — the two are separate clicks — and "envoyer"
 * means a simulated send, said in as many words.
 *
 * `canBeSent` only greys a button out: the server re-reads the consent of the
 * channel at the moment of the send, and the database checks it again.
 */
export function PendingMessageCard({ message, onDecided }: PendingMessageCardProps) {
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const titleId = useId();

  const consentLabel = message.consentStatus
    ? CONSENT_STATUS_LABELS[message.consentStatus]
    : TEXTS.consentNone;

  async function run(action: () => Promise<{ error: { message: string } | null }>, summary: string) {
    setState({ kind: "pending" });
    try {
      const { error } = await action();
      if (error) {
        // The server message is already French and already precise.
        setState({ kind: "error", message: error.message });
        return;
      }
      setState({ kind: "idle" });
      onDecided(summary);
    } catch {
      setState({ kind: "error", message: APP_TEXTS.states.unexpected });
    }
  }

  const busy = state.kind === "pending";

  return (
    <article
      aria-labelledby={titleId}
      data-testid="pending-message"
      data-status={message.status}
      className="animate-rise rounded-xl border border-line bg-surface p-6 shadow-subtle"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={titleId} className="text-heading font-semibold text-ink">
            <Link href={`/contacts/${message.contactId}`} className="rounded-xs hover:underline">
              {message.contactName}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {message.createdByAgentLabel
              ? TEXTS.preparedBy(message.createdByAgentLabel)
              : TEXTS.writtenByHuman}{" "}
            · {TEXTS.receivedAt} <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge tone="outline">{message.channelLabel}</Badge>
          <Badge tone={message.status === "approved" ? "solid" : "neutral"} icon={message.status === "pending_validation" && !busy ? <MotionDots kind="pending" /> : undefined}>{message.statusLabel}</Badge>
          {message.isFirstContact ? <Badge tone="dashed">{TEXTS.firstContact}</Badge> : null}
          {message.isSimulation ? <SimulationBadge /> : null}
        </div>
      </header>

      <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.consent}</span>
        <Badge tone={message.hasValidConsent ? "outline" : "solid"}>{consentLabel}</Badge>
      </p>
      {message.hasValidConsent ? null : (
        <p className="mt-1.5 text-sm font-medium text-ink">{TEXTS.consentBlocked}</p>
      )}

      <figure className="mt-4 rounded-lg border border-line bg-surface-muted p-4">
        {message.subject ? (
          <figcaption className="text-sm font-semibold text-ink">
            <span className="text-overline font-semibold text-ink-subtle uppercase">
              {TEXTS.subject}
            </span>
            <span className="mt-1 block">{message.subject}</span>
          </figcaption>
        ) : (
          <figcaption className="text-overline font-semibold text-ink-subtle uppercase">
            {TEXTS.body}
          </figcaption>
        )}
        {/* Plain text, always: never markup, never an instruction. */}
        <p className="mt-2 text-sm whitespace-pre-line text-ink">{message.body}</p>
        <p className="mt-3 text-xs text-ink-subtle">{TEXTS.untrusted}</p>
      </figure>

      {message.status === "approved" ? (
        <p className="mt-3 text-sm text-ink-muted">{TEXTS.approvedNotSent}</p>
      ) : null}

      {state.kind === "rejecting" ? (
        <MessageRejectionForm
          isPending={busy}
          onCancel={() => setState({ kind: "idle" })}
          onConfirm={(rejection) =>
            void run(
              () => refuseMessage(message.id, rejection),
              TEXTS.successRejected(MESSAGE_REJECTION_REASON_LABELS[rejection.reason]),
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
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {message.status === "pending_validation" ? (
            <>
              <Button
                isLoading={busy}
                onClick={() => void run(() => validateMessage(message.id), TEXTS.successValidated)}
                data-testid="validate-message"
              >
                {busy ? TEXTS.working : TEXTS.validate}
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
              onClick={() => void run(() => sendValidatedMessage(message.id), TEXTS.successSent)}
              data-testid="send-message"
            >
              {busy ? TEXTS.working : TEXTS.send}
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
          {message.status === "approved" && !message.canBeSent ? (
            <p className="text-xs text-ink-muted">{TEXTS.sendBlocked}</p>
          ) : null}
        </div>
      )}

      <div aria-live="polite">
        {state.kind === "error" ? (
          <Alert tone="error" title={TEXTS.actionErrorTitle} className="mt-4" testId="message-action-error">
            {state.message}
          </Alert>
        ) : null}
      </div>
    </article>
  );
}
