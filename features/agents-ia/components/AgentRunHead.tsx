import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { DataList } from "@/components/ui/DataList";

import type { AgentRunSummary } from "../types";
import { RunStatusBadge } from "./RunStatusBadge";

const TEXTS = APP_TEXTS.runDetail;
const AGENT_TEXTS = APP_TEXTS.agentsIa;

/** Identity card of one execution: what ran, on what, with what outcome. */
export function AgentRunHead({ run }: { run: AgentRunSummary }) {
  return (
    <DataList
      items={[
        { label: TEXTS.startedAt, value: formatDateTime(run.startedAt) },
        {
          label: TEXTS.finishedAt,
          value: run.finishedAt ? formatDateTime(run.finishedAt) : TEXTS.stillRunning,
        },
        {
          label: TEXTS.contact,
          value: run.contactId ? (
            <Link
              href={`/contacts/${run.contactId}`}
              className="rounded-xs underline underline-offset-2 hover:text-ink-muted"
            >
              {run.contactName ?? AGENT_TEXTS.openContact}
            </Link>
          ) : (
            // Léa: no contact file exists yet at that point of the journey.
            <span title={AGENT_TEXTS.inboundLeadHint}>{AGENT_TEXTS.inboundLead}</span>
          ),
        },
        { label: TEXTS.provider, value: run.provider },
        { label: TEXTS.model, value: run.model ?? TEXTS.unknown },
        {
          label: TEXTS.tokens,
          value: (
            <span className="tabular-nums">
              {run.inputTokens} / {run.outputTokens}
            </span>
          ),
        },
        {
          label: TEXTS.decision,
          value: <span className="whitespace-pre-line">{run.decision ?? TEXTS.unknown}</span>,
        },
        { label: TEXTS.outcome, value: <RunStatusBadge status={run.status} /> },
        // A guard rail and a technical error are named differently, never mixed.
        ...(run.error
          ? [{ label: run.status === "blocked" ? TEXTS.blockedCode : TEXTS.errorCode, value: run.error }]
          : []),
      ]}
    />
  );
}
