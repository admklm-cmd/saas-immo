/**
 * « Simulation » badge placement (docs/design-system.md §3.4).
 *
 * The badge is a product rule: a simulated action must never be mistaken for a
 * real one. To avoid a badge on every line, a block shows ONE badge when — and
 * only when — every item it lists is simulated. A single real item makes the
 * block fall back to a badge per simulated item. An empty block claims nothing.
 */
export function everyRunSimulated(runs: readonly { isSimulation: boolean }[]): boolean {
  return runs.length > 0 && runs.every((run) => run.isSimulation);
}
