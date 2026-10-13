import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { ErrorDots } from "@/components/ui/ErrorDots";
import { AgentAppIcon, type AppIconState } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { PAUSED_TOKENS, type AtelierModel, type Station } from "./atelier-model";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const ATELIER = TEXTS.atelier;

/** Barrier + hollow tokens in front of a station: horizontal rail (md and up) or vertical (below). */
const BARRIER_POSITION =
  "top-[calc(1.75rem-0.6875rem)] left-[calc(50%-2.75rem)] h-[1.375rem] w-0.5 max-md:top-[-0.5rem] max-md:left-[calc(1.75rem-0.6875rem)] max-md:h-0.5 max-md:w-[1.375rem]";

function HollowToken({ k }: { k: number }) {
  return (
    <span
      aria-hidden="true"
      data-testid="atelier-blocked-token"
      className="absolute top-[calc(1.75rem-0.25rem)] size-2 rounded-[1px] border border-dashed border-ink bg-transparent max-md:top-[-0.75rem]"
      style={{ left: `calc(50% - ${3.25 + k * 0.9}rem)` }}
    />
  );
}

function PostedToken({ k, variant }: { k: number; variant: "waiting" | "mandate" }) {
  const waiting = variant === "waiting";
  return (
    <span
      aria-hidden="true"
      data-posed={variant}
      data-testid={`atelier-${variant}-token`}
      className={cn(
        "absolute size-2 rounded-[1px] transition-opacity duration-(--duration-slow) ease-standard group-data-[playing=true]/scene:opacity-0",
        waiting
          ? "top-[calc(1.75rem-0.25rem)] bg-ink max-md:top-[-0.75rem]"
          : "top-[calc(1.75rem-0.25rem)] left-[calc(50%-0.25rem)] bg-surface max-md:left-[calc(1.75rem-0.25rem)]",
      )}
      style={waiting ? { left: `calc(50% - ${2.6 + k * 0.8}rem)` } : undefined}
    />
  );
}

export type AtelierStationProps = {
  station: Station;
  index: number;
  model: AtelierModel;
  active: boolean;
  last: boolean;
};

/**
 * One station of the workshop. The written figures (what the agent recorded, what a guard rail
 * blocked, technical errors) are always in the HTML; the tokens and barriers are decoration
 * placed from the same numbers. « Bloqué par un garde-fou » is not an error and says so.
 */
export function AtelierStation({ station, index, model, active, last }: AtelierStationProps) {
  const unavailable = model.mode === "unavailable";
  const paused = model.mode === "paused";
  const state: AppIconState = paused || unavailable ? "inactive" : active ? "active" : "idle";
  const rail = model.rails[index] ?? 3;
  const isAgent = station.kind === "agent";
  const humanWaiting = station.id === "human" ? model.humanWaiting : null;
  const mandates = station.id === "mandate" ? model.mandates : null;
  // Paused workshop: the dossiers rest hollow in front of Léa, behind a thick barrier.
  const hollow = unavailable ? 0 : paused ? (station.id === "lea" ? PAUSED_TOKENS : 0) : isAgent ? station.blockedVisible : 0;
  const waitingReal = station.id === "human" && (humanWaiting ?? 0) > 0 && !paused && !unavailable;

  return (
    <li
      data-testid={`atelier-station-${station.id}`}
      data-station={station.id}
      data-blocked-visible={isAgent ? station.blockedVisible : undefined}
      className="relative flex items-start gap-4 pb-6 text-left md:flex-col md:items-center md:gap-3 md:pb-0 md:text-center"
    >
      {last ? null : (
        <span
          aria-hidden="true"
          data-testid="atelier-rail"
          className={cn(
            "absolute z-0 bg-ink-subtle [--rail-angle:90deg] max-md:[--rail-angle:180deg]",
            "top-[calc(1.75rem-var(--rail)/2)] left-1/2 h-(--rail) w-full max-md:top-7 max-md:left-[calc(1.75rem-var(--rail)/2)] max-md:h-full max-md:w-(--rail)",
            (paused || unavailable) && "bg-transparent",
          )}
          style={{
            ["--rail" as string]: `${unavailable ? 1.5 : rail}px`,
            ...(paused || unavailable
              ? {
                  backgroundImage: `repeating-linear-gradient(var(--rail-angle, 90deg), var(--color-ink-subtle) 0 5px, transparent 5px 10px)`,
                }
              : null),
          }}
        />
      )}

      <div data-anchor className={cn("relative z-10 size-14 shrink-0", waitingReal && "rounded-2xl outline-2 outline-offset-4 outline-accent")}>
        <AgentAppIcon glyph={station.glyph} kind={station.kind} size="lg" state={state} />
      </div>

      {hollow > 0 ? (
        <>
          <span
            aria-hidden="true"
            data-testid="atelier-barrier"
            className={cn("absolute z-10 rounded-full bg-ink", BARRIER_POSITION, paused && "md:w-1 md:scale-y-[1.8] max-md:h-1 max-md:scale-x-[1.8]")}
          />
          {Array.from({ length: hollow }, (_, k) => (
            <HollowToken key={k} k={k} />
          ))}
        </>
      ) : null}
      {station.id === "human" && !paused && !unavailable
        ? Array.from({ length: model.waitingTokens }, (_, k) => <PostedToken key={k} k={k} variant="waiting" />)
        : null}
      {station.id === "mandate" && model.mandateToken && !paused && !unavailable ? <PostedToken k={0} variant="mandate" /> : null}

      <div className="min-w-0 md:w-full md:max-w-full md:px-1">
        <p className="text-sm font-semibold text-ink">
          {station.name}
          {station.job ? <span className="font-normal text-ink-muted"> · {station.job}</span> : null}
        </p>

        {unavailable ? (
          <p className="figure mt-1 text-base font-medium text-ink" data-testid="atelier-unavailable">
            {TEXTS.unavailable}
          </p>
        ) : isAgent ? (
          <>
            <p className="mt-1">
              <span className="figure text-xl font-medium text-ink" data-testid="atelier-recorded">
                {station.recorded ?? 0}
              </span>
            </p>
            <p className="text-xs text-ink-muted">{station.recorded === 1 ? ATELIER.recordedOne : ATELIER.recorded}</p>
            <p className="mt-1 text-xs text-ink-muted" title={ATELIER.blockedHint} data-testid="atelier-blocked">
              {ATELIER.blocked(station.blocked)}
            </p>
            <p className="flex items-center justify-start gap-1.5 text-xs text-ink-muted md:justify-center" data-testid="atelier-errors">
              {station.failed > 0 ? <ErrorDots /> : null}
              {ATELIER.errors(station.failed)}
            </p>
          </>
        ) : station.id === "human" ? (
          <p className="mt-1 text-xs text-ink-muted" data-testid="atelier-human-waiting">
            {humanWaiting === null ? TEXTS.unavailable : humanWaiting > 0 ? ATELIER.humanWaiting(humanWaiting) : ATELIER.humanNone}
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-muted" data-testid="atelier-mandates">
              {mandates === null ? TEXTS.unavailable : ATELIER.mandateCount(mandates)}
            </p>
            <p className="text-xs text-ink-muted">{ATELIER.mandateSeal}</p>
          </>
        )}
      </div>
    </li>
  );
}
