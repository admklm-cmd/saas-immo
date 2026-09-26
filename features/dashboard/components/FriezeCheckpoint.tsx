import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import type { FriezeCheckpointStep } from "./frieze";
import { FriezeRail } from "./FriezeRail";

const TEXTS = APP_TEXTS.dashboard;

/**
 * A human checkpoint on the line: the shape of a person deciding (circle with
 * a double contour, same family as the rail of /agents-ia). A thin cobalt ring
 * appears ONLY when something really waits for a person right now; at zero it
 * stays grey, and an unavailable count is dashed and says so.
 *
 * The count is a link to the screen where that decision is taken.
 */
export function FriezeCheckpoint({ step, first = false }: { step: FriezeCheckpointStep; first?: boolean }) {
  const texts = TEXTS.friezeCheckpoints[step.id];
  const value = step.total.status === "ok" ? step.total.value : null;
  const waiting = value !== null && value > 0;

  return (
    <li
      data-testid={`dashboard-checkpoint-${step.id}`}
      data-waiting={waiting ? "true" : "false"}
      className="relative flex min-w-0 xl:w-28 xl:shrink-0 xl:flex-col"
    >
      <FriezeRail first={first}>
        <AgentAppIcon
          glyph="human"
          kind="human"
          size="sm"
          state={value === null ? "inactive" : waiting ? "active" : "idle"}
        />
      </FriezeRail>

      <div className="order-2 flex min-w-0 items-center py-2 pl-3 xl:order-3 xl:justify-center xl:px-1 xl:pt-3 xl:pb-0 xl:text-center">
        <Link
          href={step.href}
          className={cn(
            "group/checkpoint inline-flex min-w-0 items-baseline gap-1.5 rounded-xs xl:flex-col xl:items-center xl:gap-0.5",
            waiting ? "text-ink" : "text-ink-muted",
          )}
        >
          {value !== null ? (
            <>
              <span className={cn("text-base font-semibold figure xl:text-heading", waiting ? "text-ink" : "text-ink-subtle")}>
                {value}
              </span>
              <span className="text-xs text-balance underline decoration-line-strong underline-offset-4 transition-colors duration-150 ease-standard group-hover/checkpoint:decoration-ink">
                {texts.unit(value)}
              </span>
            </>
          ) : (
            <span className="text-xs underline decoration-line-strong underline-offset-4">
              {texts.title} : {TEXTS.unavailable}
            </span>
          )}
          <span className="sr-only">
            {" "}
            ({TEXTS.scopes[step.total.scope.key]})
          </span>
        </Link>
      </div>

      {/* Keeps the node on the line of the stages (their dots sit above it from 1280 px). */}
      <div aria-hidden="true" className="hidden xl:order-1 xl:block xl:h-[calc(var(--frieze-rows,10)*0.875rem+1.5rem)]" />
    </li>
  );
}
