import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";

import { Alert } from "./Alert";
import { Button } from "./Button";

export type AnimatedErrorStateProps = {
  title: ReactNode;
  /** The message, already clear French (usually the server's, as-is). */
  children?: ReactNode;
  /**
   * Relaunches the SAME operation. Pass it only when a new attempt can really
   * succeed — a technical failure (see `isRetryableErrorCode`). Never for a
   * guard-rail refusal: those are `GuardRailNotice`, neutral information.
   */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  /** Hook for E2E tests; the retry button gets `${testId}-retry`. */
  testId?: string;
};

/**
 * The error of an action: the loader has stopped, red dots shake once and
 * then stay still, the message says what happened and « Réessayer » appears
 * only when retrying makes sense. `role="alert"` (from `Alert`) announces it
 * once, when it appears.
 */
export function AnimatedErrorState({
  title,
  children,
  onRetry,
  retryLabel = APP_TEXTS.states.retry,
  className,
  testId,
}: AnimatedErrorStateProps) {
  return (
    <Alert
      tone="error"
      title={title}
      className={className}
      testId={testId}
      action={
        onRetry ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            data-testid={testId ? `${testId}-retry` : undefined}
          >
            {retryLabel}
          </Button>
        ) : undefined
      }
    >
      {children}
    </Alert>
  );
}
