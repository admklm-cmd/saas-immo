import type { PromoLayout } from "./promo-format";
import { PROMO_TEXTS } from "./promo-texts";
import {
  blinkOn,
  easeInOut,
  easeOut,
  isTyping,
  lerp,
  MAIN4_FROM,
  MAIN4_OUT,
  MAIN4_STAGGER_MS,
  MAIN4_WORD_MS,
  progress,
  SIGNATURE_LINES,
  STATION_ARRIVAL,
  STATION_IDS,
  T,
  TERMINAL_IN_FROM,
  TERMINAL_OUT,
  terminalView,
  TITLE5_IN,
  TITLE5_OUT,
  title1Chars,
  title2Chars,
  typedCount,
  type StationId,
} from "./promo-timeline";

/** Handles on the DOM layer (collected once from the `data-promo` attributes). */
export type PromoDomRefs = {
  get: (key: string) => HTMLElement | null;
  part: (key: string, part: "typed" | "cursor" | "rest" | "tile" | "label" | "note") => HTMLElement | null;
  words: HTMLElement[];
};

export function collectRefs(root: HTMLElement): PromoDomRefs {
  const cache = new Map<string, HTMLElement | null>();
  const get = (key: string) => {
    if (!cache.has(key)) cache.set(key, root.querySelector<HTMLElement>(`[data-promo="${key}"]`));
    return cache.get(key) ?? null;
  };
  const part = (key: string, name: string) => get(key)?.querySelector<HTMLElement>(`[data-part="${name}"]`) ?? null;
  const words = Array.from(root.querySelectorAll<HTMLElement>('[data-promo="main4"] [data-word]'));
  return { get, part: part as PromoDomRefs["part"], words };
}

const fade = (t: number, from: number, to: number) => easeOut(progress(t, from, to));

function setOpacity(element: HTMLElement | null, value: number) {
  if (!element) return;
  const rounded = Math.round(value * 1000) / 1000;
  element.style.opacity = String(rounded);
}

function setTyped(refs: PromoDomRefs, key: string, full: string, chars: number, cursorVisible: boolean) {
  const typed = refs.part(key, "typed");
  const rest = refs.part(key, "rest");
  const cursor = refs.part(key, "cursor");
  if (typed) typed.textContent = full.slice(0, chars);
  if (rest) rest.textContent = full.slice(chars);
  if (cursor) cursor.style.visibility = cursorVisible ? "visible" : "hidden";
}

function updateTitles(refs: PromoDomRefs, t: number) {
  const full1 = PROMO_TEXTS.title1;
  const chars1 = title1Chars(t);
  const active1 = t >= 300 && t < T.title1EraseFrom + full1.length * T.title1EraseMs + 80;
  const typing1 = (t >= T.title1TypeFrom && chars1 < full1.length && t < T.title1EraseFrom) || t >= T.title1EraseFrom;
  setOpacity(refs.get("title1"), active1 ? 1 : 0);
  setTyped(refs, "title1", full1, chars1, active1 && (typing1 || blinkOn(t)));
  const veil = t < 4000 ? fade(t, 300, 900) : 1 - fade(t, 4300, 5300);
  setOpacity(refs.get("veil1"), Math.max(0, veil));

  const full2 = PROMO_TEXTS.title2;
  const chars2 = title2Chars(t);
  const end2 = T.title2EraseFrom + full2.length * T.title1EraseMs + 80;
  const active2 = t >= 5700 && t < end2;
  const typing2 = (t >= T.title2TypeFrom && chars2 < full2.length && t < T.title2EraseFrom) || t >= T.title2EraseFrom;
  setOpacity(refs.get("title2"), active2 ? 1 : 0);
  setTyped(refs, "title2", full2, chars2, active2 && (typing2 || blinkOn(t)));
}

function updateStations(refs: PromoDomRefs, t: number) {
  const present = fade(t, 9700, 10_100) * (1 - fade(t, 20_300, 20_500));
  STATION_IDS.forEach((id: StationId) => {
    const element = refs.get(`station-${id}`);
    if (!element) return;
    setOpacity(element, id === "human" ? present : present);
    const arrival = STATION_ARRIVAL[id];
    const lit = id === "mandate" ? 0 : id === "lea" || id === "hugo" || id === "emma" ? 1 : fade(t, arrival - 350, arrival);
    const tile = refs.part(`station-${id}`, "tile");
    const label = refs.part(`station-${id}`, "label");
    const tone = id === "mandate" ? 0.4 : lerp(0.4, 1, lit);
    if (tile) {
      const pulse = id === "human" || id === "mandate" ? 0 : Math.sin(Math.PI * progress(t, arrival - 200, arrival + 400));
      tile.style.opacity = String(Math.round(tone * 1000) / 1000);
      tile.style.transform = `scale(${(1 + 0.1 * pulse).toFixed(4)})`;
    }
    if (label && id !== "human") label.style.opacity = String(Math.round(tone * 1000) / 1000);
  });
  // The label of the human validation is written, not displayed (docs §4 plan 4).
  const humanLabel = PROMO_TEXTS.humanLabel;
  const humanChars = typedCount(t, T.humanPointAt, 36, humanLabel.length);
  const typed = refs.part("station-human", "typed");
  const rest = refs.part("station-human", "rest");
  if (typed) typed.textContent = humanLabel.slice(0, humanChars);
  if (rest) rest.textContent = humanLabel.slice(humanChars);
  const note = refs.part("station-mandate", "note");
  setOpacity(note, fade(t, T.mandateNoteAt, T.mandateNoteAt + 250));
}

