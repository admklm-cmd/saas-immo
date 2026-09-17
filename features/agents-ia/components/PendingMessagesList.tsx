"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";

import type { PendingMessageView } from "../types";
import { PendingMessageCard } from "./PendingMessageCard";

const TEXTS = APP_TEXTS.validationQueue;

/**
 * The queue itself.
 *
 * Client component for one reason only: after a decision, the card disappears
 * from the server-rendered list, and the confirmation has to survive that
 * refresh. It is held here, in a polite live region, so the member always
 * reads what was decided — including "rien n'a été envoyé".
 */
export function PendingMessagesList({ messages }: { messages: readonly PendingMessageView[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState<string | null>(null);

  const onDecided = useCallback(
    (summary: string) => {
      setDecision(summary);
      // Re-reads the queue server-side: a handled draft leaves the list.
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        {decision ? (
          <Alert tone="success" testId="decision-summary">
            {decision}
          </Alert>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title={TEXTS.emptyTitle}
          description={TEXTS.emptyBody}
          action={
            <ButtonLink href="/contacts" variant="secondary">
              {TEXTS.emptyAction}
            </ButtonLink>
          }
        />
      ) : (
        messages.map((message) => (
          <PendingMessageCard key={message.id} message={message} onDecided={onDecided} />
        ))
      )}
    </div>
  );
}
