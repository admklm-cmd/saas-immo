"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { AgentRunReplay } from "@/features/agents-ia/components/AgentRunReplay";
import type { ReplayStep } from "@/features/agents-ia/components/replay";

import { AgentProcessMotionPrototype } from "./AgentProcessMotionPrototype";

const DEMOS = [
  { name: "rise", detail: "300 ms · entrée de section", className: "animate-rise" },
  { name: "rise-soft", detail: "220 ms · ligne ou petite carte", className: "animate-rise-soft" },
  { name: "fade", detail: "220 ms · alerte ou confirmation", className: "animate-fade" },
  { name: "settle", detail: "220 ms · changement d’état", className: "animate-settle" },
] as const;

const PROCESS_DEMO: ReplayStep[] = [
  { key: "demo-guardrails", phase: "guardrails", phaseLabel: "Garde-fous", label: "Règles de l’agence vérifiées.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.000Z", finishedAt: "2026-09-22T08:00:00.100Z", durationMs: 100 },
  { key: "demo-context", phase: "context_loaded", phaseLabel: "Dossier chargé", label: "Contexte utile chargé.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.100Z", finishedAt: "2026-09-22T08:00:00.250Z", durationMs: 150 },
  { key: "demo-prompt", phase: "prompt_built", phaseLabel: "Prompt construit", label: "Instructions bornées préparées.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.250Z", finishedAt: "2026-09-22T08:00:00.350Z", durationMs: 100 },
  { key: "demo-ai", phase: "ai_call", phaseLabel: "Appel du fournisseur IA", label: "Brouillon demandé au simulateur.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.350Z", finishedAt: "2026-09-22T08:00:00.700Z", durationMs: 350 },
  { key: "demo-validation", phase: "output_validated", phaseLabel: "Sortie validée", label: "Format et contenu contrôlés.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.700Z", finishedAt: "2026-09-22T08:00:00.820Z", durationMs: 120 },
  { key: "demo-decision", phase: "decision", phaseLabel: "Décision du code", label: "Le code autorise le brouillon.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.820Z", finishedAt: "2026-09-22T08:00:00.900Z", durationMs: 80 },
  { key: "demo-persisted", phase: "persisted", phaseLabel: "Écritures", label: "Brouillon enregistré pour validation.", status: "ok", statusLabel: "Terminé", detail: {}, startedAt: "2026-09-22T08:00:00.900Z", finishedAt: "2026-09-22T08:00:01.000Z", durationMs: 100 },
];

export function AnimationGallery() {
  const [replay, setReplay] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 py-16 sm:px-10 lg:py-24">
      <header className="max-w-3xl">
        <p className="text-overline font-semibold uppercase text-ink-subtle">Outil de développement</p>
        <h1 className="mt-4 text-display font-semibold text-balance">Mouvements autorisés</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted">
          Cette galerie compare les amplitudes et durées du système. Elle ne charge aucune donnée de
          l’agence et n’existe pas en production.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <Button onClick={() => setReplay((value) => value + 1)}>Rejouer</Button>
          <p className="text-sm text-ink-muted" aria-live="polite">
            Mouvement réduit : <strong className="font-semibold text-ink">{reducedMotion ? "actif" : "inactif"}</strong>
          </p>
        </div>
      </header>

      <div key={replay} className="mt-16 grid gap-4 md:grid-cols-2">
        {DEMOS.map((demo) => (
          <section key={demo.name} className={`${demo.className} min-h-52 rounded-xl border border-line bg-surface p-7 shadow-subtle`}>
            <p className="font-mono text-xs text-ink-subtle">animate-{demo.name}</p>
            <h2 className="mt-8 text-heading font-semibold">Titre d’exemple</h2>
            <p className="mt-2 text-sm text-ink-muted">{demo.detail}</p>
          </section>
        ))}
      </div>

      <section className="mt-4 rounded-xl bg-inverse p-7 text-ink-inverse">
        <p className="font-mono text-xs text-ink-inverse-muted">stagger · pas de 40 ms · plafond à 200 ms</p>
        <div key={`stagger-${replay}`} className="stagger mt-6 grid gap-px overflow-hidden rounded-md bg-white/15 sm:grid-cols-3">
          {["Ligne 1", "Ligne 2", "Ligne 3"].map((label) => (
            <div key={label} className="bg-inverse-soft px-5 py-7 text-sm font-medium">{label}</div>
          ))}
        </div>
      </section>

      <AgentProcessMotionPrototype />

      <section className="mt-20" aria-labelledby="integrated-process-title">
        <p className="text-overline font-semibold uppercase text-ink-subtle">Intégration produit</p>
        <h2 id="integrated-process-title" className="mt-3 text-heading font-semibold text-ink">
          Rejeu réel avec ses étapes mesurées
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Cette démonstration utilise le composant désormais partagé par les écrans des agents.
        </p>
        <div className="mt-7 rounded-xl border border-line bg-surface p-5 shadow-subtle">
          <AgentRunReplay key={`integrated-${replay}`} steps={PROCESS_DEMO} />
        </div>
      </section>
    </main>
  );
}
