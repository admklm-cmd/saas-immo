import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";

import type { PendingMessageView } from "../../types";
import { MessageLetter } from "../flow/MessageLetter";

const TEXTS = APP_TEXTS.validationQueue;

export type MessageLetterViewProps = {
  message: PendingMessageView;
  recipient: ReactNode;
  recipientId?: string;
  badges?: ReactNode;
  footnote?: ReactNode;
  stamp?: ReactNode;
  muted?: boolean;
};

/** A draft of the validation queue as a letter: the queue's labels on `MessageLetter`. */
export function MessageLetterView({ message, recipient, recipientId, badges, footnote, stamp, muted }: MessageLetterViewProps) {
  return (
    <MessageLetter
      channel={message.channel}
      channelLabel={message.channelLabel}
      toLabel={TEXTS.to}
      recipient={recipient}
      recipientAs="h2"
      recipientId={recipientId}
      subjectLabel={TEXTS.subject}
      subject={message.subject}
      body={message.body}
      badges={badges}
      footnote={footnote}
      stamp={stamp}
      muted={muted}
      testId="message-letter"
    />
  );
}
