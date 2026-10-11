"use client";

import { useId, useState, type RefObject } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { STAGE_CHANGE_REASON_MAX_LENGTH, STAGE_CHANGE_REASON_MIN_LENGTH } from "@/features/pipeline/types";

const TEXTS = APP_TEXTS.pipeline.stageChange;

export type MandateExitDialogProps = {
  contactName: string;
  /** French label of the stage the contact goes to. */
  toLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (mandateConfirmed: boolean, reason: string) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

/**
 * Leaving « Mandat signé » — reserved to a director (the database refuses any
 * other role), with an explicit confirmation and a recorded motive.
 *
 * The motive bounds mirror the server (`STAGE_CHANGE_REASON_*_LENGTH`) only to
 * guide the user; the server validates it again and stores it verbatim.
 */
export function MandateExitDialog({
  contactName,
  toLabel,
  pending,
  error,
  onCancel,
  onConfirm,
  returnFocusRef,
}: MandateExitDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const blockedId = useId();

  const trimmedLength = reason.trim().length;
  const reasonValid =
    trimmedLength >= STAGE_CHANGE_REASON_MIN_LENGTH && trimmedLength <= STAGE_CHANGE_REASON_MAX_LENGTH;
  const ready = confirmed && reasonValid;

  return (
    <Dialog
      open
      onClose={onCancel}
      dismissible={!pending}
      returnFocusRef={returnFocusRef}
      testId="mandate-exit-dialog"
      title={TEXTS.exitTitle}
      description={TEXTS.exitSummary(contactName, toLabel)}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {TEXTS.cancel}
          </Button>
          <Button
            onClick={() => onConfirm(confirmed, reason)}
            disabled={!ready}
            isLoading={pending}
            aria-describedby={ready ? undefined : blockedId}
          >
            {TEXTS.exitSubmit}
          </Button>
        </>
      }
    >
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-muted">
        {TEXTS.exitRule}
      </p>

      <Checkbox
        label={TEXTS.exitCheckbox}
        checked={confirmed}
        onChange={setConfirmed}
        disabled={pending}
        testId="mandate-exit-confirm"
      />

      <div>
        <Textarea
          label={TEXTS.reasonLabel}
          hint={TEXTS.reasonHint}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={STAGE_CHANGE_REASON_MAX_LENGTH}
          required
          disabled={pending}
          rows={3}
          data-testid="mandate-exit-reason"
        />
        <p data-testid="mandate-exit-reason-counter" className="mt-1.5 text-right text-xs text-ink-subtle tabular-nums">
          {TEXTS.reasonCounter(reason.length, STAGE_CHANGE_REASON_MAX_LENGTH)}
        </p>
      </div>

      {ready ? null : (
        <p id={blockedId} className="text-xs text-ink-subtle">
          {TEXTS.exitBlocked}
        </p>
      )}

      {error ? (
        <Alert tone="error" title={TEXTS.errorTitle} testId="stage-change-error">
          {error}
        </Alert>
      ) : null}
    </Dialog>
  );
}
