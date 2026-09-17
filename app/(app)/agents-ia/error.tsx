"use client";

import { useEffect } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * Boundary of the "Agents IA" module: a failure here must never look like
 * "no activity". The user is told, and offered a way forward.
 */
export default function AgentsIaError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Technical detail stays in the console, never in the interface.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <Alert
        tone="error"
        title={APP_TEXTS.agentsIa.overviewErrorTitle}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={reset}>
              {APP_TEXTS.states.retry}
            </Button>
            <ButtonLink href="/contacts" variant="secondary" size="sm">
              {APP_TEXTS.nav.contacts}
            </ButtonLink>
          </div>
        }
      >
        {APP_TEXTS.states.unexpected}
      </Alert>
    </div>
  );
}
