import { APP_TEXTS } from "@/components/texts";
import { CONTACT_SOURCE_LABELS } from "@/features/contacts/types";

import type { DashboardPilotage, PilotageFlow } from "../../pilotage-types";
import type { PilotagePeriodKey } from "../../pilotage-periods";
import {
  FEW_REQUESTS,
  MAX_NAMED_ORIGINS,
  PERIOD_URL_VALUES,
  bucketLabels,
  compareCounts,
  compareDelays,
  compareRates,
  formatCount,
  formatDay,
  formatDelay,
  formatPercent,
  runningTotal,
  wholePercent,
} from "./pilotage-format";

/**
 * The serialisable view of ONE period: strings and numbers only, ready for the
 * client islands (no contact name, no id). It writes what the server computed
 * (`getDashboardPilotage`); it never derives a business figure, except the
 * display-only partitions documented on `buildFlow` and the running total of a
 * series, which is a drawing of the same buckets.
 */

const TEXTS = APP_TEXTS.dashboard.pilotage;

export type ViewBlock<T> = { status: "ok"; value: T } | { status: "unavailable" };

export type StagePoint = {
  /** `YYYY-MM-DD` of the bucket, Paris calendar day. */
  bucketStart: string;
  axis: string;
  long: string;
  table: string;
  signed: number;
  cumulative: number;
  previousSigned: number;
  previousCumulative: number;
  partial: boolean;
};

export type StageView = {
  /** « 38 » — the exact count of the period. */
  value: number;
  previous: number;
  /** The sentence of the comparison, or the honest absence of one. */
  comparison: string;
  /** « historique disponible depuis le … », when the previous period is not fully covered. */
  historyNote: string | null;
  /** The previous period is a fair comparison: its curve and bar may be drawn. */
  fairPrevious: boolean;
  /** The series, when it was computed. */
  series: {
    granularity: "day" | "week" | "month";
    points: StagePoint[];
    /** Nothing signed in either period: the chart is replaced by a sentence. */
    emptyBoth: boolean;
  } | null;
};

export type FigureView = {
  /** Written value: « 8 % », « 1 h 03 », « — ». */
  display: string;
  /** Numeric value used to roll the figure when the period changes; `null` when not measurable. */
  rolling: number | null;
  basis: string;
  comparison: string | null;
  caution: string | null;
  empty: string | null;
};

export type OriginPart = {
  key: string;
  label: string;
  count: number;
  share: number;
  /** « Autres »: hatched. */
  grouped: boolean;
};

export type FlowNodeView = { id: string; name: string; value: number; to: Array<{ id: string; name: string; value: number }> };

export type FlowView = {
  received: number;
  hot: number;
  lost: number;
  signed: number;
  untraced: number;
  nodes: Array<{ id: string; name: string; kind: "source" | "mid" | "end" | "outcome"; hatched: boolean; value: number }>;
  links: Array<{ source: string; target: string; value: number }>;
  rows: FlowNodeView[];
};

export type AtelierAgentView = {
  agent: "lea" | "hugo" | "emma" | "louis" | "sarah";
  name: string;
  job: string;
  recorded: number;
  blocked: number;
  failed: number;
  runs: number;
};

export type AtelierView = {
  agents: AtelierAgentView[];
};

export type PilotageView = {
  key: PilotagePeriodKey;
  urlKey: string;
  short: string;
  /** « 12 mois »: the length of the period, for sentences like « sur 12 mois ». */
  span: string;
  eyebrow: string;
  announce: string;
  previousPhrase: string;
  grain: string;
  grainTitle: string;
  scopeLine: string;
  scopeShort: string;
  coverage: DashboardPilotage["period"]["previousCoverage"];
  stage: ViewBlock<StageView>;
  conversion: ViewBlock<FigureView>;
  delay: ViewBlock<FigureView>;
  noAction: ViewBlock<{ count: number; openTotal: number; display: string; basis: string; empty: string | null }>;
  origins: ViewBlock<{ total: number; parts: OriginPart[] }>;
  flow: ViewBlock<FlowView | null>;
  atelier: ViewBlock<AtelierView>;
};

const unavailable = { status: "unavailable" } as const;

function fair(data: DashboardPilotage): boolean {
  return data.period.previousCoverage === "full";
}

function historyNote(data: DashboardPilotage): string | null {
  if (fair(data) || !data.period.historyStartsAt) return null;
  return TEXTS.stage.previousSince(formatDay(data.period.historyStartsAt));
}

