import type { Metadata } from "next";
import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { AgentRunHead } from "@/features/agents-ia/components/AgentRunHead";
import { AgentRunReplay } from "@/features/agents-ia/components/AgentRunReplay";
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
    <Link href="/agents-ia" className="rounded-xs hover:text-ink hover:underline">
      ← {TEXTS.back}
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

  const { run, steps } = data;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:py-12">
      <PageHeader
        eyebrow={backLink}
        title={TEXTS.headTitle(run.agentLabel)}
        meta={
          <>
            <Badge tone={run.status === "succeeded" ? "outline" : "solid"}>{run.statusLabel}</Badge>
            {run.isSimulation ? <SimulationBadge /> : null}
          </>
        }
      />

      <div className="mt-8 grid gap-6">
        <Card title={TEXTS.headCardTitle} testId="run-head">
          <AgentRunHead run={run} />
        </Card>

        <Card
          title={APP_TEXTS.replay.title}
          description={APP_TEXTS.replay.subtitle}
          actions={run.isSimulation ? <SimulationBadge /> : null}
          testId="run-replay"
        >
          <AgentRunReplay steps={replayStepsFromView(steps)} testId="replay" />
        </Card>
      </div>
    </div>
  );
}
