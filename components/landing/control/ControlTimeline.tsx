"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { CursorYou } from "../ecosystem/CursorYou";
import {
  BLOCKS,
  ControlTimelinePlayer,
  finalFrame,
  frameOf,
  type AxisMove,
  type PlayerSnapshot,
  type TimelineBlock,
} from "./control-timeline";
import styles from "./control-timeline.module.css";

const TEXTS = LANDING_TEXTS.control.tiles.timeline;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Share of the frame that must be on screen to start (once). */
const VISIBLE_SHARE = 0.5;
const TICKS = Array.from({ length: 11 }, (_, day) => day);

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome on this device (false on the server: the final state first). */
function useMotionWelcome(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

/** Position on the time axis: a full-width layer moved by `day` tenths of its own width. */
function axisStyle(move: AxisMove): CSSProperties {
  return {
    "--day": move.day,
    transitionDuration: `${move.ms}ms`,
    transitionTimingFunction: move.ease === "linear" ? "linear" : "var(--ease-emphasis)",
  } as CSSProperties;
}

function blockLabel(block: TimelineBlock): string {
  return TEXTS.blocks[block.key];
}

/**
 * Tile 2 of the control section — the timeline of a fictitious dossier
 * (docs/design-system.md §2.11.8.7 L3-D). The playhead runs, stops on the
 * dotted cobalt « 1er contact », the « Vous » cursor validates it, then the
 * dossier stops again before the mandate, which stays waiting for a human.
 *
 * Plays ONCE (no loop, no `data-loop`): `ControlTimelinePlayer`, one timer at
 * most, CSS transitions on `transform` / `opacity`, never
 * `requestAnimationFrame`. Server HTML, no JavaScript and reduced motion: the
 * final state. Decorative under its `role="img"` name.
 */
export function ControlTimeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useMotionWelcome();
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>({ status: "idle", index: null });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    const player = new ControlTimelinePlayer(
      {
        now: () => performance.now(),
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: (id) => window.clearTimeout(id),
      },
      setSnapshot,
    );
    if (!reduced || reduced.matches || !("IntersectionObserver" in window)) {
      player.setReduced(true);
      return () => player.dispose();
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= VISIBLE_SHARE - 0.001)) return;
        observer.disconnect();
        player.trigger();
      },
      { threshold: [VISIBLE_SHARE] },
    );
    observer.observe(root);
    // A live switch to reduced motion jumps to the final state.
    const onReduced = () => {
      if (reduced.matches) {
        observer.disconnect();
        player.setReduced(true);
      }
    };
    reduced.addEventListener?.("change", onReduced);
    return () => {
      observer.disconnect();
      reduced.removeEventListener?.("change", onReduced);
      player.dispose();
    };
  }, []);

  const live = motion && snapshot.status !== "done";
  const frame = live ? frameOf(snapshot) : finalFrame();
  const visualState = !live ? "done" : snapshot.status === "playing" ? "playing" : "idle";
  const step = !live ? "end" : snapshot.index === null ? "start" : String(snapshot.index);

  return (
    <div
      ref={rootRef}
      className={styles.timeline}
      role="img"
      aria-label={TEXTS.visualLabel}
      data-testid="control-timeline"
      data-visual-state={visualState}
      data-step={step}
    >
      <div className={styles.drawing} aria-hidden="true">
        <div className={styles.file}>
          <AgentAppIcon glyph="deal" kind="neutral" size="sm" />
          <span className={styles.fileText}>
            <span className={styles.fileName}>{TEXTS.file}</span>
            <span className={styles.fileStates} data-testid="control-file-state" data-state={frame.fileState}>
              {TEXTS.states.map((state, index) => (
                <span key={state} className={styles.fileState} data-active={index === frame.fileState ? "" : undefined}>
                  {state}
                </span>
              ))}
            </span>
          </span>
        </div>

        <span className={cn(styles.gutter, styles.trackAgents)}>{TEXTS.tracks.agents}</span>
        <span className={cn(styles.gutter, styles.trackEmma)}>{TEXTS.tracks.emma}</span>
        <span className={cn(styles.gutter, styles.gutterYou, styles.trackYou)}>{TEXTS.tracks.you}</span>

        <div className={styles.zone} data-testid="control-zone">
          {TEXTS.days.map((label, index) => (
            <span key={label} className={styles.dayLabel} style={{ "--day": index * 2 } as CSSProperties} data-edge={index === 0 ? "start" : index === TEXTS.days.length - 1 ? "end" : undefined}>
              {label}
            </span>
          ))}
          <span className={styles.baseline} />
          {TICKS.map((day) => (
            <span key={day} className={styles.tick} style={{ "--day": day } as CSSProperties} data-even={day % 2 === 0 ? "" : undefined} />
          ))}

          {BLOCKS.map((block) => {
            const decision = block.key === "firstContact" ? frame.firstContact : block.key === "mandate" ? frame.mandate : undefined;
            const shown = frame.shown.has(block.key);
            return (
              <span
                key={block.key}
                className={cn(styles.block, styles[`track-${block.track}`])}
                style={{ "--from": block.from, "--to": block.to } as CSSProperties}
                data-block={block.key}
                data-style={block.style}
                data-shown={shown ? "true" : "false"}
                data-decision={decision}
                data-pressed={block.key === "firstContact" && frame.pressed ? "" : undefined}
              >
                {decision ? (
                  <>
                    <span className={styles.validatedFill} />
                    <span className={cn(styles.blockLabel, styles.pendingLabel)}>{blockLabel(block)}</span>
                    {block.key === "firstContact" ? (
                      <span className={cn(styles.blockLabel, styles.validatedLabel)}>
                        <Icon name="check" px={10} className={styles.blockIcon} />
                        {TEXTS.blocks.validated}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className={styles.blockLabel}>
                    {block.style === "consent" ? <Icon name="check" px={10} className={styles.blockIcon} /> : null}
                    {blockLabel(block)}
                  </span>
                )}
              </span>
            );
          })}

          <span className={cn(styles.axis, styles.playhead)} style={axisStyle(frame.playhead)} data-testid="control-playhead" data-day={frame.playhead.day}>
            <span className={styles.playheadMark} />
          </span>
          <span className={cn(styles.axis, styles.cursorAgents)} style={axisStyle(frame.lea)} data-cursor="lea">
            <span className={styles.agentCursor}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M1.5 1.5 L1.5 12.6 L4.5 9.8 L6.6 14.4 L8.8 13.5 L6.7 8.9 L10.8 8.9 Z" />
              </svg>
              <span className={styles.agentLabel}>{TEXTS.cursors.lea}</span>
            </span>
          </span>
          <span
            className={cn(styles.axis, styles.cursorEmma)}
            style={axisStyle(frame.emma)}
            data-cursor="emma"
            data-visible={frame.emma.visible ? "true" : "false"}
          >
            <span className={styles.agentCursor}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M1.5 1.5 L1.5 12.6 L4.5 9.8 L6.6 14.4 L8.8 13.5 L6.7 8.9 L10.8 8.9 Z" />
              </svg>
              <span className={styles.agentLabel}>{TEXTS.cursors.emma}</span>
            </span>
          </span>
          <span
            className={cn(styles.axis, styles.cursorYou)}
            style={axisStyle({ day: frame.you.day, ms: frame.you.ms, ease: "emphasis" })}
            data-cursor="you"
            data-target={frame.you.target}
            data-testid="control-cursor-you"
          >
            <CursorYou label={TEXTS.cursors.you} pressed={frame.pressed} />
          </span>
        </div>
      </div>
    </div>
  );
}
