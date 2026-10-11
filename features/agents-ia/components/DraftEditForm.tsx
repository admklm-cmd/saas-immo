"use client";

import { useEffect, useRef, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

import {
  DRAFT_BODY_MAX_LENGTH,
  DRAFT_SUBJECT_MAX_LENGTH,
  type PendingMessageView,
} from "../types";

const TEXTS = APP_TEXTS.validationQueue;

export type DraftEditFormProps = {
  message: PendingMessageView;
  onSave: (draft: { subject: string | null; body: string }) => void;
  onCancel: () => void;
  isPending: boolean;
};

/**
 * Correcting what an agent wrote, before anything goes out.
 *
 * Only the subject and the body are editable — the channel and the contact are
 * displayed elsewhere and never change here, because "correcting a sentence"
 * must not become "sending something else to somebody else". The server and the
 * database enforce that; this form simply does not offer it.
 */
export function DraftEditForm({ message, onSave, onCancel, isPending }: DraftEditFormProps) {
  const [subject, setSubject] = useState(message.subject ?? "");
  const [body, setBody] = useState(message.body);
  const firstField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  // A subject only exists on channels that carry one (email).
  const withSubject = message.channel === "email" || message.subject !== null;
  const canSave = body.trim().length > 0;

  return (
    <div
      data-testid="draft-edit-form"
      className="animate-fade mt-4 rounded-lg border border-line-strong bg-surface-muted p-4"
    >
      <p className="text-sm font-semibold text-ink">{TEXTS.editTitle}</p>
      <p className="mt-1 text-xs text-ink-muted">{TEXTS.editHint}</p>

      {withSubject ? (
        <Field
          label={TEXTS.editSubject}
          maxLength={DRAFT_SUBJECT_MAX_LENGTH}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-4"
        />
      ) : null}

      <Textarea
        ref={firstField}
        label={TEXTS.editBody}
        hint={TEXTS.editBodyHint(DRAFT_BODY_MAX_LENGTH)}
        maxLength={DRAFT_BODY_MAX_LENGTH}
        rows={8}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-4"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          isLoading={isPending}
          disabled={!canSave}
          onClick={() => onSave({ subject: subject.trim() === "" ? null : subject, body })}
          data-testid="draft-edit-save"
        >
          {isPending ? TEXTS.working : TEXTS.editSave}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          {TEXTS.cancel}
        </Button>
      </div>
    </div>
  );
}
