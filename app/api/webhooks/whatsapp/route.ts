// Placeholder webhook endpoint (task 1 — technical foundation).
// Not implemented: no external provider is connected in the prototype and every
// external communication is simulated. A real implementation must verify the
// provider signature, validate the payload with zod, be idempotent, answer fast
// and process the event in the background.
export function POST(): Response {
  return Response.json({ error: "Not implemented" }, { status: 501 });
}
