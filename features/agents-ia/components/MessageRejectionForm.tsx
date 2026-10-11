"use client";

import { useEffect, useRef, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

import {
  MESSAGE_REJECTION_NOTE_MAX_LENGTH,
  MESSAGE_REJECTION_REASON_LABELS,
  MESSAGE_REJECTION_REASONS,
  type MessageRejectionReason,
} from "../types";

const TEXTS = APP_TEXTS.validationQueue;

export type MessageRejectionFormProps = {
  /** Called with the motive and the optional note when the member confirms. */
  onConfirm: (rejection: { reason: MessageRejectionReason; note: string | null }) => void;
  onCancel: () => void;
  isPending: boolean;
};

/**
 * Why a draft is refused — a CLOSED list, plus an optional short note.
 *
 * The motive is required by the server (`invalid_reason` otherwise), so it is
 * required here too: the first motive is preselected, and the radio group is a
 * real `fieldset`/`legend` so it is announced as one question.
 */
export function MessageRejectionForm({ onConfirm, onCancel, isPending }: MessageRejectionFormProps) {
  const [reason, setReason] = useState<MessageRejectionReason>(MESSAGE_REJECTION_REASONS[0]);
  const [note, setNote] = useState("");
  const firstChoice = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstChoice.current?.focus();
  }, []);

  return (
    <div
      data-testid="rejection-form"
      className="animate-fade mt-4 rounded-lg border border-line-strong bg-surface-muted p-4"
    >
      <p className="text-sm font-semibold text-ink">{TEXTS.rejectTitle}</p>
      <p className="mt-1 text-xs text-ink-muted">{TEXTS.rejectHint}</p>

      <fieldset className="mt-4">
        <legend className="text-overline font-semibold text-ink-subtle uppercase">
          {TEXTS.rejectReasonLegend}
        </legend>
        <div className="mt-2 flex flex-col gap-1.5">
          {MESSAGE_REJECTION_REASONS.map((candidate, index) => (
            <label key={candidate} className="flex items-start gap-2 text-sm text-ink">
              <input
                ref={index === 0 ? firstChoice : undefined}
                type="radio"
                name="rejection-reason"
                value={candidate}
                checked={reason === candidate}
                onChange={() => setReason(candidate)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-inverse)]"
              />
              <span>{MESSAGE_REJECTION_REASON_LABELS[candidate]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Textarea
        label={TEXTS.rejectNote}
        hint={TEXTS.rejectNoteHint(MESSAGE_REJECTION_NOTE_MAX_LENGTH)}
        maxLength={MESSAGE_REJECTION_NOTE_MAX_LENGTH}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-4"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          isLoading={isPending}
          onClick={() => onConfirm({ reason, note: note.trim() === "" ? null : note })}
          data-testid="rejection-confirm"
        >
          {isPending ? TEXTS.working : TEXTS.rejectConfirm}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          {TEXTS.cancel}
        </Button>
      </div>
    </div>
  );
}
