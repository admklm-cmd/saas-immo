"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { AnimatedErrorState } from "@/components/ui/AnimatedErrorState";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/components/ui/cn";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { useSingleFlight } from "@/components/ui/use-single-flight";
import { prepareFollowUp } from "@/features/agents-ia/emma-relation/actions";
import { CONSENT_CHANNEL_LABELS, PIPELINE_STAGE_LABELS } from "@/features/contacts/types";

import type { EmmaFollowUpCandidateView } from "../types";
import { AgentRunReplay } from "./AgentRunReplay";
import { MessageLetter } from "./flow/MessageLetter";
import { gatesOf, reachedGates } from "./follow-ups/follow-up-sieve";
import { FollowUpGates } from "./follow-ups/FollowUpGates";
import styles from "./follow-ups/FollowUpRow.module.css";
import { GuardRailNotice } from "./GuardRailNotice";
import { refusalUiState } from "./refusal-ui-state";
import { replayStepsFromRecorded } from "./replay";

const TEXTS = APP_TEXTS.emmaFollowUps;

export type EmmaResult = NonNullable<Awaited<ReturnType<typeof prepareFollowUp>>["data"]>;

type CardState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "blocked"; message: string };

/**
 * French reason of a stop. Display convenience only: the server action
 * rechecks every one of these conditions at click time, so this mapping never
 * carries a business rule of its own.
 */
