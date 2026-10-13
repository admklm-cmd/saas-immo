/** Fill of each part of the origins ring: the ink ramp of `.chart-scope-sheet` (100 / 78 / 60 / 48 %). */
export function partColor(index: number): string {
  return `var(--chart-${Math.min(index + 1, 4)})`;
}
