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
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { Textarea } from "@/components/ui/Textarea";
import { confirmAppointment } from "@/features/agents-ia/louis-rendez-vous/actions";
import {
  completeAppointment,
  followThroughAppointment,
} from "@/features/agents-ia/sarah-suivi/actions";
import { APPOINTMENT_REPORT_MAX_LENGTH } from "@/features/agents-ia/types";
import { AGENT_LABELS } from "@/lib/agents/messages";

import type { ReportedAppointmentView } from "../types";
import { AgentRunReplay } from "./AgentRunReplay";
import { replayStepsFromRecorded } from "./replay";

const TEXTS = APP_TEXTS.followThrough;

type SarahResult = NonNullable<Awaited<ReturnType<typeof followThroughAppointment>>["data"]>;

type CardState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: SarahResult }
  | { kind: "error"; message: string };

type AppointmentState = Pick<
  ReportedAppointmentView,
  | "status"
  | "statusLabel"
  | "stage"
  | "reportNotes"
  | "reportRecordedAt"
  | "canBeConfirmed"
  | "canBeCompleted"
  | "canBeFollowedThrough"
>;

type WorkflowState =
  | { kind: "idle" }
  | { kind: "working"; action: "confirm" | "complete" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function EstimationPresented({ value }: { value: boolean | null }) {
  const label = value === null ? TEXTS.unknown : value ? TEXTS.yes : TEXTS.no;
  return (
    <p className="text-sm text-ink-muted">
      {TEXTS.estimationPresented} : <span className="font-medium text-ink">{label}</span>
    </p>
  );
}

function ResultList({ title, items, empty }: { title: string; items: readonly string[]; empty: string }) {
  return (
    <div>
      <h4 className="text-overline font-semibold text-ink-subtle uppercase">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm text-ink">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="flex gap-2">
              <span aria-hidden="true" className="text-ink-subtle">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

/** One appointment across the human bridge from Louis's proposal to Sarah. */
export function SarahAppointmentCard({ appointment }: { appointment: ReportedAppointmentView }) {
  const router = useRouter();
  const titleId = useId();
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const [workflow, setWorkflow] = useState<WorkflowState>({ kind: "idle" });
  const [appointmentState, setAppointmentState] = useState<AppointmentState>({
    status: appointment.status,
    statusLabel: appointment.statusLabel,
    stage: appointment.stage,
    reportNotes: appointment.reportNotes,
    reportRecordedAt: appointment.reportRecordedAt,
    canBeConfirmed: appointment.canBeConfirmed,
    canBeCompleted: appointment.canBeCompleted,
    canBeFollowedThrough: appointment.canBeFollowedThrough,
  });
  const [reportNotes, setReportNotes] = useState("");

  async function confirm() {
    setWorkflow({ kind: "working", action: "confirm" });
    try {
      const { data, error } = await confirmAppointment(appointment.id);
      if (error) {
        setWorkflow({ kind: "error", message: error.message });
        return;
      }
      setAppointmentState((current) => ({
        ...current,
        status: data.status,
        statusLabel: data.statusLabel,
        stage: data.stage,
        canBeConfirmed: false,
        canBeCompleted: true,
      }));
      setWorkflow({ kind: "success", message: TEXTS.confirmSuccess });
      router.refresh();
    } catch {
      setWorkflow({ kind: "error", message: APP_TEXTS.states.unexpected });
    }
  }

  async function complete() {
    const notes = reportNotes.trim();
    if (notes.length === 0) return;
    setWorkflow({ kind: "working", action: "complete" });
    try {
      const { data, error } = await completeAppointment(appointment.id, { reportNotes: notes });
      if (error) {
        setWorkflow({ kind: "error", message: error.message });
        return;
      }
      setAppointmentState((current) => ({
        ...current,
        status: data.status,
        statusLabel: data.statusLabel,
        stage: data.stage,
        reportNotes: notes,
        reportRecordedAt: data.reportRecordedAt,
        canBeCompleted: false,
        canBeFollowedThrough: true,
      }));
      setWorkflow({ kind: "success", message: TEXTS.completeSuccess });
      router.refresh();
    } catch {
      setWorkflow({ kind: "error", message: APP_TEXTS.states.unexpected });
    }
  }

  async function run() {
    setState({ kind: "running" });
    try {
      const { data, error } = await followThroughAppointment(appointment.id);
      if (error) {
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

  return (
    <article
      aria-labelledby={titleId}
      data-testid="sarah-appointment"
      data-can-follow-through={appointmentState.canBeFollowedThrough}
      className="animate-rise rounded-xl border border-line bg-surface p-6 shadow-subtle"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-heading font-semibold text-ink">
            {appointment.contactName}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {TEXTS.when} <time dateTime={appointment.startsAt}>{formatDateTime(appointment.startsAt)}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PipelineStageBadge stage={result?.stage ?? appointmentState.stage} />
          <Badge
            tone={appointmentState.status === "done" ? "solid" : "outline"}
            title={TEXTS.status}
          >
            {appointmentState.statusLabel}
          </Badge>
          {appointmentState.status === "done" ? <Badge tone="outline">{AGENT_LABELS.sarah}</Badge> : null}
        </div>
      </header>

      {appointmentState.status === "done" ? (
        <figure className="mt-5 rounded-lg border border-line bg-surface-muted p-4">
          <figcaption className="text-overline font-semibold text-ink-subtle uppercase">
            {TEXTS.report}
          </figcaption>
          <p className="mt-2 text-sm whitespace-pre-line text-ink">
            {appointmentState.reportNotes ?? TEXTS.reportMissing}
          </p>
          {appointmentState.reportRecordedAt ? (
            <p className="mt-3 text-xs text-ink-muted">
              {TEXTS.reportRecordedAt}{" "}
              <time dateTime={appointmentState.reportRecordedAt}>
                {formatDateTime(appointmentState.reportRecordedAt)}
              </time>
            </p>
          ) : null}
          {appointmentState.reportNotes ? (
            <p className="mt-2 text-xs text-ink-subtle">{TEXTS.reportUntrusted}</p>
          ) : null}
        </figure>
      ) : null}

      {appointmentState.canBeCompleted ? (
        <form
          className="mt-5 rounded-lg border border-line-strong bg-surface-muted p-4"
          data-testid="appointment-completion-form"
          onSubmit={(event) => {
            event.preventDefault();
            void complete();
          }}
        >
          <h3 className="text-sm font-semibold text-ink">{TEXTS.completeTitle}</h3>
          <Textarea
            label={TEXTS.report}
            hint={TEXTS.completeHint}
            placeholder={TEXTS.completePlaceholder}
            maxLength={APPOINTMENT_REPORT_MAX_LENGTH}
            rows={6}
            required
            value={reportNotes}
            onChange={(event) => setReportNotes(event.target.value)}
            disabled={workflow.kind === "working"}
            className="mt-4"
          />
          <Button
            type="submit"
            isLoading={workflow.kind === "working" && workflow.action === "complete"}
            disabled={reportNotes.trim().length === 0}
            className="mt-4"
            data-testid="complete-appointment"
          >
            {workflow.kind === "working" && workflow.action === "complete"
              ? TEXTS.completing
              : TEXTS.complete}
          </Button>
        </form>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {appointmentState.canBeConfirmed ? (
          <Button
            isLoading={workflow.kind === "working" && workflow.action === "confirm"}
            onClick={() => void confirm()}
            data-testid="confirm-appointment"
          >
            {workflow.kind === "working" && workflow.action === "confirm"
              ? TEXTS.confirming
              : TEXTS.confirm}
          </Button>
        ) : null}
        {appointmentState.status === "done" && appointmentState.canBeFollowedThrough ? (
          <Button
            isLoading={state.kind === "running"}
            onClick={() => void run()}
            data-testid="run-sarah"
          >
            {state.kind === "running" ? TEXTS.running : TEXTS.run}
          </Button>
        ) : appointmentState.status === "done" ? (
          <p className="text-sm font-medium text-ink-muted" data-testid="sarah-blocked-reason">
            {TEXTS.blockedNoReport}
          </p>
        ) : null}
        <Link
          href={`/contacts/${appointment.contactId}`}
          className="rounded-xs text-sm underline underline-offset-2 hover:text-ink-muted"
        >
          {TEXTS.openContact}
        </Link>
        {appointment.lastFollowThroughRunId && !result ? (
          <ButtonLink
            href={`/agents-ia/executions/${appointment.lastFollowThroughRunId}`}
            variant="ghost"
            size="sm"
          >
            {TEXTS.viewReplay}
          </ButtonLink>
        ) : null}
      </div>
      {appointmentState.status === "done" && appointmentState.canBeFollowedThrough ? (
        <p className="mt-2 text-xs text-ink-muted">{TEXTS.runHint}</p>
      ) : null}

      <div aria-live="polite">
        {workflow.kind === "error" ? (
          <Alert
            tone="error"
            title={TEXTS.workflowErrorTitle}
            className="mt-4"
            testId="appointment-workflow-error"
          >
            {workflow.message}
          </Alert>
        ) : workflow.kind === "success" ? (
          <Alert tone="success" className="mt-4" testId="appointment-workflow-success">
            {workflow.message}
          </Alert>
        ) : null}
      </div>

      <div aria-live="polite">
        {state.kind === "error" ? (
          <Alert tone="error" title={TEXTS.errorActionTitle} className="mt-4" testId="sarah-error">
            {state.message}
          </Alert>
        ) : null}

        {result ? (
          <Alert tone="success" title={TEXTS.successTitle} className="mt-4" testId="sarah-result">
            <p>{result.decisionText}</p>
            <p className="mt-2 text-xs">
              {result.stageChanged ? TEXTS.stageChanged : TEXTS.stageUnchanged}
              {result.tasks.length > 0 ? ` ${TEXTS.taskCount(result.tasks.length)}` : ""}
            </p>
          </Alert>
        ) : null}
      </div>

      {result ? (
        <>
          <section className="mt-4 rounded-lg border border-line bg-surface-muted p-4" data-testid="sarah-analysis">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{TEXTS.summary}</h3>
              {result.isSimulation ? <SimulationBadge /> : null}
            </div>
            <p className="mt-2 text-sm text-ink">{result.followThrough.summary}</p>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4">
              <p className="text-sm text-ink-muted">
                {TEXTS.sellerPosition} : <span className="font-medium text-ink">{result.sellerDecisionLabel}</span>
              </p>
              <EstimationPresented value={result.followThrough.estimation_presented} />
            </div>
            <div className="mt-5 grid gap-5 border-t border-line pt-4 md:grid-cols-3">
              <ResultList title={TEXTS.objections} items={result.followThrough.objections} empty={TEXTS.noObjection} />
              <ResultList
                title={TEXTS.missingDocuments}
                items={result.followThrough.missing_documents}
                empty={TEXTS.noMissingDocument}
              />
              <ResultList
                title={TEXTS.nextSteps}
                items={result.followThrough.next_steps.map((step) => step.title)}
                empty={TEXTS.noNextStep}
              />
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-line bg-surface-muted p-4" data-testid="sarah-replay">
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
