"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  CheckCircledIcon,
  CodeIcon,
  FileTextIcon,
  LockClosedIcon,
  MagicWandIcon,
} from "@radix-ui/react-icons";

import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

import styles from "./AgentProcessMotionPrototype.module.css";

const STEPS = [
  { title: "Garde-fous", action: "sécurise", Icon: LockClosedIcon },
  { title: "Données", action: "charge", Icon: FileTextIcon },
  { title: "Contexte", action: "structure", Icon: CodeIcon },
  { title: "Modèle IA", action: "analyse", Icon: MagicWandIcon },
  { title: "Validation", action: "contrôle", Icon: CheckCircledIcon },
] as const;

const STEP_DURATION_MS = 2_000;

export function AgentProcessMotionPrototype() {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % STEPS.length);
    }, STEP_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [open]);

  return (
    <section className="mt-20" aria-labelledby="process-prototype-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-overline font-semibold text-ink-subtle uppercase">Prototype de référence</p>
          <h2 id="process-prototype-title" className="mt-3 text-heading font-semibold text-ink">
            Processus de l’agent sur trame pointillée
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Variante isolée conservée pour comparer le mouvement avec son intégration produit.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setActiveStep(0);
            setOpen((value) => !value);
          }}
        >
          {open ? "Refermer le prototype" : "Explorer le processus"}
        </Button>
      </div>

      <div className={styles.stage} data-testid="agent-process-prototype">
        <article className={cn(styles.agent, open && styles.open)}>
          <section className={styles.summary}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Emma · Relation</p>
                <p className="mt-1 text-xs text-ink-muted">Prépare les relances à valider</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span className={styles.statusDot} aria-hidden="true" />
                {open ? "Processus actif" : "En veille"}
              </div>
            </div>

            {!open ? (
              <>
                <div className={styles.metrics}>
                  <div>
                    <p className="text-3xl font-semibold tracking-[-0.055em] text-ink">3</p>
                    <p className="mt-1.5 text-xs text-ink-muted">exécutions aujourd’hui</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold tracking-[-0.04em] text-ink">17</p>
                    <p className="mt-1.5 text-xs text-ink-muted">sur 7 jours</p>
                  </div>
                </div>
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-overline font-semibold text-ink-subtle uppercase">Dernière exécution</p>
                  <p className="mt-1.5 text-xs text-ink">Brouillon préparé · il y a 12 min</p>
                </div>
              </>
            ) : null}
          </section>

          <section
            className={styles.process}
            aria-hidden={!open}
            style={{ "--process-duration": `${STEP_DURATION_MS * STEPS.length}ms` } as CSSProperties}
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">Flux d’exécution</p>
                <p className="mt-1 text-xs text-ink-muted">Le code orchestre chaque passage.</p>
              </div>
              <p className="text-overline font-semibold text-ink-subtle uppercase">Simulation</p>
            </div>

            <div
              className={styles.system}
              style={{ "--active-step": activeStep } as CSSProperties}
            >
              <div className={styles.rail} aria-hidden="true">
                <span className={styles.signal} />
              </div>
              {STEPS.map(({ title, action, Icon }, index) => (
                <div
                  key={title}
                  className={cn(
                    styles.node,
                    index <= activeStep && styles.revealedNode,
                    index === activeStep && styles.activeNode,
                  )}
                >
                  <div className={styles.nodeCore} aria-hidden="true">
                    <span className={styles.nodeOrb} />
                    <Icon className={styles.nodeIcon} width={18} height={18} />
                  </div>
                  <div className={styles.nodeLabel}>
                    <strong>{title}</strong>
                    {action}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.activity}>
              <div className="flex items-center justify-between gap-4">
                <span>activité en cours</span>
                <span>progression continue</span>
              </div>
              <div className={styles.activityBar} aria-hidden="true">
                <span key={open ? "running" : "idle"} />
              </div>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
