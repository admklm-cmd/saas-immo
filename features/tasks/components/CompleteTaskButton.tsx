"use client";

import { useRef, useState, useTransition } from "react";

import { APP_TEXTS } from "@/components/texts";
import { AnimatedErrorState } from "@/components/ui/AnimatedErrorState";
import { Button } from "@/components/ui/Button";
import { isRetryableErrorCode } from "@/components/ui/retryable";
import { completeTask } from "@/features/tasks/actions";

import { useTaskCompletion } from "./TaskCompletionProvider";

const TEXTS = APP_TEXTS.tasks;

export type CompleteTaskButtonProps = {
  taskId: string;
  /** Plain text, only used to give each button a distinct accessible name. */
  taskTitle: string;
};

/**
 * « Marquer comme faite » — the only client-side piece of a task row.
 *
 * No double submission: a ref blocks a second call before React has even
 * re-rendered the disabled button, and the button stays disabled once the
 * task is closed (the row then leaves the list on refresh). The server
 * re-checks everything; its French message is displayed as-is.
 */
export function CompleteTaskButton({ taskId, taskTitle }: CompleteTaskButtonProps) {
  const { announce } = useTaskCompletion();
  const [isPending, startTransition] = useTransition();
  const [isClosed, setIsClosed] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const inFlight = useRef(false);

  function onClick() {
    if (inFlight.current || isClosed) return;
    inFlight.current = true;
    setError(null);

    startTransition(async () => {
      try {
        const result = await completeTask(taskId);
        if (result.data) {
          setIsClosed(true);
          announce({ tone: "success", message: TEXTS.completed(taskTitle) });
          return;
        }
        if (result.error.code === "task_already_done") {
          // Someone (or a double click) closed it already: information, not an alarm.
          setIsClosed(true);
          announce({ tone: "info", message: result.error.message });
          return;
        }
        setError({ message: result.error.message, retryable: isRetryableErrorCode(result.error.code) });
      } catch {
        setError({ message: APP_TEXTS.states.unexpected, retryable: true });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:items-end">
      <Button
        variant="secondary"
        size="sm"
        onClick={onClick}
        isLoading={isPending}
        disabled={isClosed}
        data-testid="complete-task"
      >
        {isPending ? TEXTS.completing : TEXTS.complete}
        <span className="sr-only"> {TEXTS.completeFor(taskTitle)}</span>
      </Button>
      {error ? (
        <AnimatedErrorState
          title={TEXTS.completeErrorTitle}
          className="w-full sm:max-w-xs"
          testId="complete-task-error"
          onRetry={error.retryable ? onClick : undefined}
        >
          {error.message}
        </AnimatedErrorState>
      ) : null}
    </div>
  );
}
