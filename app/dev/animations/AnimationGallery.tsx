"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";

const DEMOS = [
  { name: "rise", detail: "300 ms · entrée de section", className: "animate-rise" },
  { name: "rise-soft", detail: "220 ms · ligne ou petite carte", className: "animate-rise-soft" },
  { name: "fade", detail: "220 ms · alerte ou confirmation", className: "animate-fade" },
  { name: "settle", detail: "220 ms · changement d’état", className: "animate-settle" },
] as const;

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
    </main>
  );
}
