import type { Metadata } from "next";
import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonArrowGlyph } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { AgentRunHead } from "@/features/agents-ia/components/AgentRunHead";
import { DossierJourneyLoader } from "@/features/agents-ia/components/DossierJourneyLoader";
import { AgentRunReplay } from "@/features/agents-ia/components/AgentRunReplay";
import { RunOutcomeSummary } from "@/features/agents-ia/components/RunOutcomeSummary";
import { replayStepsFromView } from "@/features/agents-ia/components/replay";
import { getRunSteps } from "@/features/agents-ia/queries";

const TEXTS = APP_TEXTS.runDetail;

export const metadata: Metadata = { title: `${TEXTS.pageTitle} — ${APP_TEXTS.brand.name}` };

/**
 * Replay of one past execution, read from the journal.
 *
 * An unknown run and a run of another agency answer exactly the same thing
 * ("Exécution d'agent introuvable."): the screen leaks nothing about what
 * exists elsewhere.
 */
export default async function AgentRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { data, error } = await getRunSteps(runId);

  const backLink = (
    <Link href="/agents-ia" className="group/button inline-flex items-center gap-1.5 rounded-xs hover:text-ink hover:underline">
      <ButtonArrowGlyph direction="back" />
      {TEXTS.back}
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Alert
          tone="error"
          title={TEXTS.errorTitle}
          testId="run-error"
          action={
            <ButtonLink href="/agents-ia" variant="secondary" size="sm">
              {TEXTS.back}
            </ButtonLink>
          }
        >
          {error.message}
        </Alert>
      </div>
    );
  }

  const { run, steps, totalDurationMs } = data;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
      <PageHeader
        size="hero"
        eyebrow={backLink}
        title={TEXTS.headTitle(run.agentLabel)}
        meta={run.isSimulation ? <SimulationBadge /> : null}
      />

      <div className="stagger mt-10 grid gap-8">
        {/* 1. The outcome, and the stop reason when there is one. */}
        <RunOutcomeSummary run={run} measuredMs={totalDurationMs} />

        {/* 2. Where this run sits in its dossier: recorded stages only. */}
        <Card
          title={APP_TEXTS.dossierJourney.title}
          description={
            run.contactId ? `${APP_TEXTS.dossierJourney.subtitle} ${APP_TEXTS.dossierJourney.durationHint}` : undefined
          }
          actions={
            run.contactId ? (
              <ArrowLink href={`/contacts/${run.contactId}`}>{APP_TEXTS.dossierJourney.openContact}</ArrowLink>
            ) : undefined
          }
          testId="run-dossier"
        >
          {run.contactId ? (
            <DossierJourneyLoader
              contactId={run.contactId}
              contactName={run.contactName ?? TEXTS.unknown}
              // A run still in progress has no final measured duration: none is shown.
              measured={run.status === "running" ? null : { runId: run.id, durationMs: totalDurationMs }}
            />
          ) : (
            <p className="text-sm text-ink-muted" data-testid="run-dossier-inbound">
              {APP_TEXTS.dossierJourney.inboundLead}
            </p>
          )}
        </Card>

        {/* 3. The main element: the measured process, replayed. */}
        <Card title={APP_TEXTS.replay.title} description={APP_TEXTS.replay.subtitle} testId="run-replay">
          <AgentRunReplay
            steps={replayStepsFromView(steps)}
            inProgress={run.status === "running"}
            testId="replay"
          />
        </Card>

        {/* 4. Technical details, folded. */}
        <Disclosure
          variant="card"
          headingLevel={2}
          summary={APP_TEXTS.agentsIa.technicalDetails}
          hint={TEXTS.technicalHint}
          testId="run-technical"
        >
          <AgentRunHead run={run} />
        </Disclosure>
      </div>
    </div>
  );
}
