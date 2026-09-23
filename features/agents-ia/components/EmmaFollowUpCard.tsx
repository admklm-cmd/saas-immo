"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { AnimatedErrorState } from "@/components/ui/AnimatedErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { useSingleFlight } from "@/components/ui/use-single-flight";
import { prepareFollowUp } from "@/features/agents-ia/emma-relation/actions";
import { CONSENT_CHANNEL_LABELS, PIPELINE_STAGE_LABELS } from "@/features/contacts/types";

import type { EmmaFollowUpCandidateView } from "../types";
import { AgentRunReplay } from "./AgentRunReplay";
import { GuardRailNotice } from "./GuardRailNotice";
import { refusalUiState } from "./refusal-ui-state";
import { replayStepsFromRecorded } from "./replay";

const TEXTS = APP_TEXTS.emmaFollowUps;

type EmmaResult = NonNullable<Awaited<ReturnType<typeof prepareFollowUp>>["data"]>;

type CardState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: EmmaResult }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "blocked"; message: string };

/**
 * French reason shown next to a disabled action. Display convenience only: the
 * server action rechecks every one of these conditions at click time, so this
 * mapping never carries a business rule of its own.
 */
function blockedReasonText(reason: EmmaFollowUpCandidateView["blockedReason"]): string | null {
  switch (reason) {
    case "human_takeover":
      return TEXTS.humanTakeover;
    case "pending_draft":
      return TEXTS.pendingDraft;
    case "consent_or_channel_missing":
      return TEXTS.consentOrChannelMissing;
    default:
      return null;
  }
}

export function EmmaFollowUpCard({ candidate }: { candidate: EmmaFollowUpCandidateView }) {
  const router = useRouter();
  const titleId = useId();
  const reasonId = useId();
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const singleFlight = useSingleFlight();

  function run() {
    return singleFlight(execute);
  }

  async function execute() {
    setState({ kind: "running" });
    try {
      const { data, error } = await prepareFollowUp(candidate.id);
      if (error) {
        // A guard rail (signed mandate, consent, one per day…) is not an error.
        setState(refusalUiState(error));
        return;
      }
      setState({ kind: "done", result: data });
      router.refresh();
    } catch {
      setState({ kind: "error", message: APP_TEXTS.states.unexpected, retryable: true });
    }
  }

  const result = state.kind === "done" ? state.result : null;
  const reason = blockedReasonText(candidate.blockedReason);

  return (
    <article
      aria-labelledby={titleId}
      data-testid="emma-follow-up"
      aria-busy={state.kind === "running" || undefined}
      className="rounded-xl border border-line bg-surface p-6 shadow-subtle"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-heading font-semibold text-ink">
            {candidate.contactName}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {TEXTS.cardStage} : {PIPELINE_STAGE_LABELS[candidate.stage]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">Emma</Badge>
          <SimulationBadge />
        </div>
      </header>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.cardContact}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {candidate.email ? <Badge tone="neutral">{TEXTS.emailAvailable}</Badge> : null}
          {candidate.phone ? <Badge tone="neutral">{TEXTS.phoneAvailable}</Badge> : null}
          {!candidate.email && !candidate.phone ? (
            <Badge tone="outline">{TEXTS.noReachableDetail}</Badge>
          ) : null}
          {candidate.channel ? (
            <Badge tone="outline" title={TEXTS.channel}>
              {CONSENT_CHANNEL_LABELS[candidate.channel]}
            </Badge>
          ) : null}
          {candidate.humanTakeover ? <Badge tone="outline">{TEXTS.humanTakeover}</Badge> : null}
          {candidate.hasPendingEmmaDraft ? <Badge tone="outline">{TEXTS.pendingDraft}</Badge> : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          isLoading={state.kind === "running"}
          onClick={() => void run()}
          disabled={!candidate.canPrepare}
          aria-describedby={!candidate.canPrepare ? reasonId : undefined}
          data-testid="run-emma"
        >
          {state.kind === "running" ? TEXTS.running : TEXTS.run}
        </Button>
        <Link
          href={`/contacts/${candidate.id}`}
          className="rounded-xs text-sm underline underline-offset-2 hover:text-ink-muted"
        >
          {TEXTS.openContact}
        </Link>
      </div>
      {candidate.canPrepare ? (
        <p className="mt-2 text-xs text-ink-muted">{TEXTS.runHint}</p>
      ) : (
        <p id={reasonId} className="mt-2 text-xs text-ink-muted" data-testid="emma-blocked-reason">
          {reason}
          {candidate.blockedReason === "pending_draft" ? (
            <>
              {" "}
              <Link href="/agents-ia/a-valider" className="underline underline-offset-2 hover:text-ink">
                {TEXTS.openQueue}
              </Link>
            </>
          ) : null}
        </p>
      )}

      <div aria-live="polite">
        {state.kind === "error" ? (
          <AnimatedErrorState
            title={TEXTS.errorActionTitle}
            className="mt-4"
            testId="emma-error"
            onRetry={state.retryable ? () => void run() : undefined}
          >
            {state.message}
          </AnimatedErrorState>
        ) : null}

        {state.kind === "blocked" ? (
          <GuardRailNotice reason={state.message} className="mt-4" testId="emma-blocked" />
        ) : null}

        {result ? (
          <Alert tone="success" title={TEXTS.successTitle} className="mt-4" testId="emma-result">
            <p>{result.decisionText}</p>
            <p className="mt-2 font-medium">{TEXTS.nothingSent}</p>
          </Alert>
        ) : null}
      </div>

      {result ? (
        <>
          <section className="mt-4 rounded-lg border border-line bg-surface-muted p-4" data-testid="emma-draft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{TEXTS.draftBody}</h3>
              <Badge tone="outline">{result.channel.toUpperCase()}</Badge>
            </div>
            {result.messageSubject ? (
              <p className="mt-3 text-sm text-ink">
                <span className="font-semibold">{TEXTS.draftSubject} :</span> {result.messageSubject}
              </p>
            ) : null}
            <p className="mt-3 text-sm whitespace-pre-line text-ink">{result.messageBody}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <ButtonLink href="/agents-ia/a-valider" size="sm">
                {TEXTS.openQueue}
              </ButtonLink>
              <ButtonLink href={`/agents-ia/executions/${result.runId}`} variant="ghost" size="sm">
                {TEXTS.viewReplay}
              </ButtonLink>
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-line bg-surface-muted p-4" data-testid="emma-replay">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{APP_TEXTS.replay.title}</h3>
              {result.isSimulation ? <SimulationBadge /> : null}
            </div>
            <p className="mt-1 mb-4 text-xs text-ink-muted">{APP_TEXTS.replay.subtitle}</p>
            <AgentRunReplay key={result.runId} steps={replayStepsFromRecorded(result.runId, result.steps)} />
          </section>
        </>
      ) : null}
    </article>
  );
}