function buildStage(data: DashboardPilotage): ViewBlock<StageView> {
  if (data.mandates.status !== "ok") return unavailable;
  const phrase = TEXTS.periods[data.period.key].previous;
  const { value, previous } = data.mandates.value;
  const isFair = fair(data);
  let series: StageView["series"] = null;
  if (data.series.status === "ok") {
    const { granularity, points, previousPoints } = data.series.value;
    const cumulative = runningTotal(points.map((p) => p.signed));
    const previousCumulative = runningTotal(previousPoints.map((p) => p.signed));
    series = {
      granularity,
      points: points.map((point, index) => {
        const labels = bucketLabels(point.bucketStart, granularity, points.length);
        return {
          bucketStart: point.bucketStart,
          axis: labels.axis,
          long: labels.long,
          table: labels.table,
          signed: point.signed,
          cumulative: cumulative[index] ?? 0,
          previousSigned: previousPoints[index]?.signed ?? 0,
          previousCumulative: previousCumulative[index] ?? 0,
          partial: point.partial,
        };
      }),
      emptyBoth: value === 0 && previous === 0,
    };
  }
  return {
    status: "ok",
    value: {
      value,
      previous,
      comparison: compareCounts(value, previous, phrase, isFair),
      historyNote: historyNote(data),
      fairPrevious: isFair,
      series,
    },
  };
}

function buildConversion(data: DashboardPilotage): ViewBlock<FigureView> {
  if (data.conversion.status !== "ok") return unavailable;
  const { current, previous } = data.conversion.value;
  const copy = TEXTS.figures.conversion;
  const period = TEXTS.periods[data.period.key];
  const empty = current.denominator === 0 ? copy.empty : null;
  return {
    status: "ok",
    value: {
      display: formatPercent(current.rate),
      rolling: wholePercent(current.rate),
      basis: empty ?? copy.basis(current.numerator, current.denominator, period.span),
      comparison: empty ? null : compareRates(current.rate, previous.rate, period.previous, fair(data)),
      caution: current.denominator > 0 && current.denominator < FEW_REQUESTS ? copy.caution : null,
      empty,
    },
  };
}

function buildDelay(data: DashboardPilotage): ViewBlock<FigureView> {
  if (data.firstHandling.status !== "ok") return unavailable;
  const { current, previous } = data.firstHandling.value;
  const copy = TEXTS.figures.delay;
  const empty = current.measured === 0 ? copy.empty : null;
  return {
    status: "ok",
    value: {
      display: formatDelay(current.medianMinutes),
      rolling: current.medianMinutes === null ? null : Math.round(current.medianMinutes),
      basis: copy.basis(current.measured, current.unhandled),
      comparison: empty ? null : compareDelays(current.medianMinutes, previous.medianMinutes, TEXTS.periods[data.period.key].previous, fair(data)),
      caution: null,
      empty,
    },
  };
}

function buildNoAction(data: DashboardPilotage): PilotageView["noAction"] {
  if (data.withoutNextAction.status !== "ok") return unavailable;
  const { count, openTotal } = data.withoutNextAction.value;
  const copy = TEXTS.figures.noAction;
  return {
    status: "ok",
    value: { count, openTotal, display: formatCount(count), basis: copy.basis(count, openTotal), empty: count === 0 ? copy.empty : null },
  };
}

function buildOrigins(data: DashboardPilotage): PilotageView["origins"] {
  if (data.origins.status !== "ok") return unavailable;
  const present = data.origins.value.filter((origin) => origin.count > 0);
  const total = present.reduce((sum, origin) => sum + origin.count, 0);
  const share = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));
  const sorted = [...present].sort((a, b) => b.count - a.count);
  const named = sorted.length > MAX_NAMED_ORIGINS + 1 ? sorted.slice(0, MAX_NAMED_ORIGINS) : sorted;
  const rest = sorted.slice(named.length);
  const parts: OriginPart[] = named.map((origin) => ({
    key: origin.source,
    label: CONTACT_SOURCE_LABELS[origin.source],
    count: origin.count,
    share: share(origin.count),
    grouped: false,
  }));
  if (rest.length > 0) {
    const count = rest.reduce((sum, origin) => sum + origin.count, 0);
    parts.push({ key: "others", label: TEXTS.origin.others, count, share: share(count), grouped: true });
  }
  return { status: "ok", value: { total, parts } };
}

/**
 * Display-only partition of the cohort flow into the seven nodes of the Sankey
 * (docs §3.5.2.E4). Every count comes from `flow`; the three differences
 * (« pas encore chauds », « chauds en cours », losses before/after « chaud ») are
 * subtractions of server counts. If the parts do not add up, nothing is drawn
 * (`null`): a figure is never adjusted to fit.
 */
