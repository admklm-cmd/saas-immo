import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Disclosure } from "@/components/ui/Disclosure";

/** Renders the folded process of one run; provided by the page (server read). */
export type RenderRunProcess = (runId: string) => ReactNode;

/**
 * « Voir le processus » under a run listed on « Agents IA »: a native
 * `<details>`, closed by default, keyboard reachable. The content (the compact
 * process, read on the server) is passed in by the page, so the list
 * components stay synchronous and testable on their own.
 */
export function RunProcessDisclosure({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Disclosure
      summary={APP_TEXTS.runProcess.summary}
      testId="run-process-disclosure"
      className={className}
      contentClassName="pt-3"
    >
      {children}
    </Disclosure>
  );
}
