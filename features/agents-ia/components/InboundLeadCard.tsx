"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { processInboundLead } from "@/features/agents-ia/lea-acquisition/actions";
import { CONTACT_SOURCE_LABELS } from "@/features/contacts/types";
import { LEAD_FIELD_LABELS } from "@/lib/agents/messages";

import type { InboundLeadView } from "../types";
import { AgentRunReplay } from "./AgentRunReplay";
import { replayStepsFromRecorded } from "./replay";

const TEXTS = APP_TEXTS.leadsInbox;

type LeaResult = NonNullable<Awaited<ReturnType<typeof processInboundLead>>["data"]>;

type CardState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: LeaResult }
  | { kind: "error"; message: string };

function matchedLabels(matchedOn: readonly string[]): string {
  return matchedOn
    .map((field) =>
      field in LEAD_FIELD_LABELS ? LEAD_FIELD_LABELS[field as keyof typeof LEAD_FIELD_LABELS] : field,
    )
    .join(", ");
}

/**
 * One raw inbound lead, and the one action a human can take on it.
 *
 * `rawText` is the prospect's own words: UNTRUSTED DATA. It is displayed as
 * text, never as markup, and the screen says so — an agent treats it as data,
 * never as an instruction.
 */
export function InboundLeadCard({ lead }: { lead: InboundLeadView }) {
  const router = useRouter();
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const titleId = useId();

  async function run() {
    setState({ kind: "running" });
    try {
      const { data, error } = await processInboundLead(lead.id);
      if (error) {
        // The server message is already French and already precise.
        setState({ kind: "error", message: error.message });
        return;
      }
      setState({ kind: "done", result: data });
      router.refresh();
    } catch {
      setState({ kind: "error", message: APP_TEXTS.states.unexpected });
    }
  }

  const result = state.kind === "done" ? state.result : null;
  const contactId = result?.contactId ?? result?.duplicateContactId ?? lead.contactId;
  const replayRunId = result?.runId ?? lead.processedRunId;

  return (
    <article
      aria-labelledby={titleId}
      data-testid="inbound-lead"
      data-status={lead.status}
      className="animate-rise rounded-xl border border-line bg-surface p-6 shadow-subtle"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={titleId} className="text-heading font-semibold text-ink">
            {CONTACT_SOURCE_LABELS[lead.source]}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {TEXTS.receivedAt} <time dateTime={lead.createdAt}>{formatDateTime(lead.createdAt)}</time>
          </p>
        </div>
        <Badge tone={lead.canBeProcessed ? "outline" : "neutral"}>{lead.statusLabel}</Badge>
      </header>

      <div className="mt-4">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.fields}</p>
        {lead.payloadFields.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-muted">{TEXTS.noFields}</p>
        ) : (
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {lead.payloadFields.map((field) => (
              <Badge key={field} tone="outline">
                {field}
              </Badge>
            ))}
          </p>
        )}
      </div>

      <figure className="mt-4 rounded-lg border border-line bg-surface-muted p-4">
        <figcaption className="text-overline font-semibold text-ink-subtle uppercase">
          {TEXTS.rawText}
        </figcaption>
        {/* Plain text, always: the prospect's words are data, never markup. */}
        <p className="mt-2 text-sm whitespace-pre-line text-ink">
          {lead.rawText ?? TEXTS.rawTextNone}
        </p>
        <p className="mt-3 text-xs text-ink-subtle">{TEXTS.untrusted}</p>
      </figure>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {lead.canBeProcessed ? (
          <Button isLoading={state.kind === "running"} onClick={() => void run()} data-testid="run-lea">
            {state.kind === "running" ? TEXTS.running : TEXTS.run}
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">{TEXTS.alreadyProcessed}</p>
        )}
        {contactId ? (
          <Link
            href={`/contacts/${contactId}`}
            className="rounded-xs text-sm underline underline-offset-2 hover:text-ink-muted"
          >
            {TEXTS.contactLink}
          </Link>
        ) : null}
        {replayRunId && state.kind !== "done" ? (
          <ButtonLink href={`/agents-ia/executions/${replayRunId}`} variant="ghost" size="sm">
            {TEXTS.viewReplay}
          </ButtonLink>
        ) : null}
      </div>
      {lead.canBeProcessed ? <p className="mt-2 text-xs text-ink-muted">{TEXTS.runHint}</p> : null}

      <div aria-live="polite">
        {state.kind === "error" ? (
          <Alert tone="error" title={TEXTS.errorActionTitle} className="mt-4" testId="lead-error">
            {state.message}
          </Alert>
        ) : null}

        {result ? (
          <Alert tone="success" title={TEXTS.successTitle} className="mt-4" testId="lead-result">
            <p>{result.decisionText}</p>
            {result.duplicateMatchedOn.length > 0 ? (
              <p className="mt-2 text-xs">{TEXTS.duplicateMatched(matchedLabels(result.duplicateMatchedOn))}</p>
            ) : null}
            {result.missingFields.length > 0 ? (
              <p className="mt-2 text-xs">
                {TEXTS.missingFields} : {matchedLabels(result.missingFields)}
              </p>
            ) : null}
            {result.task ? <p className="mt-1 text-xs">{TEXTS.taskCreated}</p> : null}
          </Alert>
        ) : null}
      </div>

      {/* Outside the live region: the replay updates step by step. */}
      {result ? (
        <section className="mt-4 rounded-lg border border-line bg-surface-muted p-4" data-testid="lead-replay">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">{APP_TEXTS.replay.title}</h4>
            {result.isSimulation ? <SimulationBadge /> : null}
          </div>
          <p className="mt-1 mb-4 text-xs text-ink-muted">{APP_TEXTS.replay.subtitle}</p>
          <AgentRunReplay key={result.runId} steps={replayStepsFromRecorded(result.runId, result.steps)} />
        </section>
      ) : null}
    </article>
  );
}
