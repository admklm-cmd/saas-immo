/**
 * Shared building blocks of the icon family (same grid, same language):
 * filled organic shapes, round caps, no outline around a filled shape, no
 * knock-out painted with the page colour (so an icon inverts cleanly on a
 * dark tile). Holes, when needed, are real holes (`fill-rule="evenodd"`).
 */

/** Stroke weights of the family, on the 24 grid. */
export const STROKE = { hair: 1.5, line: 1.8, bold: 2.2, heavy: 3 } as const;

/** Circle of radius `r` centred on (`cx`, `cy`), as path data (two arcs). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
}

export function Dot({ cx, cy, r, m }: { cx: number; cy: number; r: number; m?: string }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" data-m={m} />;
}

export function Line({ d, width = STROKE.line, m }: { d: string; width?: number; m?: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-m={m}
    />
  );
}

export function Blob({ d, m, evenOdd = false }: { d: string; m?: string; evenOdd?: boolean }) {
  return <path d={d} fill="currentColor" fillRule={evenOdd ? "evenodd" : undefined} data-m={m} />;
}

/** A white mark drawn on the accent disc (check, arrow, clock hands). */
export function OnAccent({ d, m }: { d: string; m?: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE.line}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-on-accent=""
      data-m={m}
    />
  );
}

/** Person: round head and a soft, pebble-like body (board « Contacts »). */
export function Person({ x = 0, y = 0, m }: { x?: number; y?: number; m?: string }) {
  return (
    <g data-m={m}>
      <circle cx={9.5 + x} cy={7.2 + y} r={3.7} fill="currentColor" />
      <path
        fill="currentColor"
        d={`M${3 + x} ${18.3 + y}c0-3.7 2.9-6.1 6.5-6.1s6.5 2.4 6.5 6.1c0 1.2-.9 1.9-2.2 1.9H${5.2 + x}c-1.3 0-2.2-.7-2.2-1.9z`}
      />
    </g>
  );
}

/** Four rounded corners of a viewfinder (Leads, Simulation). */
export function ViewfinderCorners() {
  return (
    <>
      <Line d="M3.5 8V5.6a2.1 2.1 0 0 1 2.1-2.1H8" m="corner-tl" />
      <Line d="M16 3.5h2.4a2.1 2.1 0 0 1 2.1 2.1V8" m="corner-tr" />
      <Line d="M20.5 16v2.4a2.1 2.1 0 0 1-2.1 2.1H16" m="corner-br" />
      <Line d="M8 20.5H5.6a2.1 2.1 0 0 1-2.1-2.1V16" m="corner-bl" />
    </>
  );
}

/** Filled bell with its clapper (Alerte, Notifications). */
export const BELL_PATH =
  "M12 2.3a1.3 1.3 0 0 1 1.3 1.3v.4c2.8.6 4.6 3 4.6 6v3.3c0 1.2.5 2.4 1.3 3.2l.5.5c.7.7.2 1.9-.8 1.9H5.1c-1 0-1.5-1.2-.8-1.9l.5-.5c.8-.8 1.3-2 1.3-3.2V10c0-3 1.8-5.4 4.6-6v-.4A1.3 1.3 0 0 1 12 2.3z";
export const CLAPPER_PATH = "M9.7 19.8h4.6a2.3 2.3 0 0 1-4.6 0z";

/**
 * Gear with eight rounded teeth and a real hole (Paramètres), built once from
 * geometry so every tooth is identical: a notch of 45° lands on itself.
 */
function gearPath(): string {
  const teeth = 8;
  const outer = 9.6;
  const inner = 7.2;
  const half = Math.PI / teeth / 3;
  const points: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const angle = (i * 2 * Math.PI) / teeth - Math.PI / 2;
    const at = (a: number, r: number) => `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
    points.push(
      `${i === 0 ? "M" : "L"}${at(angle - half * 1.6, inner)}`,
      `L${at(angle - half, outer)}`,
      `A${outer} ${outer} 0 0 1 ${at(angle + half, outer)}`,
      `L${at(angle + half * 1.6, inner)}`,
      `A${inner} ${inner} 0 0 1 ${at(angle + (2 * Math.PI) / teeth - half * 1.6, inner)}`,
    );
  }
  return `${points.join("")}z${circlePath(12, 12, 3.9)}`;
}

export const GEAR_PATH = gearPath();
