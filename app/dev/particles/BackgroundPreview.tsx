"use client";

import Link from "next/link";
import { useState } from "react";

import { ParticleScene } from "@/components/motion/ParticleScene";
import { PARTICLE_PRESETS, type ParticlePreset } from "@/components/motion/shapes";

import { PARTICLE_GALLERY_TEXTS as T, PRESET_LABELS } from "./gallery-texts";

/**
 * Development preview of the full-page background mode (spec §9): one fixed
 * canvas behind sample content, with the confirmed budget. Not the jalon 3
 * integration: the app layout is untouched.
 */
export function BackgroundPreview({ initial }: { initial: ParticlePreset }) {
  const [preset, setPreset] = useState<ParticlePreset>(initial);
  return (
    <>
      <ParticleScene preset={preset} mode="background" />
      <main className="relative z-10 mx-auto min-h-dvh max-w-5xl px-6 py-12 sm:px-10 lg:py-16">
        <p className="text-overline font-semibold uppercase text-ink-subtle">{T.overline}</p>
        <h1 className="mt-3 text-title font-semibold text-balance">{T.backgroundTitle}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">{T.backgroundIntro}</p>
        <div role="group" aria-label={T.transitionGroup} className="mt-6 flex flex-wrap gap-2">
          {PARTICLE_PRESETS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPreset(item)}
              aria-pressed={preset === item}
              className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-pressed:border-inverse aria-pressed:bg-inverse aria-pressed:text-ink-inverse"
            >
              {PRESET_LABELS[item].screen}
            </button>
          ))}
        </div>
        <section className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-subtle">
          <h2 className="text-heading font-semibold">{T.backgroundCardTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">{T.backgroundCardBody}</p>
        </section>
        <Link href="/dev/particles" className="mt-8 inline-block text-sm text-ink underline-offset-4 hover:underline">
          {T.soloBack}
        </Link>
      </main>
    </>
  );
}
