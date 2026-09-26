"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";

import { cn } from "./cn";

export type DialogProps = {
  open: boolean;
  /** Called on Escape, backdrop click or an explicit cancel. The parent owns `open`. */
  onClose: () => void;
  title: ReactNode;
  /** Short summary read with the title (`aria-describedby`). */
  description?: ReactNode;
  children?: ReactNode;
  /** Actions, right-aligned on desktop, stacked full width on mobile. */
  footer?: ReactNode;
  /**
   * False while a request is in flight: Escape and backdrop clicks are
   * ignored, so the user never loses sight of an action that is still running.
   */
  dismissible?: boolean;
  /**
   * Element that gets the focus back once the dialog closes. Defaults to the
   * element focused when it opened, if it is still in the document.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
  testId?: string;
};

/**
 * Modal confirmation built on the native `<dialog>` element.
 *
 * `showModal()` gives, for free and without a dependency: the top layer, an
 * inert page behind (focus cannot leave the dialog), Escape to cancel and the
 * `::backdrop`. This component only adds the labelling, the return of focus
 * and a consistent look. Never `window.confirm()`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  returnFocusRef,
  testId,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(returnFocusRef);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    returnFocus.current = returnFocusRef;
  }, [returnFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function restoreFocus() {
      const target = returnFocus.current?.current ?? previouslyFocused.current;
      if (target && target.isConnected) target.focus();
    }

    if (open && !dialog.open) {
      previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      restoreFocus();
    }

    // Unmounted while open (conditional rendering by the parent): leave the
    // top layer free and give the focus back all the same.
    return () => {
      if (dialog.open) {
        dialog.close();
        restoreFocus();
      }
    };
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    // A click on the dialog element itself (not its content) is a click on the backdrop.
    if (event.target === event.currentTarget && dismissible) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid={testId}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Escape: React state stays the single source of truth.
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={handleBackdropClick}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay",
        "open:animate-settle backdrop:bg-inverse/30 backdrop:backdrop-blur-sm",
      )}
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <h2 id={titleId} className="text-heading font-bold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink-muted">
                {description}
              </div>
            ) : null}
          </div>

          {children}

          {footer ? (
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