export function buildFlow(flow: PilotageFlow): FlowView | null {
  const hot = flow.steps.find((step) => step.stage === "chaud")?.reached;
  if (hot === undefined) return null;
  const by = flow.lost.byFurthestStage;
  const lostBefore = (by.nouveau ?? 0) + (by.qualifie ?? 0);
  const lostAfter = (by.chaud ?? 0) + (by.rdv_planifie ?? 0) + (by.estimation_faite ?? 0) + (by.mandat_signe ?? 0);
  const signed = flow.signed;
  const stillHot = hot - signed - lostAfter;
  const notHot = flow.entrants - hot - lostBefore;
  if (lostBefore + lostAfter !== flow.lost.total || stillHot < 0 || notHot < 0) return null;

  const copy = TEXTS.flow;
  const spec = [
    { id: "received", name: copy.received, kind: "source", hatched: false, value: flow.entrants },
    { id: "hot", name: copy.hot, kind: "mid", hatched: false, value: hot },
    { id: "notHot", name: copy.notHot, kind: "mid", hatched: false, value: notHot },
    { id: "lostBefore", name: copy.lostBefore, kind: "mid", hatched: true, value: lostBefore },
    { id: "signed", name: copy.signed, kind: "outcome", hatched: false, value: signed },
    { id: "stillHot", name: copy.stillHot, kind: "end", hatched: false, value: stillHot },
    { id: "lostAfter", name: copy.lostAfter, kind: "end", hatched: true, value: lostAfter },
  ] as const;
  const links = [
    { source: "received", target: "hot", value: hot },
    { source: "received", target: "notHot", value: notHot },
    { source: "received", target: "lostBefore", value: lostBefore },
    { source: "hot", target: "signed", value: signed },
    { source: "hot", target: "stillHot", value: stillHot },
    { source: "hot", target: "lostAfter", value: lostAfter },
  ].filter((link) => link.value > 0);
  const nodes = spec.filter((node) => node.id === "received" || links.some((l) => l.source === node.id || l.target === node.id));
  const nameOf = (id: string) => spec.find((node) => node.id === id)?.name ?? id;
  return {
    received: flow.entrants,
    hot,
    lost: flow.lost.total,
    signed,
    untraced: flow.lost.untraced,
    nodes: nodes.map((node) => ({ ...node })),
    links,
    rows: nodes.map((node) => ({
      id: node.id,
      name: node.name,
      value: node.value,
      to: links.filter((l) => l.source === node.id).map((l) => ({ id: l.target, name: nameOf(l.target), value: l.value })),
    })),
  };
}

function buildAtelier(data: DashboardPilotage): ViewBlock<AtelierView> {
  if (data.agents.status !== "ok") return unavailable;
  return {
    status: "ok",
    value: {
      agents: data.agents.value.agents.map((activity) => {
        const copy = TEXTS.atelier.agents[activity.agent];
        return {
          agent: activity.agent,
          name: copy.name,
          job: copy.job,
          recorded: activity.recordedActions,
          blocked: activity.runs.blocked,
          failed: activity.runs.failed,
          runs: activity.runs.total,
        };
      }),
    },
  };
}

/** One period of the page as a plain, serialisable object. */
export function buildPilotageView(data: DashboardPilotage): PilotageView {
  const period = TEXTS.periods[data.period.key];
  const from = formatDay(data.period.current.startsAt);
  const to = formatDay(data.period.current.endsAt);
  return {
    key: data.period.key,
    urlKey: PERIOD_URL_VALUES[data.period.key],
    short: period.short,
    span: period.span,
    eyebrow: period.eyebrow,
    announce: period.announce,
    previousPhrase: period.previous,
    grain: period.grain,
    grainTitle: period.grainTitle,
    scopeLine: TEXTS.scopeLine(from, to, formatDay(data.period.previous.startsAt), formatDay(data.period.previous.endsAt)),
    scopeShort: TEXTS.scopeLineShort(from, to),
    coverage: data.period.previousCoverage,
    stage: buildStage(data),
    conversion: buildConversion(data),
    delay: buildDelay(data),
    noAction: buildNoAction(data),
    origins: buildOrigins(data),
    flow: data.flow.status === "ok" ? { status: "ok", value: buildFlow(data.flow.value) } : unavailable,
    atelier: buildAtelier(data),
  };
}

/** A period whose read failed altogether: every block « Indisponible ». */
export function unavailableView(key: PilotagePeriodKey): PilotageView {
  const period = TEXTS.periods[key];
  return {
    key,
    urlKey: PERIOD_URL_VALUES[key],
    short: period.short,
    span: period.span,
    eyebrow: period.eyebrow,
    announce: period.announce,
    previousPhrase: period.previous,
    grain: period.grain,
    grainTitle: period.grainTitle,
    scopeLine: period.eyebrow,
    scopeShort: period.eyebrow,
    coverage: "unknown",
    stage: unavailable,
    conversion: unavailable,
    delay: unavailable,
    noAction: unavailable,
    origins: unavailable,
    flow: unavailable,
    atelier: unavailable,
  };
}
