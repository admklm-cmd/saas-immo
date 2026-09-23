"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** How long the success pill stays on screen. The card itself has moved: the pill only confirms it. */
const ANNOUNCEMENT_MS = 6000;

type StageChangeContextValue = {
  /** Announces a successful change and asks the moved card to take the focus back. */
  announce: (message: string, contactId: string) => void;
  /** True once, for the card that must receive the focus after it moved column. */
  consumeFocus: (contactId: string) => boolean;
};

const NOOP: StageChangeContextValue = {
  announce: () => {},
  consumeFocus: () => false,
};

const StageChangeContext = createContext<StageChangeContextValue>(NOOP);

export function useStageChangeAnnouncer(): StageChangeContextValue {
  return useContext(StageChangeContext);
}

/**
 * Board-level state of the stage change, shared by every card.
 *
 * A card that changes stage is re-rendered in ANOTHER column, so it cannot
 * host its own confirmation: the polite live region lives here, above the
 * cards, and survives the server refresh. The same provider remembers which
 * card must get the keyboard focus back once it has moved.
 */
export function PipelineStageChangeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), ANNOUNCEMENT_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const announce = useCallback((text: string, contactId: string) => {
    pendingFocus.current = contactId;
    setMessage(text);
  }, []);

  const consumeFocus = useCallback((contactId: string) => {
    if (pendingFocus.current !== contactId) return false;
    pendingFocus.current = null;
    return true;
  }, []);

  const value = useMemo(() => ({ announce, consumeFocus }), [announce, consumeFocus]);

  return (
    <StageChangeContext.Provider value={value}>
      {children}
      {/* Always in the DOM, so screen readers pick up every new message. */}
      <div
        role="status"
        aria-live="polite"
        data-testid="pipeline-stage-status"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6"
      >
        {message ? (
          <p className="panel-blur-inverse flex max-w-md animate-rise-soft items-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium text-ink-inverse shadow-overlay">
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs"
            >
              ✓
            </span>
            {message}
          </p>
        ) : null}
      </div>
    </StageChangeContext.Provider>
  );
}
