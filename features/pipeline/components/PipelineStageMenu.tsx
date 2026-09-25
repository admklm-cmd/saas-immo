"use client";

import { CheckIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { AnimatedErrorState } from "@/components/ui/AnimatedErrorState";
import { cn } from "@/components/ui/cn";
import { isRetryableErrorCode } from "@/components/ui/retryable";
import { ThreeDotLoader } from "@/components/ui/ThreeDotLoader";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/features/contacts/types";
import { changeContactStage } from "@/features/pipeline/actions";
import { PIPELINE_STAGES } from "@/features/pipeline/types";

import { MandateEnterDialog } from "./MandateEnterDialog";
import { MandateExitDialog } from "./MandateExitDialog";
import styles from "./PipelineBoard.module.css";
import { useStageChangeAnnouncer } from "./PipelineStageChangeProvider";

const TEXTS = APP_TEXTS.pipeline.stageChange;
const SIGNED: PipelineStage = "mandat_signe";

export type PipelineStageMenuProps = {
  contactId: string;
  contactName: string;
  stage: PipelineStage;
  /** Display only (the database decides): explains why leaving « Mandat signé » is disabled. */
  canExitSignedMandate: boolean;
};

type DialogState = { kind: "enter" | "exit"; target: PipelineStage } | null;

/**
 * « Changer d'étape » on a pipeline card — keyboard first, no drag-and-drop.
 *
 * A small disclosure button (top-right corner of the card, named « Changer
 * d'étape pour {nom} ») unfolds, inside the card, a list of every stage (the
 * current one is marked, not selectable). A plain move is sent at once; entering or leaving
 * « Mandat signé » goes through a confirmation dialog. The rules shown here
 * are explanations only: `changeContactStage` and the database enforce them.
 */
export function PipelineStageMenu({ contactId, contactName, stage, canExitSignedMandate }: PipelineStageMenuProps) {
  const router = useRouter();
  const { announce, consumeFocus } = useStageChangeAnnouncer();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PipelineStage | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // « Réessayer » only after a technical failure, never after a rule refusal.
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Synchronous guard: a double click fires twice before React re-renders.
  const inFlight = useRef(false);

  const panelId = useId();
  const titleId = useId();
  const lockedNoteId = useId();

  const exitLocked = stage === SIGNED && !canExitSignedMandate;

  // The card was re-rendered in its new column: give it the focus back (the
  // browser brings it into view, natively), and let the card and the node of
  // its new stage play their one « arrived » motion (presentation only).
  useEffect(() => {
    if (!consumeFocus(contactId)) return;
    triggerRef.current?.focus({ preventScroll: true });
    markArrival(triggerRef.current);
  }, [consumeFocus, contactId]);

  // First selectable option gets the focus when the panel opens.
  useEffect(() => {
    if (!open) return;
    const options = optionsOf(panelRef.current);
    const first = options.find((option) => option.getAttribute("aria-current") !== "true") ?? options[0];
    first?.focus();
  }, [open]);

  // A click outside closes the panel (never while a request is running).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (inFlight.current) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSelected(null);
        setError(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function closePanel(returnFocus: boolean) {
    setOpen(false);
    setSelected(null);
    setError(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  async function submit(target: PipelineStage, mandateConfirmed: boolean, reason: string | null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const { data, error: actionError } = await changeContactStage({
        contactId,
        stage: target,
        mandateConfirmed,
        reason,
      });
      if (actionError) {
        // Already a precise French message (STAGE_CHANGE_ERROR_MESSAGES).
        setError(actionError.message);
        setErrorRetryable(isRetryableErrorCode(actionError.code));
        return;
      }
      announce(TEXTS.success(contactName, PIPELINE_STAGE_LABELS[data.stage]), contactId);
      setDialog(null);
      setOpen(false);
      setSelected(null);
      router.refresh();
    } catch {
      setError(APP_TEXTS.states.unexpected);
      setErrorRetryable(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function choose(target: PipelineStage) {
    if (pending || target === stage || exitLocked) return;
    setSelected(target);
    setError(null);
    if (stage === SIGNED) {
      setOpen(false);
      setDialog({ kind: "exit", target });
    } else if (target === SIGNED) {
      setOpen(false);
      setDialog({ kind: "enter", target });
    } else {
      void submit(target, false, null);
    }
  }

  function cancelDialog() {
    if (inFlight.current) return;
    setDialog(null);
    setSelected(null);
    setError(null);
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!inFlight.current) closePanel(true);
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const options = optionsOf(panelRef.current);
    if (options.length === 0) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const last = options.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowDown"
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length;
    options[next]?.focus();
  }

  return (
    <div ref={containerRef} data-sensitive="">
      {/* Discreet but always there: the glyph of a dossier sent along the line.
          Its full name is read by screen readers and shown on hover / focus. */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? closePanel(false) : setOpen(true))}
        data-testid="stage-menu-trigger"
        className={cn(
          styles.trigger,
          "ui-focus absolute top-2 right-2 grid size-8 place-items-center rounded-full text-ink-subtle",
          "transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink",
          "aria-expanded:bg-surface-sunken aria-expanded:text-ink",
        )}
      >
        <span className="sr-only">
          {TEXTS.trigger} {TEXTS.triggerFor(contactName)}
        </span>
        <Glyph name="stageMove" width={16} />
        <span
          aria-hidden="true"
          className={cn(
            styles.tip,
            "pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 rounded-md bg-inverse px-2 py-1 text-xs font-medium whitespace-nowrap text-ink-inverse shadow-raised",
          )}
        >
          {TEXTS.trigger}
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-labelledby={titleId}
          aria-busy={pending || undefined}
          onKeyDown={onPanelKeyDown}
          data-testid="stage-menu"
          className="mx-1.5 mb-1.5 animate-rise-soft rounded-lg border border-line bg-surface-muted p-1.5"
        >
          <p id={titleId} className="px-2.5 pt-1.5 pb-1 text-overline font-semibold text-ink-subtle uppercase">
            {TEXTS.menuTitle}
          </p>

          {exitLocked ? (
            <p id={lockedNoteId} className="mx-1 mb-1.5 rounded-md bg-surface-sunken px-2.5 py-2 text-xs leading-relaxed text-ink-muted">
              {TEXTS.exitDirectorOnly}
            </p>
          ) : null}

          <ul className="flex flex-col">
            {PIPELINE_STAGES.map((option) => {
              const isCurrent = option === stage;
              const isSelected = option === selected;
              const locked = !isCurrent && exitLocked;
              const needsDialog = !isCurrent && (option === SIGNED || stage === SIGNED);
              return (
                <li key={option}>
                  <button
                    type="button"
                    data-stage-option={option}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-disabled={isCurrent || locked || (pending && !isSelected) ? "true" : undefined}
                    aria-busy={pending && isSelected ? true : undefined}
                    aria-describedby={locked ? lockedNoteId : undefined}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                      "transition-colors duration-150 ease-standard",
                      isCurrent || locked
                        ? "cursor-default text-ink-subtle"
                        : "text-ink hover:bg-surface-sunken focus-visible:bg-surface-sunken",
                      isSelected && "bg-surface-sunken font-medium",
                    )}
                  >
                    <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
                      {pending && isSelected ? (
                        <ThreeDotLoader size="sm" />
                      ) : isCurrent ? (
                        <CheckIcon className="size-4" />
                      ) : null}
                    </span>
                    <span className="flex-1">{PIPELINE_STAGE_LABELS[option]}</span>
                    {isCurrent ? <span className="text-xs text-ink-subtle">{TEXTS.currentStage}</span> : null}
                    {needsDialog && !locked ? (
                      <span className="text-xs text-ink-subtle">{TEXTS.requiresConfirmation}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {pending ? (
            <p className="px-2.5 pt-1.5 pb-1 text-xs text-ink-muted" role="status">
              {TEXTS.pending}
            </p>
          ) : null}

          {error ? (
            <AnimatedErrorState
              title={TEXTS.errorTitle}
              className="mt-1.5"
              testId="stage-change-error"
              onRetry={errorRetryable && selected ? () => choose(selected) : undefined}
            >
              {error}
            </AnimatedErrorState>
          ) : null}
        </div>
      ) : null}

      {dialog?.kind === "enter" ? (
        <MandateEnterDialog
          contactName={contactName}
          fromLabel={PIPELINE_STAGE_LABELS[stage]}
          pending={pending}
          error={error}
          onCancel={cancelDialog}
          onConfirm={(confirmed) => void submit(dialog.target, confirmed, null)}
          returnFocusRef={triggerRef}
        />
      ) : null}

      {dialog?.kind === "exit" ? (
        <MandateExitDialog
          contactName={contactName}
          toLabel={PIPELINE_STAGE_LABELS[dialog.target]}
          pending={pending}
          error={error}
          onCancel={cancelDialog}
          onConfirm={(confirmed, reason) => void submit(dialog.target, confirmed, reason)}
          returnFocusRef={triggerRef}
        />
      ) : null}
    </div>
  );
}

function optionsOf(panel: HTMLElement | null): HTMLButtonElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLButtonElement>("button[data-stage-option]"));
}

/** How long the « arrived » marks stay on the card and its column (longest animation + margin). */
const ARRIVAL_MS = 900;

/**
 * Marks the card that has just changed column, and that column, so their CSS
 * animation plays once (PipelineBoard.module.css; none under reduced motion).
 * Presentation only: the move itself is already done and announced.
 */
function markArrival(trigger: HTMLElement | null): void {
  const card = trigger?.closest<HTMLElement>('[data-testid="pipeline-contact"]');
  const column = trigger?.closest<HTMLElement>("[data-pipeline-column]");
  if (!card) return;
  // Native, instant, and only as much as needed: the card and the head of its
  // column come into view; nothing moves when they already are.
  card.scrollIntoView({ block: "nearest", inline: "nearest" });
  card.setAttribute("data-arrived", "");
  column?.setAttribute("data-arrival", "");
  // Not cleared on unmount: removing an attribute from a detached node is harmless.
  window.setTimeout(() => {
    card.removeAttribute("data-arrived");
    column?.removeAttribute("data-arrival");
  }, ARRIVAL_MS);
}
