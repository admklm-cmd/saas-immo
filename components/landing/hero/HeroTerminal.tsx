"use client";

import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { onReplay } from "../replay/replay-bus";
import { HeroMotionContext } from "./hero-motion-context";
import { BLINK_HALF_MS, terminalSchedule, type ScheduledLine } from "./terminal-script";
import styles from "./HeroTerminal.module.css";

const TEXTS = LANDING_TEXTS.hero.terminal;
const SCHEDULE = terminalSchedule(TEXTS.lines);
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

type TerminalState = "static" | "typing" | "done" | "reduced";

const ms = (value: number) => `${value}ms`;

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** `null` on the server and before hydration: the button is rendered after hydration only. */
function useMotionWelcome(): boolean | null {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => null,
  );
}

/**
 * One line. The typing is driven by ONE animation per line on `--shown` (an
 * integer custom property stepped once per character, docs/design-system.md
 * §2.11.4 bis E): character `i` is shown when `--shown > i`, and the cursor
 * sits `--shown` characters after the start of the content (mono font: 1 ch
 * per character). About twenty animations for the whole terminal instead of
 * one per character (measured: p95 frame 50 ms → 17 ms on a phone at CPU × 4).
 */
function Line({ line }: { line: ScheduledLine }) {
  if (line.kind === "static") {
    return (
      <div className={styles.line}>
        <span className={styles.comment}>{line.text}</span>
      </div>
    );
  }
  const first = line.chars[0]?.at ?? 0;
  const last = line.chars.at(-1);
  const timing = {
    "--n": line.chars.length,
    "--first": ms(first),
    "--t": ms(line.end - first),
    // The cursor stays after the last character through the pause that follows.
    "--w": ms(last ? last.at + last.cursorMs - first : 0),
    ...(line.promptAt !== null ? { "--start": ms(line.promptAt) } : {}),
    ...(line.hesitation ? { "--h": ms(line.hesitation.at), "--hd": ms(line.hesitation.ms) } : {}),
    ...(line.kind === "closing" ? { "--done": ms(SCHEDULE.doneAt), "--b": ms(BLINK_HALF_MS * 2) } : {}),
  } as CSSProperties;
  const typed = line.chars.map((char, index) => (
    <span key={index} className={styles.char} style={{ "--i": index } as CSSProperties}>
      {char.char}
    </span>
  ));
  const cursor = <span aria-hidden="true" className={styles.cursor} data-cursor="" />;
  if (line.kind === "closing") {
    return (
      <div className={`${styles.line} ${styles.closing}`} style={timing} data-terminal-end="">
        <span className={`${styles.comment} ${styles.content}`}>
          {cursor}
          {typed}
        </span>
      </div>
    );
  }
  const human = (name: string | null) => name === TEXTS.human;
  return (
    <div className={`${styles.line} ${styles.typed}`} style={timing} data-line-kind={line.kind} data-hesitation={line.hesitation ? "" : undefined}>
      <span className={human(line.from) ? styles.human : styles.agent}>{line.from}</span>
      <span className={styles.arrow}>{TEXTS.arrow}</span>
      <span className={human(line.to) ? styles.human : styles.receiver}>{line.to}</span>
      <span className={styles.content}>
        {cursor}
        {typed}
      </span>
    </div>
  );
}

/**
 * Terminal « humain ⇄ machine » of the hero (docs/design-system.md §2.11.4 bis
 * E): a small mono journal of the relay between the agents and the team,
 * labelled « exemple fictif — simulation ». The machine types fast, the human
 * hesitates and types slower; it ends on « les agents préparent. vous
 * décidez. ». Typed once per load (≈ 12 s) by CSS animations whose delays are
 * written by the server; the server HTML is the final text. Replayed by
 * « Rejouer les animations ». Assistive technology reads a static list once.
 *
 * The pause button (WCAG 2.2.2) jumps the text to its end and freezes the
 * nanorobots; it exists after hydration only, and never under reduced motion.
 */
export function HeroTerminal() {
  const figureRef = useRef<HTMLElement>(null);
  const motion = useMotionWelcome();
  const { stopped, setStopped } = useContext(HeroMotionContext);
  const [progress, setProgress] = useState<"typing" | "done">("typing");
  const generation = useRef(0);
  const state: TerminalState = motion === null ? "static" : motion ? progress : "reduced";

  /** Waits for the end of the typing (the end cursor appears), then « done ». */
  const follow = useCallback(() => {
    const current = (generation.current += 1);
    const end = figureRef.current?.querySelector<HTMLElement>("[data-terminal-end]");
    const typing = end?.getAnimations?.()[0];
    // No animation (finished, or an engine without it): done at the next microtask.
    const finished = typing ? typing.finished : Promise.resolve();
    finished.then(
      () => {
        if (generation.current === current) setProgress("done");
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    if (motion) follow();
  }, [motion, follow]);

  // « Rejouer les animations » (§2.11.8.8 L4-D): back to the armed state, typing from 0.
  useEffect(() => {
    return onReplay(() => {
      const figure = figureRef.current;
      if (!figure || typeof window.matchMedia !== "function" || window.matchMedia(REDUCED_MOTION).matches) return;
      // A finished CSS animation is gone from getAnimations(): every animation of the
      // terminal is removed for one style pass, then created anew from t = 0.
      figure.setAttribute("data-rearm", "");
      void figure.offsetWidth;
      figure.removeAttribute("data-rearm");
      setProgress("typing");
      follow();
    });
  }, [follow]);

  const toggle = () => {
    if (!stopped) {
      // Pause: the text jumps to its end, the nanorobots freeze.
      for (const animation of figureRef.current?.getAnimations?.({ subtree: true }) ?? []) animation.finish();
      generation.current += 1;
      setProgress("done");
    }
    setStopped(!stopped);
  };

  const pause = TEXTS.pause;
  return (
    <figure ref={figureRef} aria-labelledby="hero-terminal-title" className={styles.terminal} data-testid="hero-terminal" data-network-quiet="" data-terminal-state={state}>
      <span id="hero-terminal-title" className="sr-only">
        {TEXTS.title}
      </span>
      <div aria-hidden="true" className={styles.lines}>
        {SCHEDULE.lines.map((line, index) => (
          <Line key={index} line={line} />
        ))}
      </div>
      <ol className="sr-only" data-testid="hero-terminal-summary">
        {TEXTS.srLines.map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
      </ol>
      {motion ? (
        <button
          type="button"
          className={styles.pause}
          aria-label={stopped ? pause.resumeName : pause.pauseName}
          data-testid="hero-motion-pause"
          onClick={toggle}
        >
          <span aria-hidden="true">[{"\u00a0"}</span>
          <span>{stopped ? pause.resume : pause.pause}</span>
          <span aria-hidden="true">{"\u00a0"}]</span>
        </button>
      ) : null}
    </figure>
  );
}
