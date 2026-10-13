"use client";

import { PatternLines } from "@visx/pattern";
import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { PieCenter } from "@/components/charts/bklit/pie-center";
import { PieChart } from "@/components/charts/bklit/pie-chart";
import { PieSlice } from "@/components/charts/bklit/pie-slice";
import { APP_TEXTS } from "@/components/texts";

import { prefersReducedMotion } from "./motion";
import { partColor } from "./origin-colors";
import type { OriginPart } from "./pilotage-view";

const TEXTS = APP_TEXTS.dashboard.pilotage.origin;
const HATCH_ID = "origin-hatch";
/** The hovered part grows by this many pixels (docs §3.5.2.E3). */
const GROW_PX = 4;
const PAD_ANGLE = 0.02;
const CORNER_RADIUS = 2;
const HOLE_SHARE = 0.62;
/** Entrance of the parts, clockwise (docs §3.5.2.E3: 700 ms, 70 ms apart). */
const ENTER = { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number] };
const ENTER_STAGGER = 0.1;

export type OriginRingProps = {
  parts: readonly OriginPart[];
  hovered: number | null;
  onHover: (index: number | null) => void;
};

/**
 * The origins ring (Bklit `PieChart`): parts clockwise from 12 o'clock, the biggest
 * first, ink ramp 100 / 78 / 60 / 48 %, « Autres » hatched, 2 px of white between
 * parts. Hover (or the arrows, handled by the block) grows the part by 4 px and fades
 * the others. The centre shows the total, or the hovered part. Hidden from assistive
 * technology: the block writes the same figures as a list and a table.
 */
export function OriginRing({ parts, hovered, onHover }: OriginRingProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(220);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setSize(Math.round(box.getBoundingClientRect().width)));
    observer.observe(box);
    setSize(Math.round(box.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const outer = size / 2 - GROW_PX;
  const data = parts.map((part, index) => ({
    label: part.label,
    value: part.count,
    color: partColor(index),
    fill: part.grouped ? `url(#${HATCH_ID})` : partColor(index),
  }));

  return (
    <div ref={boxRef} aria-hidden="true" className="chart-scope chart-scope-sheet mx-auto aspect-square w-full" data-testid="origin-ring">
      <MotionConfig reducedMotion="user">
        <PieChart
          data={data}
          size={size}
          innerRadius={Math.round(outer * HOLE_SHARE)}
          padAngle={PAD_ANGLE}
          cornerRadius={CORNER_RADIUS}
          hoverOffset={GROW_PX}
          hoveredIndex={hovered}
          onHoverChange={onHover}
          enterTransition={reduced ? { duration: 0 } : ENTER}
          enterStaggerScale={reduced ? 0 : ENTER_STAGGER / 0.07}
        >
          <PatternLines
            id={HATCH_ID}
            height={6}
            width={6}
            orientation={["diagonal"]}
            stroke="var(--color-ink)"
            strokeWidth={1.2}
            background="var(--chart-4)"
          />
          {data.map((_, index) => (
            <PieSlice key={parts[index]?.key ?? index} index={index} hoverEffect="grow" showGlow={false} />
          ))}
          <PieCenter defaultLabel={TEXTS.centerLabel}>
            {({ value, label }) => (
              <div className="flex flex-col items-center text-center" data-testid="origin-center">
                <span className="figure text-4xl font-medium text-ink tabular-nums xl:text-5xl">{value}</span>
                <span className="mt-1 max-w-24 text-sm leading-4 text-ink-muted">{label}</span>
              </div>
            )}
          </PieCenter>
        </PieChart>
      </MotionConfig>
    </div>
  );
}