export function blockedReasonText(reason: EmmaFollowUpCandidateView["blockedReason"]): string | null {
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

/** Link to the draft itself in the validation queue (dual view, `?message=`). */
export function draftHref(messageId: string): string {
  return `/agents-ia/a-valider?message=${encodeURIComponent(messageId)}`;
}

export type EmmaFollowUpCardProps = {
  candidate: EmmaFollowUpCandidateView;
  /**
   * Draft prepared in this visit, when the sieve holds it (the row changes
   * group once the list is re-read). Without it, the row keeps its own.
   */
  result?: EmmaResult | null;
  onPrepared?: (result: EmmaResult) => void;
  /** Heading level of the file name (3 in a group, 4 in a motive). */
  headingLevel?: 3 | 4;
  className?: string;
};

/**
 * One file of the sieve (docs/design-system.md §3.1.2): who, where in the
 * pipeline, which details exist, and the real checks as gates. A file that
 * passes every gate offers « Préparer la relance »; a stopped one shows where
 * it stops — the motive is the heading of its group, said once.
 *
 * After the server's answer the draft goes to the HUMAN validation, never out:
 * one signal runs to the checkpoint, and a direct link opens the draft in the
 * validation queue.
 */
export function EmmaFollowUpCard({
  candidate,
  result: heldResult,
  onPrepared,
  headingLevel = 3,
  className,
}: EmmaFollowUpCardProps) {
  const router = useRouter();
  const titleId = useId();
  const reasonId = useId();
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const [ownResult, setOwnResult] = useState<EmmaResult | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const singleFlight = useSingleFlight();
  const Heading = headingLevel === 3 ? "h3" : "h4";

  const result = heldResult ?? ownResult;
  const draftRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLElement>(null);
  const arrived = Boolean(heldResult) && candidate.hasPendingEmmaDraft;

  // The re-read list moved this file to « Relance déjà en attente »: follow it
  // there once, so the member sees where the draft went (focus + scroll; the
  // global scroll behaviour is already cut under reduced motion).
  useEffect(() => {
    if (!arrived) return;
    rowRef.current?.scrollIntoView({ block: "start" });
    draftRef.current?.focus({ preventScroll: true });
  }, [arrived]);

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
      // The draft and the re-read list arrive together: the row shows its
      // result where the list puts it now (with the drafts waiting for a human).
      startRefresh(() => {
        setState({ kind: "idle" });
        if (onPrepared) onPrepared(data);
        else setOwnResult(data);
        router.refresh();
      });
    } catch {
      setState({ kind: "error", message: APP_TEXTS.states.unexpected, retryable: true });
    }
  }

  const reason = blockedReasonText(candidate.blockedReason);
  const busy = state.kind === "running" || isRefreshing;
  const email = candidate.email ? TEXTS.emailAvailable : null;
  const phone = candidate.phone ? TEXTS.phoneAvailable : null;
  const details = [email, phone].filter(Boolean).join(" · ") || TEXTS.noReachableDetail;

  return (
    <article
      ref={rowRef}
      aria-labelledby={titleId}
      data-testid="emma-follow-up"
      data-ready={candidate.canPrepare || undefined}
      data-highlight={result ? "" : undefined}
      aria-busy={busy || undefined}
      className={cn(styles.row, "scroll-mt-28", className)}
    >
      <div className={cn(styles.lead, "min-w-0")}>
        <Heading id={titleId} className="truncate text-base font-semibold text-ink">
          {candidate.contactName}
        </Heading>
        <p className="mt-0.5 text-xs text-ink-muted">
          <span className="sr-only">{TEXTS.cardStage} : </span>
          {PIPELINE_STAGE_LABELS[candidate.stage]}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">{TEXTS.cardContact} : </span>
          {details}
        </p>
        {candidate.canPrepare ? null : (
          <p id={reasonId} className="sr-only" data-testid="emma-blocked-reason">
            {reason}
          </p>
        )}
      </div>

      <FollowUpGates
        contactName={candidate.contactName}
        gates={gatesOf(candidate)}
        reached={reachedGates(candidate)}
        channelLabel={candidate.channel ? CONSENT_CHANNEL_LABELS[candidate.channel] : null}
        waitingHuman={candidate.hasPendingEmmaDraft}
        // Only once the re-read list confirms the draft is waiting.
        signal={Boolean(result) && candidate.hasPendingEmmaDraft}
      />

      <div className={styles.actions}>
        {candidate.canPrepare && !result ? (
          <Button
            isLoading={busy}
            onClick={() => void run()}
            data-testid="run-emma"
          >
            {busy ? TEXTS.running : TEXTS.run}
          </Button>
        ) : null}
        <ArrowLink href={`/contacts/${candidate.id}`} tone="muted">
          {TEXTS.openContact}
        </ArrowLink>
      </div>

      <div aria-live="polite" className={cn(styles.detail, "empty:hidden")}>
        {state.kind === "error" ? (
          <AnimatedErrorState
            title={TEXTS.errorActionTitle}
            testId="emma-error"
            onRetry={state.retryable ? () => void run() : undefined}
          >
            {state.message}
          </AnimatedErrorState>
        ) : null}

        {state.kind === "blocked" ? <GuardRailNotice reason={state.message} testId="emma-blocked" /> : null}

        {result ? (
          <div ref={draftRef} tabIndex={-1} className="rounded-xs outline-none">
            <PreparedDraft result={result} contactName={candidate.contactName} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** What Emma prepared, where it went (human validation), and the measured replay. */
function PreparedDraft({ result, contactName }: { result: EmmaResult; contactName: string }) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Alert tone="success" title={TEXTS.successTitle} testId="emma-result">
        <p>{result.decisionText}</p>
        <p className="mt-2 font-medium text-ink">{TEXTS.nothingSent}</p>
      </Alert>

      <section data-testid="emma-draft" aria-label={TEXTS.draftBody} className="flex max-w-3xl flex-col gap-4">
        <MessageLetter
          channel={result.channel}
          channelLabel={CONSENT_CHANNEL_LABELS[result.channel]}
          toLabel={APP_TEXTS.validationQueue.to}
          recipient={contactName}
          subjectLabel={TEXTS.draftSubject}
          subject={result.messageSubject}
          body={result.messageBody}
          badges={result.isSimulation ? <SimulationBadge /> : null}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href={draftHref(result.messageId)} size="sm" arrow="forward">
            {TEXTS.openQueue}
          </ButtonLink>
          <ButtonLink href={`/agents-ia/executions/${result.runId}`} variant="ghost" size="sm">
            {TEXTS.viewReplay}
          </ButtonLink>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4" data-testid="emma-replay">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-ink">{APP_TEXTS.replay.title}</h4>
          {result.isSimulation ? <SimulationBadge /> : null}
        </div>
        <p className="mt-1 mb-4 text-xs text-ink-muted">{APP_TEXTS.replay.subtitle}</p>
        <AgentRunReplay key={result.runId} steps={replayStepsFromRecorded(result.runId, result.steps)} />
      </section>
    </div>
  );
}
