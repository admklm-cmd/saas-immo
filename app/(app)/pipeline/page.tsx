import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PipelineBoard } from "@/features/pipeline/components/PipelineBoard";
import { PipelineFunnelCard } from "@/features/pipeline/components/PipelineFunnelCard";
import { getPipelineBoard, getPipelineFunnel, getPipelineViewer } from "@/features/pipeline/queries";

const TEXTS = APP_TEXTS.pipeline;
const CONTACTS_TEXTS = APP_TEXTS.contacts;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * `/pipeline` — the funnel first (« Passage d'une étape à l'autre »: what the pipeline
 * really does, docs/design-system.md §3.5.2.J), then the contacts by stage.
 *
 * The board is bounded (`getPipelineBoard`): exact count per stage, the latest cards, the
 * two closed stages folded. No drag-and-drop: each card links to the contact file and offers
 * a « Changer d'étape » menu (server action `changeContactStage`). The viewer's role only
 * EXPLAINS why leaving « Mandat signé » is reserved to a director; if it cannot be read, the
 * menu falls back to the most restrictive display and the database decides anyway.
 */
export default async function PipelinePage() {
  const [{ data: board, error }, viewer, { data: funnel }] = await Promise.all([
    getPipelineBoard(),
    getPipelineViewer(),
    getPipelineFunnel(),
  ]);
  const canExitSignedMandate = viewer.data?.canExitSignedMandate ?? false;

  return (
    <div className="page-frame">
      <PageHeader
        overline={APP_TEXTS.nav.groupPilotage}
        icon="pipeline"
        title={TEXTS.title}
        meta={board && board.totalContacts > 0 ? <Badge tone="outline">{CONTACTS_TEXTS.count(board.totalContacts)}</Badge> : null}
      />

      <div className="mt-8">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            action={
              <ButtonLink href="/pipeline" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : board.totalContacts === 0 ? (
          <EmptyState
            icon="pipeline"
            title={CONTACTS_TEXTS.emptyTitle}
            titleAccent={CONTACTS_TEXTS.emptyTitleAccent}
            description={CONTACTS_TEXTS.emptyBody}
            action={
              <ButtonLink href="/estimation" variant="secondary">
                {APP_TEXTS.marketing.estimation}
              </ButtonLink>
            }
          />
        ) : (
          <>
            <PipelineFunnelCard funnel={funnel} />
            <div className="mt-10">
              <PipelineBoard columns={board.columns} canExitSignedMandate={canExitSignedMandate} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
