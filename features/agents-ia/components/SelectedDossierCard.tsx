import { APP_TEXTS } from "@/components/texts";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

import type { AgentOverview, AgentRunSummary } from "../types";
import { DossierJourneyLoader } from "./DossierJourneyLoader";

const TEXTS = APP_TEXTS.dossierJourney;

type DossierRun = AgentRunSummary & { contactId: string };

/**
 * The dossier put forward on « Agents IA » (plan, decision 2): the one of the
 * most recent RECORDED execution that belongs to a contact. Léa's runs work on
 * a raw lead, before any contact exists, so they cannot open a dossier.
 * Pure: unit-tested on its own.
 */
export function latestDossierRun(agents: readonly AgentOverview[]): DossierRun | null {
  let latest: DossierRun | null = null;
  for (const agent of agents) {
    const run = agent.lastRun;
    if (!run || run.contactId === null) continue;
    if (!latest || run.startedAt > latest.startedAt) latest = { ...run, contactId: run.contactId };
  }
  return latest;
}

/** Level 2 of « Agents IA »: the journey of the last dossier really worked on. */
export function SelectedDossierCard({ agents }: { agents: readonly AgentOverview[] }) {
  const run = latestDossierRun(agents);

  if (!run) {
    return (
      <section aria-labelledby="selected-dossier-title" data-testid="selected-dossier">
        <h2 id="selected-dossier-title" className="sr-only">
          {TEXTS.selectedTitle}
        </h2>
        <EmptyState
          title={TEXTS.emptyTitle}
          description={TEXTS.emptyBody}
          action={
            <ButtonLink href="/contacts" variant="secondary" arrow="forward">
              {TEXTS.emptyCta}
            </ButtonLink>
          }
        />
      </section>
    );
  }

  const contactName = run.contactName ?? APP_TEXTS.runDetail.unknown;

  return (
    <Card
      title={TEXTS.selectedTitle}
      description={TEXTS.selectedSubtitle(run.agentLabel, contactName)}
      actions={
        <>
          <ArrowLink href={`/agents-ia/executions/${run.id}`}>{APP_TEXTS.agentsIa.viewReplay}</ArrowLink>
          <ArrowLink href={`/contacts/${run.contactId}`}>{TEXTS.openContact}</ArrowLink>
        </>
      }
      testId="selected-dossier"
    >
      <DossierJourneyLoader contactId={run.contactId} contactName={contactName} />
    </Card>
  );
}
