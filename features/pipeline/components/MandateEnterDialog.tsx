"use client";

import { useId, useState, type RefObject } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";

const TEXTS = APP_TEXTS.pipeline.stageChange;

export type MandateEnterDialogProps = {
  contactName: string;
  /** French label of the stage the contact leaves. */
  fromLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  /** `mandateConfirmed` is exactly the state of the box the user ticked. */
  onConfirm: (mandateConfirmed: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

/**
 * Entering « Mandat signé » — a human decision, never an AI agent's.
 *
 * The box starts unticked (a positive act is required) and the confirm button
 * stays disabled until it is ticked; the server refuses anyway without it.
 */
export function MandateEnterDialog({
  contactName,
  fromLabel,
  pending,
  error,
  onCancel,
  onConfirm,
  returnFocusRef,
}: MandateEnterDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const blockedId = useId();

  return (
    <Dialog
      open
      onClose={onCancel}
      dismissible={!pending}
      returnFocusRef={returnFocusRef}
      testId="mandate-enter-dialog"
      title={TEXTS.enterTitle}
      description={TEXTS.enterSummary(contactName, fromLabel)}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {TEXTS.cancel}
          </Button>
          <Button
            onClick={() => onConfirm(confirmed)}
            disabled={!confirmed}
            isLoading={pending}
            aria-describedby={confirmed ? undefined : blockedId}
          >
            {TEXTS.enterSubmit}
          </Button>
        </>
      }
    >
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-muted">
        {TEXTS.enterHumanRule}
      </p>

      <Checkbox
        label={TEXTS.enterCheckbox}
        checked={confirmed}
        onChange={setConfirmed}
        disabled={pending}
        testId="mandate-enter-confirm"
      />

      {confirmed ? null : (
        <p id={blockedId} className="text-xs text-ink-subtle">
          {TEXTS.enterBlocked}
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