function updateTerminal(refs: PromoDomRefs, layout: PromoLayout, t: number) {
  const terminal = refs.get("terminal");
  const visible = fade(t, TERMINAL_IN_FROM, TERMINAL_IN_FROM + 200) * (1 - fade(t, TERMINAL_OUT.from, TERMINAL_OUT.to));
  setOpacity(terminal, visible);
  if (!terminal) return;
  const lift = layout.terminal.lift * easeInOut(progress(t, 16_900, 17_400));
  terminal.style.transform = `translateY(${(-lift).toFixed(2)}px)`;
  const view = terminalView(t);
  const typing = isTyping(t);
  for (let row = 0; row < 3; row++) {
    const entry = view[row];
    const typed = refs.part(`term-row-${row}`, "typed");
    const cursor = refs.part(`term-row-${row}`, "cursor");
    const rowElement = refs.get(`term-row-${row}`);
    if (!typed || !cursor || !rowElement) continue;
    if (!entry) {
      // Before the first line the cursor blinks alone on the first row.
      typed.textContent = "";
      cursor.style.visibility = view.length === 0 && row === 0 && blinkOn(t) ? "visible" : "hidden";
      continue;
    }
    typed.textContent = entry.line.text.slice(0, entry.chars);
    const isLast = row === view.length - 1;
    cursor.style.visibility = isLast && (typing || blinkOn(t)) ? "visible" : "hidden";
    rowElement.style.color = entry.line.kind === "human" ? "var(--color-ink-inverse)" : "var(--color-ink-inverse-muted)";
  }
}

function updateMain4(refs: PromoDomRefs, t: number) {
  const container = refs.get("main4");
  setOpacity(container, t >= MAIN4_FROM - 50 ? 1 - fade(t, MAIN4_OUT.from, MAIN4_OUT.to) : 0);
  refs.words.forEach((word, k) => {
    const p = fade(t, MAIN4_FROM + k * MAIN4_STAGGER_MS, MAIN4_FROM + k * MAIN4_STAGGER_MS + MAIN4_WORD_MS);
    word.style.opacity = String(Math.round(p * 1000) / 1000);
    word.style.transform = `translateY(${((1 - p) * 12).toFixed(2)}px)`;
  });
}

function updateWindow(refs: PromoDomRefs, t: number) {
  const visible = fade(t, 22_000, 22_400) * (1 - fade(t, 25_300, 25_700));
  setOpacity(refs.get("window"), visible);
  const progressValue = easeOut(progress(t, T.figuresFrom, T.figuresTo));
  for (const id of ["open", "appointments", "mandates"]) {
    const element = refs.get(`figure-${id}`);
    if (!element) continue;
    const value = Number(element.dataset.value ?? "0");
    element.textContent = String(Math.round(value * progressValue));
  }
}

function updateTail(refs: PromoDomRefs, t: number) {
  const title5 = refs.get("title5");
  const appear = fade(t, TITLE5_IN.from, TITLE5_IN.to);
  setOpacity(title5, appear * (1 - fade(t, TITLE5_OUT.from, TITLE5_OUT.to)));
  if (title5) title5.style.transform = `translateY(${((1 - appear) * 10).toFixed(2)}px)`;
  SIGNATURE_LINES.forEach((window, k) => {
    const line = refs.get(`sig-${k}`);
    if (!line) return;
    const p = fade(t, window.from, window.to);
    setOpacity(line, p);
    line.style.transform = `translateY(${((1 - p) * 10).toFixed(2)}px)`;
  });
  setOpacity(refs.get("mention"), fade(t, 21_000, 21_400));
}

/** Writes the whole DOM layer for the time `t` (synchronously, no timer, no animation engine). */
export function updatePromoDom(refs: PromoDomRefs, layout: PromoLayout, t: number): void {
  updateTitles(refs, t);
  updateStations(refs, t);
  updateTerminal(refs, layout, t);
  updateMain4(refs, t);
  updateWindow(refs, t);
  updateTail(refs, t);
}
