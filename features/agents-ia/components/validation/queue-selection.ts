/**
 * Selection of the validation desk (docs/design-system.md §3.1.1) — pure and
 * tested, so the keyboard and the URL behave the same with or without motion.
 */

/** Below 1024 px only one side shows: the queue, or the selected letter. */
export type QueueView = "list" | "message";

/**
 * Initial selection from `?message=` (read by the page): a known id opens that
 * letter (and the letter view on a phone); anything else selects the first
 * message and shows the queue.
 */
export function initialSelection(
  messages: readonly { id: string }[],
  requestedId: string | null | undefined,
): { selectedId: string | null; view: QueueView } {
  const requested = requestedId ? messages.find((message) => message.id === requestedId) : undefined;
  if (requested) return { selectedId: requested.id, view: "message" };
  return { selectedId: messages[0]?.id ?? null, view: "list" };
}

/**
 * Index a key moves the focus to in a vertical tab list (WAI-ARIA tabs):
 * ↓ / → next, ↑ / ← previous (wrapping), Début / Fin. `null` for any other key.
 */
export function queueKeyTarget(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * The message offered after one left the queue: the first of those that
 * followed it and are still there, else the first of the queue.
 */
export function nextSelection(messages: readonly { id: string }[], following: readonly string[]): string | null {
  const present = new Set(messages.map((message) => message.id));
  return following.find((id) => present.has(id)) ?? messages[0]?.id ?? null;
}
