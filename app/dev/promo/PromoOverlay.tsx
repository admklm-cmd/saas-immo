import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";

import type { PromoDemo } from "./promo-demo";
import { stationPoint, type PromoLayout } from "./promo-format";
import { STATION_IDS, type StationId } from "./promo-timeline";
import { PROMO_TEXTS } from "./promo-texts";

/**
 * The DOM layer of the film: titles, terminal, station labels, dashboard figures, signature.
 * It only declares the structure and the static look; `updatePromoDom` moves it at every `seek`.
 */

const PROMPT_FONT: CSSProperties = { fontFamily: "var(--font-prompt)", fontWeight: 700, letterSpacing: "-0.01em" };
const MONO_FONT: CSSProperties = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
const SANS_FONT: CSSProperties = { fontFamily: "var(--font-sans)", fontWeight: 600 };

const hidden: CSSProperties = { opacity: 0 };

function Anchor({ x, y, children, align = "center" }: { x: number; y: number; children: ReactNode; align?: "center" | "start" }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      <div style={{ position: "absolute", transform: align === "center" ? "translate(-50%, -50%)" : "translate(0, -50%)", whiteSpace: "pre" }}>{children}</div>
    </div>
  );
}

function Typed({ id, style, cursor }: { id: string; style?: CSSProperties; cursor: string }) {
  return (
    <div data-promo={id} style={{ ...style, ...hidden, whiteSpace: "pre" }}>
      <span data-part="typed" />
      <span data-part="cursor" style={{ display: "inline-block", width: "0.5em", height: "0.82em", marginLeft: "0.06em", verticalAlign: "-0.06em", background: cursor, visibility: "hidden" }} />
      <span data-part="rest" style={{ visibility: "hidden" }} />
    </div>
  );
}

const stationLabelStyle = (layout: PromoLayout): CSSProperties => ({
  ...MONO_FONT,
  fontSize: layout.station.font,
  lineHeight: 1.2,
  whiteSpace: "pre",
});

function Station({ layout, id, index }: { layout: PromoLayout; id: StationId; index: number }) {
  const point = stationPoint(layout, index);
  const { icon, labelGap, font } = layout.station;
  const vertical = layout.vertical;
  const label = PROMO_TEXTS.stations[id];
  const hasIcon = id !== "human";
  return (
    <div
      data-promo={`station-${id}`}
      style={{ position: "absolute", left: point.x, top: point.y, width: 0, height: 0, ...hidden }}
    >
      {hasIcon ? (
        <div
          data-part="tile"
          style={{
            position: "absolute",
            width: icon,
            height: icon,
            left: -icon / 2,
            top: -icon / 2,
            color: "var(--color-ink-inverse)",
            background: "var(--color-ink)",
            borderRadius: 20,
            boxShadow: "0 0 0 8px var(--color-ink)",
            ["--icon-glass" as string]: "var(--color-ink-inverse-muted)",
          }}
        >
          <Icon name={id === "mandate" ? "mandate" : id} px={icon} dimmed={id === "mandate"} />
        </div>
      ) : null}
      <div
        data-part="label"
        style={{
          position: "absolute",
          ...stationLabelStyle(layout),
          color: "var(--color-ink-inverse)",
          ...(vertical
            ? { left: icon / 2 + labelGap, top: -font * 0.6 }
            : { left: 0, top: icon / 2 + labelGap, transform: "translateX(-50%)" }),
        }}
      >
        <span data-part="typed">{id === "human" ? "" : label}</span>
        {id === "human" ? <span data-part="rest" style={{ visibility: "hidden" }}>{label}</span> : null}
      </div>
      {id === "mandate" ? (
        <div
          data-part="note"
          style={{
            position: "absolute",
            ...MONO_FONT,
            fontSize: layout.mandateNote.font,
            color: "var(--color-ink-inverse-muted)",
            whiteSpace: "pre",
            ...(vertical
              ? { left: icon / 2 + labelGap, top: font * 0.9 }
              : { left: 0, top: icon / 2 + labelGap + font * 1.5, transform: "translateX(-100%)" }),
            ...hidden,
          }}
        >
          {PROMO_TEXTS.mandateNote}
        </div>
      ) : null}
    </div>
  );
}

function Terminal({ layout }: { layout: PromoLayout }) {
  const t = layout.terminal;
  return (
    <div data-promo="terminal" style={{ position: "absolute", left: t.x, top: t.y, width: t.width, ...hidden }}>
      {[0, 1, 2].map((row) => (
        <div key={row} data-promo={`term-row-${row}`} style={{ ...MONO_FONT, fontSize: t.font, height: t.lineHeight, lineHeight: `${t.lineHeight}px`, whiteSpace: "pre", color: "var(--color-ink-inverse-muted)" }}>
          <span data-part="typed" />
          <span data-part="cursor" style={{ display: "inline-block", width: "0.55em", height: "1em", marginLeft: "0.1em", verticalAlign: "-0.14em", background: "var(--color-ink-inverse)", visibility: "hidden" }} />
        </div>
      ))}
      <div
        data-promo="term-note"
        style={{ ...MONO_FONT, fontSize: t.noteFont, marginTop: t.noteGap, color: "var(--color-ink-inverse-muted)", opacity: 0.9 }}
      >
        {PROMO_TEXTS.simulationNote}
      </div>
    </div>
  );
}

