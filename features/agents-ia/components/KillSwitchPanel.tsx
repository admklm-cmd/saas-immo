"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { AnimatedErrorState } from "@/components/ui/AnimatedErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isRetryableErrorCode } from "@/components/ui/retryable";
import { useSingleFlight } from "@/components/ui/use-single-flight";
import { setAgencyAiPaused } from "@/features/agents-ia/actions";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.killSwitch;

type PanelState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "pending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string; retryable: boolean };

export type KillSwitchPanelProps = {
  /** Current state of the agency kill switch, read server-side. */
  paused: boolean;
  /** False when the caller may not resume: only a director may. */
  canResume: boolean;
  /** Heading level of the panel title: 3 when it sits under a section heading (`/parametres`). */
  headingLevel?: 2 | 3;
};

/**
 * The agency kill switch — a safety control, not a setting.
 *
 * Any member may suspend the five agents; **only a director may resume them**,
 * and that rule is held by the database function, not by this panel: the button
 * is disabled with an explanation, and the server refuses anyway.
 *
 * Both directions ask for a confirmation: suspending stops work that is in
 * preparation, resuming lets automatic executions start again.
 */
export function KillSwitchPanel({ paused, canResume, headingLevel = 2 }: KillSwitchPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const confirmRef = useRef<HTMLButtonElement>(null);
  const singleFlight = useSingleFlight();

  useEffect(() => {
    if (state.kind === "confirming") confirmRef.current?.focus();
  }, [state.kind]);

  const next = !paused;
  const resumeBlocked = paused && !canResume;

  // « Réessayer » re-applies the SAME confirmed intent: `next` only changes
  // once the server has actually switched.
  function apply() {
    return singleFlight(execute);
  }

  async function execute() {
    setState({ kind: "pending" });
    try {
      const { data, error } = await setAgencyAiPaused(next);
      if (error) {
        // The server message is already in French and already precise.
        setState({ kind: "error", message: error.message, retryable: isRetryableErrorCode(error.code) });
        return;
      }
      setState({ kind: "done", message: data.aiPaused ? TEXTS.pausedSuccess : TEXTS.resumedSuccess });
      // Re-renders the server components: badges, figures and history.
      router.refresh();
    } catch {
      setState({ kind: "error", message: APP_TEXTS.states.unexpected, retryable: true });
    }
  }

  return (
    <Card
      title={TEXTS.title}
      description={paused ? TEXTS.descriptionPaused : TEXTS.descriptionRunning}
      actions={
        <Badge tone={paused ? "solid" : "outline"}>{paused ? TEXTS.paused : TEXTS.running}</Badge>
      }
      testId="kill-switch"
      headingLevel={headingLevel}
    >
      {state.kind === "confirming" ? (
        <div data-testid="kill-switch-confirm" className="animate-fade rounded-lg border border-line-strong bg-surface-muted p-4">
          <p className="text-sm font-semibold text-ink">
            {paused ? TEXTS.confirmResumeTitle : TEXTS.confirmPauseTitle}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {paused ? TEXTS.confirmResumeBody : TEXTS.confirmPauseBody}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button ref={confirmRef} onClick={() => void apply()}>
              {TEXTS.confirm}
            </Button>
            <Button variant="ghost" onClick={() => setState({ kind: "idle" })}>
              {TEXTS.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={paused ? "primary" : "secondary"}
            isLoading={state.kind === "pending"}
            disabled={resumeBlocked}
            onClick={() => setState({ kind: "confirming" })}
            data-testid="kill-switch-toggle"
          >
            {state.kind === "pending" ? TEXTS.pending : paused ? TEXTS.resume : TEXTS.pause}
          </Button>
          {resumeBlocked ? (
            <p className="text-xs text-ink-muted">{AGENT_ERROR_MESSAGES.only_director_can_resume_ai}</p>
          ) : null}
        </div>
      )}

      <div aria-live="polite">
        {state.kind === "error" ? (
          <AnimatedErrorState
            title={TEXTS.errorTitle}
            className="mt-4"
            testId="kill-switch-error"
            onRetry={state.retryable ? () => void apply() : undefined}
          >
            {state.message}
          </AnimatedErrorState>
        ) : null}
        {state.kind === "done" ? (
          <Alert tone="success" className="mt-4" testId="kill-switch-success">
            {state.message}
          </Alert>
        ) : null}
      </div>
    </Card>
  );
}
