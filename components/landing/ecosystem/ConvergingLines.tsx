import styles from "./ecosystem.module.css";

export type ConvergingColumn = {
  /** Centre of the column, px from the left of the stage. */
  x: number;
  /** Bottom of the column + 8 px, px from the top of the stage. */
  y: number;
};

/**
 * One curve per column, from under the column to the top of the action:
 * `M x,y0 C x,y0 + 0.55 h  xc,y1 − 0.55 h  xc,y1` (docs/design-system.md
 * §2.11.8.3). Pure geometry, exported for the tests.
 */
export function convergingPath(column: ConvergingColumn, target: { x: number; y: number }): string {
  const h = target.y - column.y;
  const round = (value: number) => Math.round(value * 10) / 10;
  return `M ${round(column.x)},${round(column.y)} C ${round(column.x)},${round(column.y + 0.55 * h)} ${round(target.x)},${round(target.y - 0.55 * h)} ${round(target.x)},${round(target.y)}`;
}

/**
 * The very fine lines (ink at 7 %) that gather the work of the agents toward
 * the « Demander une estimation » action. Decorative and still: recomputed on
 * resize by the caller, never animated. Nothing is drawn before the first
 * measure (no JavaScript: no lines, the rest of the figure is complete).
 */
export function ConvergingLines({
  columns,
  target,
}: {
  columns: readonly ConvergingColumn[];
  target: { x: number; y: number } | null;
}) {
  if (!target || columns.length === 0) return null;
  return (
    <svg className={styles.convergingLines} aria-hidden="true" focusable="false" data-testid="ecosystem-lines">
      {columns.map((column) => (
        <path key={`${column.x}-${column.y}`} d={convergingPath(column, target)} />
      ))}
    </svg>
  );
}
