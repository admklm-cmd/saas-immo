"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";

const TEXTS = APP_TEXTS.tasks;

type Announcement = { tone: "success" | "info"; title?: string; message: string };

type TaskCompletionContextValue = {
  /**
   * Announces the outcome of « Marquer comme faite », then re-reads the list
   * server-side: the closed task leaves the list and the total is recounted.
   */
  announce: (announcement: Announcement) => void;
};

const TaskCompletionContext = createContext<TaskCompletionContextValue>({ announce: () => {} });

export function useTaskCompletion(): TaskCompletionContextValue {
  return useContext(TaskCompletionContext);
}

/**
 * List-level state of « Marquer comme faite ».
 *
 * A completed task disappears from the server-rendered list, so it cannot
 * host its own confirmation: the polite live region lives here, above the
 * list, and survives the refresh. The keyboard focus is moved onto it, so it
 * is never lost on the body when the row vanishes.
 */
export function TaskCompletionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback(
    (next: Announcement) => {
      setAnnouncement(next);
      router.refresh();
      // After the paint that shows the message.
      window.requestAnimationFrame(() => regionRef.current?.focus());
    },
    [router],
  );

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <TaskCompletionContext.Provider value={value}>
      {/* Always in the DOM, so screen readers pick up every new message. */}
      <div
        ref={regionRef}
        tabIndex={-1}
        aria-live="polite"
        data-testid="task-completion-status"
        className="rounded-lg"
      >
        {announcement ? (
          <Alert
            tone={announcement.tone}
            title={announcement.title ?? (announcement.tone === "info" ? TEXTS.alreadyDoneTitle : undefined)}
            className="mb-6"
          >
            {announcement.message}
          </Alert>
        ) : null}
      </div>
      {children}
    </TaskCompletionContext.Provider>
  );
}
