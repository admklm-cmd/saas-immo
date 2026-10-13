"use client";

import { animate } from "./pilotage-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";

import type { PilotagePeriodKey } from "../../pilotage-periods";
import { AgentsAtelier } from "./AgentsAtelier";
import { FlowBlock } from "./FlowBlock";
import { prefersReducedMotion, SWAP_OUT_MS } from "./motion";
import { OriginBlock } from "./OriginBlock";
import { formatCount, parsePeriodParam, PERIOD_URL_VALUES } from "./pilotage-format";
import type { PilotageView } from "./pilotage-view";
import { PilotageFigures } from "./PilotageFigures";
import { PilotageStage } from "./PilotageStage";
import { PeriodSelector } from "./PeriodSelector";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const SWAP_IN_MS = 220;

export type PilotageDashboardProps = {
  /** One serialisable view per period: switching period is instant, nothing is fetched. */
  views: Record<PilotagePeriodKey, PilotageView>;
  initialPeriod: PilotagePeriodKey;
  /** « À traiter », rendered on the server. */
  reminder: ReactNode;
  /** The lonely dossiers as links, rendered on the server (no name travels in a prop). */
  noActionSample: ReactNode;
  killSwitch: { status: "ok"; paused: boolean } | { status: "unavailable" };
  humanWaiting: number | null;
};

function fadeTargets(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>('[data-swap="chart"]')) : [];
}

/**
 * The boss's statistics page (docs §3.5.2): sticky period bar, « la Scène », « la Feuille »,
 * « l'Atelier ». The four periods are already in the page, so a change of period is
 * instant: the pill slides, the old graphics fade out (140 ms), the new period is shown
 * (figures roll from the old value to the new one) and the graphics draw again. A second
 * choice during the transition goes straight to the last period chosen. The URL keeps the
 * state (`?periode=`) and the back button restores it. Reduced motion: everything changes
 * at once.
 */
export function PilotageDashboard({ views, initialPeriod, reminder, noActionSample, killSwitch, humanWaiting }: PilotageDashboardProps) {
  const [selected, setSelected] = useState<PilotagePeriodKey>(initialPeriod);
  const [shown, setShown] = useState<PilotagePeriodKey>(initialPeriod);
  const [announcement, setAnnouncement] = useState("");
  const [stuck, setStuck] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ stop: () => void } | null>(null);
  const first = useRef(true);

  const view = views[shown];

  const cancelPending = useCallback(() => {
    pending.current?.stop();
    pending.current = null;
    for (const el of fadeTargets(rootRef.current)) {
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
    }
  }, []);

  /** Puts the page on a period at once (no transition): the back button, reduced motion, an interrupted change. */
  const settle = useCallback(
    (key: PilotagePeriodKey) => {
      cancelPending();
      setSelected(key);
      setShown(key);
    },
    [cancelPending],
  );

  const choose = useCallback(
    (key: PilotagePeriodKey) => {
      if (key === selected && key === shown) return;
      window.history.pushState(null, "", `${window.location.pathname}?periode=${PERIOD_URL_VALUES[key]}`);
      if (prefersReducedMotion()) {
        settle(key);
        return;
      }
      // A choice during a transition: straight to the last period chosen, never stacked.
      const interrupted = pending.current !== null;
      cancelPending();
      setSelected(key);
      if (interrupted) {
        setShown(key);
        return;
      }
      const targets = fadeTargets(rootRef.current);
      if (targets.length === 0) {
        setShown(key);
        return;
      }
      const animation = animate(targets, {
        opacity: 0,
        translateY: -4,
        duration: SWAP_OUT_MS,
        ease: "inQuad",
        onComplete: () => {
          pending.current = null;
          setShown(key);
        },
      });
      pending.current = { stop: () => animation.pause() };
    },
    [cancelPending, selected, settle, shown],
  );

  // The back button restores the period of the URL.
  useEffect(() => {
    const onPopState = () => settle(parsePeriodParam(new URLSearchParams(window.location.search).get("periode")));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [settle]);

  // The graphics of the new period come in, and the change is announced once.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const targets = fadeTargets(rootRef.current);
    let animation: ReturnType<typeof animate> | null = null;
    if (targets.length > 0 && !prefersReducedMotion()) {
      animation = animate(targets, {
        opacity: [0, 1],
        translateY: [-4, 0],
        duration: SWAP_IN_MS,
        ease: "outQuad",
        onComplete: () => {
          for (const el of targets) {
            el.style.removeProperty("opacity");
            el.style.removeProperty("transform");
          }
        },
      });
    }
    const stage = views[shown].stage;
    setAnnouncement(TEXTS.announce(views[shown].announce, stage.status === "ok" ? formatCount(stage.value.value) : TEXTS.unavailable));
    return () => {
      animation?.pause();
    };
  }, [shown, views]);

  // The bar is transparent at rest and a discreet frosted panel once it sticks.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setStuck(entry ? !entry.isIntersecting : false), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const stageBlock = view.stage;
  const mandates = stageBlock.status === "ok" ? stageBlock.value.value : null;

  return (
    <div ref={rootRef} data-testid="pilotage" data-period={shown} className="mt-8 lg:mt-10">
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        data-testid="pilotage-bar"
        data-stuck={stuck ? "true" : "false"}
        className="sticky top-16 z-30 -mx-6 border-b border-transparent px-6 py-3 transition-[background-color,border-color] duration-(--duration-base) ease-standard data-[stuck=true]:border-line data-[stuck=true]:bg-canvas/88 data-[stuck=true]:backdrop-blur-md lg:top-0 lg:-mx-10 lg:px-10"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PeriodSelector value={selected} onChange={choose} />
          {reminder}
        </div>
        <p className="figure particle-veil particle-veil-tight mt-2 w-fit max-w-full text-xs leading-5 text-ink-subtle" data-testid="pilotage-scope">
          <span className="hidden md:inline">{view.scopeLine}</span>
          <span className="md:hidden">{view.scopeShort}</span>
        </p>
      </div>
      <p aria-live="polite" role="status" data-testid="pilotage-announce" className="sr-only">
        {announcement}
      </p>

      <div className="mt-4 flex flex-col gap-6">
        <PilotageStage view={view} />

        <section
          aria-label={TEXTS.title}
          data-testid="pilotage-sheet"
          className="rounded-[1.25rem] border border-line bg-surface p-6 sm:rounded-3xl sm:p-8 lg:p-10"
        >
          <PilotageFigures view={view} sample={noActionSample} />
          <div className="mt-10 grid gap-10 border-t border-line pt-10 wide:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] wide:gap-0">
            <div className="wide:pr-10">
              <OriginBlock view={view} />
            </div>
            <div className="border-t border-line pt-10 wide:border-t-0 wide:border-l wide:pt-0 wide:pl-10">
              <FlowBlock view={view} />
            </div>
          </div>
        </section>

        <AgentsAtelier view={view} killSwitch={killSwitch} humanWaiting={humanWaiting} mandates={mandates} />
      </div>
    </div>
  );
}
