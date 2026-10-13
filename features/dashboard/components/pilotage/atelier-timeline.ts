import { createTimeline } from "./pilotage-motion";

/**
 * The only Anime.js timeline of « L'Atelier » (docs §3.5.2.F): eight type dossiers leave
 * Léa one after the other, cross the three first stations and stop at the human checkpoint;
 * the first one is confirmed by a human and goes on to Louis, Sarah and « Mandat ». Played
 * once, deterministic (no random), `transform` and `opacity` only, reverted on stop.
 */

/** Dossiers that cross the scene. */
export const TOKEN_COUNT = 8;
export const DEPARTURE_MS = 450;
export const LEG_MS = 800;
export const DWELL_MS = 250;
/** Time a confirmed dossier stays at the human checkpoint before it goes on. */
export const VALIDATION_MS = 350;

export type Point = { x: number; y: number };

export type AtelierPlayOptions = {
  /** Centres of the 7 stations, in the coordinates of `root`. */
  anchors: readonly Point[];
  tokens: readonly HTMLElement[];
  /** Cobalt bits: at most two, they travel with the first and the fourth token. */
  bits: readonly HTMLElement[];
  /** Index of the human station. */
  humanIndex: number;
  /** The first token goes on to the mandate only when a mandate was really signed. */
  confirmed: boolean;
  onStation: (index: number | null) => void;
  onDone: () => void;
};

export type AtelierPlayback = { stop: () => void };

const HALF = 4;

export function playAtelier(options: AtelierPlayOptions): AtelierPlayback {
  const { anchors, tokens, bits, humanIndex, confirmed, onStation, onDone } = options;
  const at = (index: number): Point => anchors[index] ?? anchors[anchors.length - 1] ?? { x: 0, y: 0 };
  const timeline = createTimeline({
    autoplay: true,
    defaults: { ease: "inOutSine" },
    onComplete: () => {
      onStation(null);
      onDone();
    },
  });

  const followers: Array<{ token: number; el: HTMLElement }> = bits.map((el, order) => ({ token: order === 0 ? 0 : 3, el }));

  tokens.forEach((token, i) => {
    const start = i * DEPARTURE_MS;
    const first = at(0);
    const mine = followers.filter((follower) => follower.token === i).map((follower) => follower.el);
    const targets = [token, ...mine];
    timeline.set(targets, { translateX: first.x - HALF, translateY: first.y - HALF, scale: 1, opacity: 0 }, 0);
    timeline.add(targets, { opacity: [0, 1], duration: 120, ease: "linear" }, start);

    // Léa -> Hugo -> Emma -> human checkpoint
    let clock = start;
    for (let station = 1; station <= humanIndex; station += 1) {
      const to = at(station);
      timeline.add(targets, { translateX: to.x - HALF, translateY: to.y - HALF, duration: LEG_MS }, clock + DWELL_MS);
      clock += LEG_MS + DWELL_MS;
      const arrival = clock;
      timeline.add(token, { scale: [1, 1.5, 1], duration: DWELL_MS + 100, ease: "outQuad" }, arrival);
      if (i === 0 || i === TOKEN_COUNT - 1) timeline.call(() => onStation(station), arrival);
    }

    // The confirmed dossier: validated by a human, then Louis, Sarah, « Mandat ».
    if (i === 0 && confirmed) {
      clock += VALIDATION_MS;
      for (let station = humanIndex + 1; station < anchors.length; station += 1) {
        const to = at(station);
        timeline.add(targets, { translateX: to.x - HALF, translateY: to.y - HALF, duration: LEG_MS }, clock);
        clock += LEG_MS + DWELL_MS;
        timeline.call(() => onStation(station), clock - DWELL_MS);
      }
    }
  });

  return {
    stop: () => {
      timeline.pause();
      timeline.revert();
      onStation(null);
    },
  };
}
