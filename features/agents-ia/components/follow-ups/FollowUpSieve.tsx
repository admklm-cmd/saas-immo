"use client";

import { useCallback, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { ArrowLink } from "@/components/ui/ArrowLink";

import type { EmmaFollowUpCandidateView } from "../../types";
import { blockedReasonText, EmmaFollowUpCard, type EmmaResult } from "../EmmaFollowUpCard";
import { RuleNote } from "../flow/RuleNote";
import { WorkGroup } from "../flow/WorkGroup";
import { blockedCount, FOLLOW_UP_GATES, funnelOf, groupCandidates, type FollowUpGate } from "./follow-up-sieve";
import styles from "./FollowUpRow.module.css";
import { GATE_LABELS, gateAnchor, READY_ANCHOR, SieveFunnel } from "./SieveFunnel";

const TEXTS = APP_TEXTS.emmaFollowUps;

const REASON_OF_GATE: Readonly<Record<FollowUpGate, NonNullable<EmmaFollowUpCandidateView["blockedReason"]>>> = {
  takeover: "human_takeover",
  pendingDraft: "pending_draft",
  consent: "consent_or_channel_missing",
};

function GateHeader() {
  return (
    <div className={styles.header} aria-hidden="true">
      <span className={styles.lead} />
      <span className={styles.headerGates}>
        {FOLLOW_UP_GATES.map((gate) => (
          <span key={gate}>{GATE_LABELS[gate]}</span>
        ))}
        <span>{TEXTS.gateEnd}</span>
      </span>
      <span className="max-xl:hidden" />
    </div>
  );
}

/**
 * « Relances Emma » as a sieve (docs/design-system.md §3.1.2): the summary
 * band counts the list the page received, gate by gate; then the files that
 * pass every check (« Prêts »), then those that are stopped, grouped by the
 * gate that stops them — the motive is written once, as the group heading.
 *
 * Client component for one reason: a draft prepared here must survive the
 * re-read of the list, which moves its file into « Relance déjà en attente ».
 */
export function FollowUpSieve({ candidates }: { candidates: readonly EmmaFollowUpCandidateView[] }) {
  const [prepared, setPrepared] = useState<Readonly<Record<string, EmmaResult>>>({});
  const groups = groupCandidates(candidates);
  const steps = funnelOf(groups);
  const blocked = blockedCount(groups);

  const onPrepared = useCallback(
    (id: string) => (result: EmmaResult) => setPrepared((current) => ({ ...current, [id]: result })),
    [],
  );

  const row = (candidate: EmmaFollowUpCandidateView, headingLevel: 3 | 4) => (
    <li key={candidate.id}>
      <EmmaFollowUpCard
        candidate={candidate}
        result={prepared[candidate.id] ?? null}
        onPrepared={onPrepared(candidate.id)}
        headingLevel={headingLevel}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <SieveFunnel
        total={groups.total}
        ready={groups.ready.length}
        steps={steps}
        rule={
          <RuleNote title={TEXTS.ruleTitle} testId="emma-rule">
            {TEXTS.ruleBody}
          </RuleNote>
        }
      />

      <div className={styles.list} data-testid="sieve-list">
        <GateHeader />

        <WorkGroup
          title={TEXTS.groupReady}
          count={TEXTS.groupCount(groups.ready.length)}
          note={TEXTS.runHint}
          anchor={READY_ANCHOR}
          testId="sieve-group-ready"
          headerClassName="px-5 py-5 md:px-6"
        >
          {groups.ready.length > 0 ? (
            <ul className="border-t border-line">{groups.ready.map((candidate) => row(candidate, 3))}</ul>
          ) : (
            <p className="border-t border-line px-5 py-5 text-sm text-ink-muted md:px-6">{TEXTS.groupReadyEmpty}</p>
          )}
        </WorkGroup>

        {blocked > 0 ? (
          <WorkGroup
            title={TEXTS.groupBlocked}
            count={TEXTS.groupCount(blocked)}
            testId="sieve-group-blocked"
            headerClassName="border-t border-line px-5 pt-8 pb-5 md:px-6"
          >
            {FOLLOW_UP_GATES.filter((gate) => groups.stopped[gate].length > 0).map((gate) => (
              <WorkGroup
                key={gate}
                level={3}
                tone="sub"
                title={blockedReasonText(REASON_OF_GATE[gate])}
                count={TEXTS.groupCount(groups.stopped[gate].length)}
                anchor={gateAnchor(gate)}
                testId={`sieve-group-${gate}`}
                action={
                  gate === "pendingDraft" ? (
                    <ArrowLink href="/agents-ia/a-valider">{TEXTS.openQueue}</ArrowLink>
                  ) : undefined
                }
                headerClassName="border-t border-line bg-surface-muted px-5 py-3.5 md:px-6"
              >
                <ul className="border-t border-line">{groups.stopped[gate].map((candidate) => row(candidate, 4))}</ul>
              </WorkGroup>
            ))}
            {groups.unexplained.length > 0 ? (
              <ul className="border-t border-line">{groups.unexplained.map((candidate) => row(candidate, 3))}</ul>
            ) : null}
          </WorkGroup>
        ) : null}
      </div>
    </div>
  );
}
