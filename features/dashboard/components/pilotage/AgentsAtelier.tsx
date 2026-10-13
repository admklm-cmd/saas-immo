"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import { buildAtelierModel, STATION_ORDER } from "./atelier-model";
import { playAtelier, TOKEN_COUNT, type AtelierPlayback } from "./atelier-timeline";
import { AtelierStation } from "./AtelierStation";
import { prefersReducedMotion } from "./motion";
import type { PilotageView } from "./pilotage-view";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const ATELIER = TEXTS.atelier;
/** The scene starts when this share of it is on screen (docs §3.5.2.F: 40 %). */
const PLAY_SHARE = 0.4;
const HUMAN_INDEX = STATION_ORDER.indexOf("human");

export type AgentsAtelierProps = {
  view: PilotageView;
  /** Read on its own: it stays true to the agency even when the counts are unavailable. */
  killSwitch: { status: "ok"; paused: boolean } | { status: "unavailable" };
  /** Messages waiting for a human right now (a snapshot); `null` when it could not be counted. */
  humanWaiting: number | null;
  /** Mandates signed over the selected period; `null` when unavailable. */
  mandates: number | null;
};

/**
 * « Les agents au travail » (docs §3.5.2.F): an assembly line of five agents, a human
 * checkpoint and the mandate. The figures under each station are the real counts (what an
 * agent recorded in the CRM history, what a guard rail blocked, technical errors); the
 * dossiers drawn are type dossiers. One Anime.js timeline, played once when the scene is
 * on screen, replayable; never started under reduced motion, with the kill switch on, or
 * when the counts are unavailable. At rest nothing moves.
 */
export function AgentsAtelier({ view, killSwitch, humanWaiting, mandates }: AgentsAtelierProps) {
  const paused = killSwitch.status === "ok" && killSwitch.paused;
  const model = useMemo(
    () =>
      buildAtelierModel({
        agents: view.atelier,
        paused,
        humanWaiting,
        mandates,
        names: { human: ATELIER.humanName, mandate: ATELIER.mandateName },
      }),
    [view.atelier, paused, humanWaiting, mandates],
  );

  const sceneRef = useRef<HTMLDivElement>(null);
  const playback = useRef<AtelierPlayback | null>(null);
  const played = useRef(false);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [canReplay, setCanReplay] = useState(false);
  const canPlay = model.mode === "live";

  const stop = useCallback(() => {
    playback.current?.stop();
    playback.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !canPlay || prefersReducedMotion()) return;
    stop();
    const origin = scene.getBoundingClientRect();
    const anchors = Array.from(scene.querySelectorAll<HTMLElement>("[data-anchor]")).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left - origin.left + rect.width / 2, y: rect.top - origin.top + rect.height / 2 };
    });
    const tokens = Array.from(scene.querySelectorAll<HTMLElement>("[data-token]"));
    const bits = Array.from(scene.querySelectorAll<HTMLElement>("[data-bit]"));
    if (anchors.length < STATION_ORDER.length || tokens.length === 0) return;
    setPlaying(true);
    played.current = true;
    playback.current = playAtelier({
      anchors,
      tokens,
      bits,
      humanIndex: HUMAN_INDEX,
      confirmed: model.mandateToken,
      onStation: setActive,
      onDone: () => {
        playback.current = null;
        setPlaying(false);
      },
    });
  }, [canPlay, model.mandateToken, stop]);

  // The scene plays once, when it comes into view. Reading the browser (motion, layout) is what an effect is for.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const allowed = canPlay && !prefersReducedMotion();
    setCanReplay(allowed);
    if (!allowed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (played.current || !entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        play();
      },
      { threshold: PLAY_SHARE },
    );
    observer.observe(scene);
    return () => observer.disconnect();
    // `play` is re-created when the period changes the scene: the observer is not re-armed once it has played.
  }, [canPlay, play]);

  // A new period (or a new state of the kill switch) puts the scene back to its final state, without replaying it.
  useEffect(() => stop, [view.key, paused, stop]);

  return (
    <section
      aria-labelledby="atelier-title"
      data-testid="pilotage-atelier"
      data-mode={model.mode}
      data-playing={playing ? "true" : "false"}
      className="rounded-3xl border border-line bg-pearl-soft px-5 py-8 sm:px-8 sm:py-10"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="atelier-title" className="text-heading font-semibold text-ink">
            {ATELIER.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted" data-testid="atelier-scope">
            {ATELIER.scope(view.eyebrow)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SimulationBadge />
          {killSwitch.status === "ok" ? (
            <p className="text-sm text-ink-muted" data-testid="atelier-kill-switch" data-paused={killSwitch.paused ? "true" : "false"}>
              {killSwitch.paused ? null : ATELIER.killSwitchOff}
            </p>
          ) : (
            <p className="text-sm text-ink-muted" data-testid="atelier-kill-switch">
              {TEXTS.unavailable}
            </p>
          )}
          <Link href="/agents-ia" className="ui-focus inline-flex min-h-11 items-center rounded-xs text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline lg:min-h-8">
            {ATELIER.manage}
          </Link>
        </div>
      </header>

      {paused ? (
        <p
          role="status"
          data-testid="atelier-paused-banner"
          className="mt-5 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm text-ink"
        >
          {ATELIER.killSwitchOn}
        </p>
      ) : null}

      <div ref={sceneRef} data-testid="atelier-scene" data-playing={playing ? "true" : "false"} className="group/scene relative mt-10">
        <ol aria-label={ATELIER.title} className="relative grid gap-0 md:grid-cols-7">
          {model.stations.map((station, index) => (
            <AtelierStation
              key={station.id}
              station={station}
              index={index}
              model={model}
              active={active === index}
              last={index === model.stations.length - 1}
            />
          ))}
        </ol>

        {/* The dossiers of the scene: type dossiers, hidden until the timeline moves them. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
          {Array.from({ length: TOKEN_COUNT }, (_, i) => (
            <span key={i} data-token className="absolute top-0 left-0 grid size-2 place-items-center rounded-[1px] bg-ink opacity-0">
              <span className="size-0.5 bg-surface" />
            </span>
          ))}
          {[0, 1].map((i) => (
            <span key={i} data-bit className="absolute top-0 left-0 size-[3px] bg-accent opacity-0" />
          ))}
        </div>
      </div>

      {model.quiet && model.mode === "live" ? (
        <p className="mt-6 text-sm text-ink-muted" data-testid="atelier-quiet">
          {ATELIER.none}
        </p>
      ) : null}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-ink-subtle">{ATELIER.tokenNote}</p>
        {canReplay ? (
          <button
            type="button"
            onClick={play}
            data-testid="atelier-replay"
            className="ui-focus figure inline-flex min-h-11 items-center rounded-xs px-2 text-xs text-ink-muted hover:text-ink lg:min-h-7"
          >
            {ATELIER.replay}
          </button>
        ) : null}
      </footer>
    </section>
  );
}
