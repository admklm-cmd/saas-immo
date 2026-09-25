import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import styles from "./MessageLetter.module.css";

export type LetterChannel = "email" | "sms" | "whatsapp" | "phone";

export type MessageLetterProps = {
  channel: LetterChannel;
  /** French label of the channel (« Email », « SMS »…), never recomputed here. */
  channelLabel: string;
  /** Label of the recipient line (« À »). */
  toLabel: string;
  /** The recipient as already known by the page: a name, or a link to the file. */
  recipient: ReactNode;
  /** Heading level of the recipient, so the letter can title its panel. */
  recipientAs?: "h2" | "h3" | "p";
  recipientId?: string;
  subjectLabel?: string;
  subject?: string | null;
  /** The text exactly as stored, opt-out line included. Rendered as plain text. */
  body: string;
  /** Status, first-contact and simulation badges, on the letter's header. */
  badges?: ReactNode;
  /** One small line under the body (« Texte affiché tel quel… »). */
  footnote?: ReactNode;
  /** A handled message: the sheet steps back and a stamp says what became of it. */
  stamp?: ReactNode;
  muted?: boolean;
  className?: string;
  testId?: string;
};

/**
 * The message itself, drawn as what it will be (docs/design-system.md §3.1.3):
 * an email is a sheet (recipient, subject, body); an SMS or a WhatsApp message
 * is a bubble in a thread. Server-safe, no JavaScript.
 *
 * The body is plain text, always — never markup, never an instruction — and it
 * is shown in full: the opt-out line (« … répondez STOP ») is part of the
 * message and is never trimmed or restyled away.
 */
export function MessageLetter({
  channel,
  channelLabel,
  toLabel,
  recipient,
  recipientAs = "p",
  recipientId,
  subjectLabel,
  subject,
  body,
  badges,
  footnote,
  stamp,
  muted = false,
  className,
  testId,
}: MessageLetterProps) {
  const Recipient = recipientAs;
  const isThread = channel === "sms" || channel === "whatsapp";

  const header = (
    <header className={styles.head}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-overline font-semibold text-ink-subtle uppercase">{toLabel}</span>
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs font-medium text-ink-muted">
            {channelLabel}
          </span>
        </p>
        <Recipient id={recipientId} className="mt-1.5 text-heading font-semibold text-ink">
          {recipient}
        </Recipient>
      </div>
      {badges ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{badges}</div> : null}
    </header>
  );

  return (
    <div
      data-testid={testId}
      data-channel={channel}
      data-muted={muted || undefined}
      className={cn(styles.letter, isThread ? styles.thread : styles.sheet, className)}
    >
      {header}

      {isThread ? (
        <div className={styles.threadBody}>
          {/* Plain text, always: never markup, never an instruction. */}
          <p className={styles.bubble}>{body}</p>
        </div>
      ) : (
        <div className={styles.sheetBody}>
          {subject ? (
            <div className={styles.subject}>
              <span className="text-overline font-semibold text-ink-subtle uppercase">{subjectLabel}</span>
              <p className="mt-1 text-base font-semibold text-ink">{subject}</p>
            </div>
          ) : null}
          <p className={styles.text}>{body}</p>
        </div>
      )}

      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
      {stamp ? <div className={styles.stamp}>{stamp}</div> : null}
    </div>
  );
}
