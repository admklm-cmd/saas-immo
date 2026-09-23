"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatSlot } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { AgentRunReplay } from "@/features/agents-ia/components/AgentRunReplay";
import { GuardRailNotice } from "@/features/agents-ia/components/GuardRailNotice";
import { refusalState } from "@/features/agents-ia/components/outcome";
import { replayStepsFromRecorded } from "@/features/agents-ia/components/replay";
import { prepareFollowUp } from "@/features/agents-ia/emma-relation/actions";
import { qualifyContact } from "@/features/agents-ia/hugo-qualification/actions";
import { proposeAppointment } from "@/features/agents-ia/louis-rendez-vous/actions";
import { QUALIFICATION_FIELD_LABELS } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.agents;

/**
 * Result shapes are derived from the server actions themselves, so this panel
 * can never drift from the contract owned by the automatisation-ia agent.
 */
type HugoResult = NonNullable<Awaited<ReturnType<typeof qualifyContact>>["data"]>;
type LouisResult = NonNullable<Awaited<ReturnType<typeof proposeAppointment>>["data"]>;
type EmmaResult = NonNullable<Awaited<ReturnType<typeof prepareFollowUp>>["data"]>;

type AgentKey = "hugo" | "louis" | "emma";
type PanelState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "hugo"; result: HugoResult }
  | { kind: "louis"; result: LouisResult }
  | { kind: "emma"; result: EmmaResult };

function fieldLabel(field: string): string {
  return field in QUALIFICATION_FIELD_LABELS
    ? QUALIFICATION_FIELD_LABELS[field as keyof typeof QUALIFICATION_FIELD_LABELS]
    : field;
}

/**
 * The AI actions launchable from a contact record: Hugo, Louis, then Emma.
 *
 * No AI is ever called from the browser: the buttons only invoke the server
 * actions, which re-check the session, the agency and every guard rail
 * server-side. A refused action shows the French message returned by the server
 * and changes nothing.
 */
