import type { IconName } from "@/components/icons/icons";

import type { AtelierAgentView, AtelierView } from "./pilotage-view";

/**
 * Pure model of « L'Atelier » (docs §3.5.2.F): which stations, how thick each stretch
 * of the rail is, how many tokens are parked where. Every number is one the server
 * computed; this file only places them.
 */

export type StationId = "lea" | "hugo" | "emma" | "human" | "louis" | "sarah" | "mandate";

export type Station = {
  id: StationId;
  kind: "agent" | "human" | "outcome";
  glyph: IconName;
  /** Agent or stage name. */
  name: string;
  /** Written under the name (the mission of an agent). */
  job: string | null;
  /** The figure under the tile: actions of an agent, `null` for the human and the mandate stations (they have their own text). */
  recorded: number | null;
  blocked: number;
  failed: number;
  /** Hollow tokens drawn in front of the barrier: `min(blocked, 2)`. */
  blockedVisible: number;
};

export const STATION_ORDER: readonly StationId[] = ["lea", "hugo", "emma", "human", "louis", "sarah", "mandate"];

/** Tokens parked in front of the human checkpoint (the real waits), at most. */
export const MAX_WAITING_TOKENS = 3;
/** Hollow tokens parked in front of the barrier of a paused workshop. */
export const PAUSED_TOKENS = 3;
const RAIL_MIN_PX = 3;
const RAIL_SPAN_PX = 5;

export type AtelierMode = "live" | "paused" | "unavailable";

export type AtelierModel = {
  mode: AtelierMode;
  stations: Station[];
  /** Thickness of the 6 stretches of the rail, in px: `3 + 5 × (upstream / largest)`. */
  rails: number[];
  humanWaiting: number | null;
  mandates: number | null;
  /** Tokens posed in front of the human checkpoint. */
  waitingTokens: number;
  /** A confirmed token rests inside « Mandat ». */
  mandateToken: boolean;
  /** No agent recorded anything in the period (`0` is a real zero). */
  quiet: boolean;
};

export function railThickness(upstream: readonly number[]): number[] {
  const largest = Math.max(...upstream, 0);
  return upstream.map((value) => RAIL_MIN_PX + (largest === 0 ? 0 : RAIL_SPAN_PX * (value / largest)));
}

export function buildAtelierModel(input: {
  agents: { status: "ok"; value: AtelierView } | { status: "unavailable" };
  paused: boolean;
  humanWaiting: number | null;
  mandates: number | null;
  names: { human: string; mandate: string };
}): AtelierModel {
  const { agents, paused, humanWaiting, mandates, names } = input;
  const byId = new Map<string, AtelierAgentView>(agents.status === "ok" ? agents.value.agents.map((agent) => [agent.agent, agent]) : []);
  const agentStation = (id: "lea" | "hugo" | "emma" | "louis" | "sarah"): Station => {
    const agent = byId.get(id);
    return {
      id,
      kind: "agent",
      glyph: id,
      name: agent?.name ?? id,
      job: agent?.job ?? null,
      recorded: agent ? agent.recorded : null,
      blocked: agent?.blocked ?? 0,
      failed: agent?.failed ?? 0,
      blockedVisible: Math.min(agent?.blocked ?? 0, 2),
    };
  };
  const stations: Station[] = [
    agentStation("lea"),
    agentStation("hugo"),
    agentStation("emma"),
    { id: "human", kind: "human", glyph: "humanValidation", name: names.human, job: null, recorded: null, blocked: 0, failed: 0, blockedVisible: 0 },
    agentStation("louis"),
    agentStation("sarah"),
    { id: "mandate", kind: "outcome", glyph: "mandate", name: names.mandate, job: null, recorded: null, blocked: 0, failed: 0, blockedVisible: 0 },
  ];

  const counts = (id: string) => byId.get(id)?.recorded ?? 0;
  // Stretch i joins station i to station i + 1; its thickness follows what comes from upstream.
  const rails = railThickness([counts("lea"), counts("hugo"), counts("emma"), counts("emma"), counts("louis"), counts("sarah")]);
  const total = stations.reduce((sum, station) => sum + (station.recorded ?? 0), 0);

  return {
    mode: agents.status === "unavailable" ? "unavailable" : paused ? "paused" : "live",
    stations,
    rails,
    humanWaiting,
    mandates,
    waitingTokens: humanWaiting === null ? 0 : Math.min(humanWaiting, MAX_WAITING_TOKENS),
    mandateToken: mandates !== null && mandates > 0,
    quiet: agents.status === "ok" && total === 0,
  };
}
