import type { EmmaFollowUpCandidateView } from "../../types";

/**
 * The sieve of « Relances Emma » (docs/design-system.md §3.1.2) — pure and
 * tested. It only REORDERS what the page already received from
 * `getEmmaFollowUpCandidates()`: no rule of its own, no new query, no figure
 * that is not a count of that list.
 *
 * The gates are the checks the page receives, in the order the server applies
 * them to compute `blockedReason` (features/agents-ia/data.ts): a file taken
 * over by an advisor, then a follow-up already waiting for validation, then no
 * usable consented channel. The first closed gate is therefore always the
 * motive the server gave. The kill switch is not part of this list: the page
 * does not receive it (the server still checks it at click time).
 */
export const FOLLOW_UP_GATES = ["takeover", "pendingDraft", "consent"] as const;
export type FollowUpGate = (typeof FOLLOW_UP_GATES)[number];

export type GateState = "open" | "closed";

type Candidate = Pick<
  EmmaFollowUpCandidateView,
  "humanTakeover" | "hasPendingEmmaDraft" | "channel" | "canPrepare" | "blockedReason"
>;

const GATE_OF_REASON: Readonly<Record<NonNullable<EmmaFollowUpCandidateView["blockedReason"]>, FollowUpGate>> = {
  human_takeover: "takeover",
  pending_draft: "pendingDraft",
  consent_or_channel_missing: "consent",
};

/** State of each gate for one file, read from the fields the page received. */
export function gatesOf(candidate: Candidate): Readonly<Record<FollowUpGate, GateState>> {
  return {
    takeover: candidate.humanTakeover ? "closed" : "open",
    pendingDraft: candidate.hasPendingEmmaDraft ? "closed" : "open",
    consent: candidate.channel === null ? "closed" : "open",
  };
}

/** The gate where the server stopped this file, or `null` when it is ready. */
export function stopGateOf(candidate: Candidate): FollowUpGate | null {
  return candidate.blockedReason ? GATE_OF_REASON[candidate.blockedReason] : null;
}

/**
 * Whether the flow reaches each gate: every gate up to and including the first
 * closed one. The gates after it keep their own (real) state, drawn muted.
 */
export function reachedGates(candidate: Candidate): Readonly<Record<FollowUpGate, boolean>> {
  const stop = stopGateOf(candidate);
  const stopIndex = stop ? FOLLOW_UP_GATES.indexOf(stop) : FOLLOW_UP_GATES.length;
  return {
    takeover: 0 <= stopIndex,
    pendingDraft: 1 <= stopIndex,
    consent: 2 <= stopIndex,
  };
}

export type SieveGroups<T> = {
  total: number;
  ready: T[];
  /** Blocked files, by the gate that stopped them. */
  stopped: Readonly<Record<FollowUpGate, T[]>>;
  /** Neither ready nor explained (should not happen): shown, never hidden. */
  unexplained: T[];
};

/** Groups the list as received, keeping its order inside each group. */
export function groupCandidates<T extends Candidate>(candidates: readonly T[]): SieveGroups<T> {
  const stopped: Record<FollowUpGate, T[]> = { takeover: [], pendingDraft: [], consent: [] };
  const ready: T[] = [];
  const unexplained: T[] = [];
  for (const candidate of candidates) {
    const stop = stopGateOf(candidate);
    if (stop) stopped[stop].push(candidate);
    else if (candidate.canPrepare) ready.push(candidate);
    else unexplained.push(candidate);
  }
  return { total: candidates.length, ready, stopped, unexplained };
}

/**
 * The funnel of the summary band: how many files arrive at each gate and how
 * many stop there. Pure arithmetic on the grouped list.
 */
export function funnelOf<T>(groups: SieveGroups<T>): {
  gate: FollowUpGate;
  arriving: number;
  stopped: number;
}[] {
  let arriving = groups.total;
  return FOLLOW_UP_GATES.map((gate) => {
    const stopped = groups.stopped[gate].length;
    const step = { gate, arriving, stopped };
    arriving -= stopped;
    return step;
  });
}

/** Blocked total, as displayed: every file that is not ready. */
export function blockedCount<T>(groups: SieveGroups<T>): number {
  return groups.total - groups.ready.length;
}