export function AgentActionsPanel({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState<AgentKey | null>(null);
  const [state, setState] = useState<PanelState>({ kind: "idle" });

  async function run(agent: AgentKey) {
    setRunning(agent);
    setState({ kind: "idle" });
    try {
      if (agent === "hugo") {
        const { data, error } = await qualifyContact(contactId);
        setState(error ? refusalState(error) : { kind: "hugo", result: data });
      } else if (agent === "louis") {
        const { data, error } = await proposeAppointment(contactId);
        setState(error ? refusalState(error) : { kind: "louis", result: data });
      } else {
        const { data, error } = await prepareFollowUp(contactId);
        setState(error ? refusalState(error) : { kind: "emma", result: data });
      }
      // Re-renders the server components: header, consents and timeline.
      router.refresh();
    } catch {
      setState({ kind: "error", message: APP_TEXTS.states.unexpected });
    } finally {
      setRunning(null);
    }
  }

  const blocked = state.kind === "louis" && "blocked" in state.result ? state.result.blocked : null;

  // Steps really measured during the run we just launched: the replay needs no
  // second read, and shows exactly what `getRunSteps` would show later.
  const replay =
    state.kind === "hugo" || state.kind === "louis" || state.kind === "emma"
      ? { runId: state.result.runId, steps: state.result.steps }
      : null;

  return (
    <Card
      title={TEXTS.panelTitle}
      description={TEXTS.panelSubtitle}
      actions={<SimulationBadge />}
      testId="agent-actions"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <Button
            onClick={() => void run("hugo")}
            isLoading={running === "hugo"}
            disabled={running !== null}
            className="w-full"
          >
            {running === "hugo" ? TEXTS.running : TEXTS.runHugo}
          </Button>
          <p className="mt-2 text-xs text-ink-muted">{TEXTS.runHugoHint}</p>
        </div>
        <div className="flex-1">
          <Button
            variant="secondary"
            onClick={() => void run("louis")}
            isLoading={running === "louis"}
            disabled={running !== null}
            className="w-full"
          >
            {running === "louis" ? TEXTS.running : TEXTS.runLouis}
          </Button>
          <p className="mt-2 text-xs text-ink-muted">{TEXTS.runLouisHint}</p>
        </div>
        <div className="flex-1">
          <Button
            variant="secondary"
            onClick={() => void run("emma")}
            isLoading={running === "emma"}
            disabled={running !== null}
            className="w-full"
          >
            {running === "emma" ? TEXTS.running : TEXTS.runEmma}
          </Button>
          <p className="mt-2 text-xs text-ink-muted">{TEXTS.runEmmaHint}</p>
        </div>
      </div>

      <div aria-live="polite">
        {state.kind === "error" ? (
          <Alert tone="error" title={TEXTS.errorTitle} className="mt-5" testId="agent-error">
            {state.message}
          </Alert>
        ) : null}

        {state.kind === "blocked" ? (
          <GuardRailNotice reason={state.message} className="mt-5" testId="agent-blocked" />
        ) : null}

        {state.kind === "hugo" ? (
          <Alert tone="success" title={TEXTS.hugoSuccessTitle} className="mt-5" testId="agent-result">
            <p>{state.result.decisionText}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-subtle">
                {state.result.stageChanged ? TEXTS.stageChanged : TEXTS.stageUnchanged}
              </span>
              <PipelineStageBadge stage={state.result.stage} />
            </div>
            {state.result.missingFields.length > 0 ? (
              <p className="mt-3 text-xs">
                {TEXTS.missingFields} : {state.result.missingFields.map(fieldLabel).join(", ")}
              </p>
            ) : null}
            {state.result.task ? <p className="mt-1 text-xs">{TEXTS.taskCreated}</p> : null}
            <p className="mt-3 text-xs text-ink-subtle">{TEXTS.refreshHint}</p>
          </Alert>
        ) : null}

        {state.kind === "louis" && blocked ? (
          <GuardRailNotice reason={blocked.reason} className="mt-5" testId="agent-blocked" />
        ) : null}

        {state.kind === "louis" && !blocked ? (
          <Alert tone="success" title={TEXTS.louisSuccessTitle} className="mt-5" testId="agent-result">
            <p>
              <span className="text-ink-subtle">{TEXTS.proposedSlot} : </span>
              {formatSlot(state.result.startsAt, state.result.endsAt)}
            </p>
            <figure className="mt-3 rounded-lg border border-line bg-surface p-3">
              <figcaption className="text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.draftMessage}
              </figcaption>
              <p className="mt-2 text-sm whitespace-pre-line text-ink">{state.result.messageBody}</p>
            </figure>
            <p className="mt-3 text-xs">{TEXTS.pendingValidation}</p>
            <p className="mt-1 text-xs text-ink-subtle">{TEXTS.refreshHint}</p>
          </Alert>
        ) : null}

        {state.kind === "emma" ? (
          <Alert tone="success" title={TEXTS.emmaSuccessTitle} className="mt-5" testId="agent-result">
            <p>{state.result.decisionText}</p>
            <figure className="mt-3 rounded-lg border border-line bg-surface p-3">
              <figcaption className="text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.draftMessage}
              </figcaption>
              <p className="mt-2 text-sm whitespace-pre-line text-ink">{state.result.messageBody}</p>
            </figure>
            <p className="mt-3 text-xs">{TEXTS.pendingValidation}</p>
            <p className="mt-1 text-xs text-ink-subtle">{TEXTS.refreshHint}</p>
          </Alert>
        ) : null}
      </div>

      {/* Outside the live region on purpose: the replay updates step by step and
          must not be re-announced in full at every tick. */}
      {replay ? (
        <section className="mt-5 rounded-lg border border-line bg-surface-muted p-4" data-testid="agent-replay">
          <h3 className="text-sm font-semibold text-ink">{APP_TEXTS.replay.title}</h3>
          <p className="mt-1 mb-4 text-xs text-ink-muted">{APP_TEXTS.replay.subtitle}</p>
          <AgentRunReplay key={replay.runId} steps={replayStepsFromRecorded(replay.runId, replay.steps)} />
          <div className="mt-4">
            <ButtonLink href={`/agents-ia/executions/${replay.runId}`} variant="ghost" size="sm">
              {APP_TEXTS.agentsIa.viewReplay}
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </Card>
  );
}
