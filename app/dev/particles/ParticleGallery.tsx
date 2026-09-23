"use client";
import { useState } from "react";
import { ParticleScene } from "@/components/motion/ParticleScene";
import { PARTICLE_PRESETS, type ParticlePreset } from "@/components/motion/particle-presets";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { Button } from "@/components/ui/Button";
import { MotionDots } from "@/components/ui/MotionDots";

const labels: Record<ParticlePreset, string> = { veil: "Tableau de bord · Voile", sphere: "Contacts · Sphère", current: "Pipeline · Courant", agents: "Agents IA · Quatre formes", terrain: "Messages à valider · Vortex et relief", grid: "Paramètres · Grille" };
export function ParticleGallery() {
  const [selected, setSelected] = useState<ParticlePreset>("veil");
  const [paused, setPaused] = useState(false);
  return <main className="particle-preview mx-auto w-full max-w-7xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-overline text-ink-muted uppercase">Ascend Strategy · Atelier de mouvement</p><h1 className="mt-3 text-title">Une matière, six expressions.</h1><p className="mt-2 text-sm text-ink-muted">Décoration uniquement. Aucune activité d’agent n’est représentée.</p></div><Button variant="secondary" onClick={() => setPaused(!paused)}>{paused ? "Reprendre" : "Mettre en pause"}</Button></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3">{PARTICLE_PRESETS.map(preset => <section key={preset} className="overflow-hidden rounded-xl border border-line bg-white"><ParticleScene preset={preset} density={2600} paused={paused} className="h-44 w-full" /><h2 className="border-t border-line px-5 py-3 text-sm">{labels[preset]}</h2></section>)}</div>
    <section className="mt-8 rounded-xl border border-line bg-white p-5"><div className="flex flex-wrap gap-2">{PARTICLE_PRESETS.map(preset => <button key={preset} onClick={() => setSelected(preset)} aria-pressed={selected === preset} className="rounded-full border border-line px-3 py-2 text-xs aria-pressed:bg-inverse aria-pressed:text-white">{labels[preset]}</button>)}</div><ParticleScene preset={selected} paused={paused} className="h-64 w-full" /><p className="text-sm text-ink-muted">Transition continue : changez de forme, même pendant la transformation.</p></section>
    <div className="mt-6 flex flex-wrap items-center gap-6"><SimulationBadge /><span className="inline-flex items-center gap-2 text-sm"><MotionDots kind="pending" />En attente de validation</span><span className="inline-flex items-center gap-2 text-sm"><MotionDots />Aperçu du chargement</span><span className="inline-flex items-center gap-2 text-sm"><MotionDots kind="error" />Aperçu de l’erreur</span></div>
  </main>;
}
