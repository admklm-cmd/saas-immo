"use client";

import { useEffect } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Last-resort boundary of the signed-in space: never a raw stack trace. */
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Technical detail stays in the console, never in the interface.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <Alert
        tone="error"
        title={APP_TEXTS.states.errorTitle}
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            {APP_TEXTS.states.retry}
          </Button>
        }
      >
        {APP_TEXTS.states.unexpected}
      </Alert>
    </div>
  );
}