function WindowContent({ layout, demo }: { layout: PromoLayout; demo: PromoDemo }) {
  const win = layout.window;
  const chart = layout.chart;
  const figures = [
    { id: "open", label: PROMO_TEXTS.figures.open, value: demo.openDossiers },
    { id: "appointments", label: PROMO_TEXTS.figures.appointments, value: demo.appointmentsPlanned },
    { id: "mandates", label: PROMO_TEXTS.figures.mandates, value: demo.mandatesConfirmed },
  ];
  const column = (win.w - 2 * 48) / figures.length;
  return (
    <div data-promo="window" style={{ position: "absolute", inset: 0, ...hidden }}>
      {figures.map((figure, k) => (
        <div key={figure.id} style={{ position: "absolute", left: win.x + 48 + k * column, top: layout.figures.y, width: column, color: "var(--color-ink)" }}>
          <div data-promo={`figure-${figure.id}`} data-value={figure.value} style={{ ...MONO_FONT, fontWeight: 500, fontSize: layout.figures.numberSize, lineHeight: 1.1 }}>
            0
          </div>
          <div style={{ ...MONO_FONT, fontSize: layout.figures.labelSize, color: "var(--color-ink-muted)", marginTop: 6, whiteSpace: "nowrap" }}>{figure.label}</div>
        </div>
      ))}
      <div style={{ position: "absolute", left: chart.x, top: chart.labelY, ...MONO_FONT, fontSize: chart.labelSize, color: "var(--color-ink-muted)" }}>{PROMO_TEXTS.chartLabel}</div>
      <div
        style={{
          position: "absolute",
          left: win.x,
          width: win.w,
          top: layout.fictionNote.y,
          textAlign: "center",
          ...MONO_FONT,
          fontSize: layout.fictionNote.font,
          color: "var(--color-ink-muted)",
        }}
      >
        {PROMO_TEXTS.fictionalNote}
      </div>
    </div>
  );
}

export function PromoOverlay({ layout, demo }: { layout: PromoLayout; demo: PromoDemo }) {
  const W = layout.width;
  const mainWords = PROMO_TEXTS.main4.split(" ");
  const veil = layout.veil.radius;
  const sig = layout.signature;
  return (
    <div style={{ position: "absolute", inset: 0, color: "var(--color-ink)" }}>
      {/* Fonts are only fetched when used: touch every face once so that `ready` can wait for them. */}
      <div aria-hidden style={{ position: "absolute", opacity: 0, left: 0, top: 0 }}>
        <span style={PROMPT_FONT}>a</span>
        <span style={MONO_FONT}>0</span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>0</span>
        <span style={SANS_FONT}>a</span>
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>a</span>
      </div>

      <Anchor x={layout.title1.x} y={layout.title1.y}>
        <div data-promo="veil1" style={{ position: "absolute", left: -veil, top: -veil * 0.34, width: veil * 2, height: veil * 0.68, borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-pearl-soft) 90%, transparent), color-mix(in srgb, var(--color-pearl-soft) 70%, transparent) 55%, transparent)", ...hidden }} />
      </Anchor>
      <Anchor x={layout.title1.x} y={layout.title1.y}>
        <Typed id="title1" cursor="var(--color-ink)" style={{ ...PROMPT_FONT, fontSize: layout.titleSize, lineHeight: 1.1 }} />
      </Anchor>
      <Anchor x={layout.title2.x} y={layout.title2.y}>
        <Typed id="title2" cursor="var(--color-ink)" style={{ ...PROMPT_FONT, fontSize: layout.titleSize, lineHeight: 1.1 }} />
      </Anchor>

      {STATION_IDS.map((id, index) => (
        <Station key={id} layout={layout} id={id} index={index} />
      ))}
      <Terminal layout={layout} />

      <div
        data-promo="main4"
        style={{
          position: "absolute",
          left: layout.main4.x - layout.main4.width / 2,
          top: layout.main4.y,
          width: layout.main4.width,
          textAlign: layout.vertical ? "left" : "center",
          ...PROMPT_FONT,
          fontSize: layout.main4.size,
          lineHeight: `${layout.main4.lineHeight}px`,
          color: "var(--color-ink-inverse)",
          ...hidden,
        }}
      >
        {mainWords.map((word, k) => (
          <span key={`${word}-${k}`} data-word={k} style={{ display: "inline-block", opacity: 0 }}>
            {word}
            {k < mainWords.length - 1 ? " " : ""}
          </span>
        ))}
      </div>

      <WindowContent layout={layout} demo={demo} />

      <Anchor x={layout.title5.x} y={layout.title5.y}>
        <div data-promo="title5" style={{ ...PROMPT_FONT, fontSize: layout.title5.size, lineHeight: 1.1, ...hidden }}>
          {PROMO_TEXTS.title5}
        </div>
      </Anchor>

      <div style={{ position: "absolute", left: 0, width: W, top: sig.y - sig.lineHeight, textAlign: "center", ...SANS_FONT, fontSize: sig.size, lineHeight: `${sig.lineHeight}px`, letterSpacing: "-0.01em" }}>
        <div data-promo="sig-0" style={hidden}>
          {PROMO_TEXTS.signatureName}
        </div>
        <div data-promo="sig-1" style={hidden}>
          {PROMO_TEXTS.signatureLine}
        </div>
      </div>

      <div
        data-promo="mention"
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: layout.mention.y - layout.mention.font * 1.4,
          textAlign: "center",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          fontSize: layout.mention.font,
          lineHeight: 1.4,
          color: "var(--color-ink-muted)",
          ...hidden,
        }}
      >
        {PROMO_TEXTS.prototypeNote}
      </div>
    </div>
  );
}
