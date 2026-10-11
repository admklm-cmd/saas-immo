"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { ParticleScene } from "@/components/motion/ParticleScene";
import { PARTICLE_PRESETS, SHAPES, type ParticlePreset } from "@/components/motion/shapes";
import { Button } from "@/components/ui/Button";

import { PARTICLE_GALLERY_TEXTS as T, PRESET_LABELS } from "./gallery-texts";

const MAX_TIME = 18;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function PresetCaption({ preset }: { preset: ParticlePreset }) {
  const cycle = SHAPES[preset].cycle;
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{PRESET_LABELS[preset].screen}</h2>
        <p className="mt-1 text-xs text-ink-muted">{PRESET_LABELS[preset].form}</p>
      </div>
      <p className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-1 font-mono text-xs text-ink-muted">
        {cycle ? T.loop(cycle) : T.endless}
      </p>
    </div>
  );
}

export function ParticleGallery({ only }: { only: ParticlePreset | null }) {
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [time, setTime] = useState(8);
  const [selected, setSelected] = useState<ParticlePreset>("agents");
  const reduced = useReducedMotion();
  const sliderId = useId();
  const frozenTime = frozen ? time : null;

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 py-12 sm:px-10 lg:py-16">
      <header className="max-w-3xl">
        <p className="text-overline font-semibold uppercase text-ink-subtle">{T.overline}</p>
        <h1 className="mt-3 text-title font-semibold text-balance">{T.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">{T.intro}</p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-line bg-surface px-5 py-4 shadow-subtle">
        <Button variant="secondary" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
          {paused ? T.resume : T.pause}
        </Button>
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={frozen} onChange={(event) => setFrozen(event.target.checked)} className="size-4 accent-ink" />
          {T.freeze}
        </label>
        <div className="flex min-w-60 flex-1 items-center gap-3">
          <label htmlFor={sliderId} className="shrink-0 text-sm text-ink-muted">
            {T.timeLabel}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={MAX_TIME}
            step={0.1}
            value={time}
            disabled={!frozen}
            aria-valuetext={T.timeValue(time)}
            onChange={(event) => setTime(Number(event.target.value))}
            className="w-full accent-ink disabled:opacity-40"
          />
          <output htmlFor={sliderId} className="w-20 shrink-0 text-right font-mono text-xs text-ink" data-testid="frozen-time">
            {T.timeValue(time)}
          </output>
        </div>
        <p className="text-sm text-ink-muted">
          {T.reducedMotion} : <strong className="font-semibold text-ink">{reduced ? T.reducedOn : T.reducedOff}</strong>
        </p>
      </div>

      {only ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-subtle" data-testid={`scene-${only}`}>
          <div className="h-[26rem]">
            <ParticleScene preset={only} paused={paused} frozenTime={frozenTime} />
          </div>
          <PresetCaption preset={only} />
          <div className="border-t border-line px-5 py-3">
            <Link href="/dev/particles" className="text-sm text-ink underline-offset-4 hover:underline">
              {T.soloBack}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PARTICLE_PRESETS.map((preset) => (
              <section key={preset} className="overflow-hidden rounded-xl border border-line bg-surface shadow-subtle" data-testid={`scene-${preset}`}>
                <div className="h-44">
                  <ParticleScene preset={preset} paused={paused} frozenTime={frozenTime} />
                </div>
                <PresetCaption preset={preset} />
              </section>
            ))}
          </div>

          <section className="mt-10 overflow-hidden rounded-xl border border-line bg-surface shadow-subtle">
            <div className="px-5 pt-5">
              <h2 className="text-heading font-semibold">{T.transitionTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-muted">{T.transitionIntro}</p>
              <div role="group" aria-label={T.transitionGroup} className="mt-4 flex flex-wrap gap-2">
                {PARTICLE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelected(preset)}
                    aria-pressed={selected === preset}
                    className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-pressed:border-inverse aria-pressed:bg-inverse aria-pressed:text-ink-inverse"
                  >
                    {PRESET_LABELS[preset].screen}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 h-80" data-testid="scene-transition">
              <ParticleScene preset={selected} paused={paused} frozenTime={frozenTime} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
