import type { IconDefinition } from "../icon-types";
import { Blob, Dot, Line, STROKE } from "../shapes";

/**
 * Utility glyphs, same grid and language. Directional and structural signs
 * (arrows, chevrons, close, menu, check) are `ink` only and never move on
 * their own: they sit in buttons whose own motion already speaks
 * (`ButtonArrowGlyph`). The others keep one cobalt accent.
 */
export const UTILITY_ICONS = {
  check: {
    tone: "ink",
    animated: false,
    ink: null,
    accent: <Line d="M5 12.6l4.4 4.4L19 7.4" width={STROKE.bold} />,
  },
  arrowRight: {
    tone: "ink",
    animated: false,
    ink: <Line d="M4.5 12h14" width={STROKE.line} />,
    accent: <Line d="M13.4 6.6 18.8 12l-5.4 5.4" width={STROKE.line} />,
  },
  arrowLeft: {
    tone: "ink",
    animated: false,
    ink: <Line d="M19.5 12h-14" width={STROKE.line} />,
    accent: <Line d="M10.6 6.6 5.2 12l5.4 5.4" width={STROKE.line} />,
  },
  /**
   * Replay — « Rejouer les animations » of the landing (docs/design-system.md
   * §2.11.8.8 L4-D): an arc of 300°, open at the top right, round ends, and a
   * solid arrow head at its end. Same stroke and ends as `arrowLeft`; never
   * rotates on click.
   */
  replay: {
    tone: "ink",
    animated: false,
    ink: <Line d="M18.06 8.5A7 7 0 1 1 12 5" width={STROKE.line} />,
    accent: <Blob d="M15.6 5 10.9 1.7v6.6z" />,
  },
  arrowDown: {
    tone: "ink",
    animated: false,
    ink: <Line d="M12 4.5v14" width={STROKE.line} />,
    accent: <Line d="M6.6 13.4 12 18.8l5.4-5.4" width={STROKE.line} />,
  },
  chevronRight: {
    tone: "ink",
    animated: false,
    ink: null,
    accent: <Line d="M9.4 5.6 15.8 12l-6.4 6.4" width={STROKE.bold} />,
  },
  menu: {
    tone: "ink",
    animated: false,
    ink: <Line d="M4.5 8h15" width={STROKE.line} />,
    accent: <Line d="M4.5 16h15" width={STROKE.line} />,
  },
  close: {
    tone: "ink",
    animated: false,
    ink: <Line d="M6.4 6.4l11.2 11.2" width={STROKE.line} />,
    accent: <Line d="M17.6 6.4 6.4 17.6" width={STROKE.line} />,
  },
  /** Error of a run (replaces the crossed circle): a ring and its cross, next to the word « Échec ». */
  error: {
    tone: "ink",
    animated: false,
    ink: <circle cx={12} cy={12} r={8.6} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />,
    accent: <Line d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" width={STROKE.line} />,
  },

  // --- Signs with one accent --------------------------------------------------------
  /** Lock — the shackle closes (drops) on the body. */
  lock: {
    tone: "accent",
    animated: true,
    ink: <rect x={4.6} y={10.4} width={14.8} height={10.8} rx={3} fill="currentColor" />,
    accent: <Line d="M8 10.4V7.8a4 4 0 0 1 8 0v2.6" width={STROKE.bold} />,
  },
  /** Clock — the hands tick to the hour. */
  clock: {
    tone: "accent",
    animated: true,
    ink: <circle cx={12} cy={12} r={8.6} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />,
    accent: <Line d="M12 7.2V12l3.2 2.2" width={STROKE.bold} m="hand" />,
  },
  /** Document — a sheet; its folded corner is the accent. */
  document: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob d="M6 2.6h6.4v4.4a2.4 2.4 0 0 0 2.4 2.4H19v9.6a2.4 2.4 0 0 1-2.4 2.4H6a2.4 2.4 0 0 1-2.4-2.4V5A2.4 2.4 0 0 1 6 2.6z" />
    ),
    accent: <Blob d="M14 2.9 18.7 7.6a.3.3 0 0 1-.2.5h-3.6a1 1 0 0 1-1-1V3.1a.2.2 0 0 1 .1-.2z" />,
  },
  /** Merge — two records become one: the result moves on. */
  merge: {
    tone: "accent",
    animated: true,
    ink: <Line d="M4.5 5.2c0 4 3 6.8 7 6.8M4.5 18.8c0-4 3-6.8 7-6.8" width={STROKE.line} />,
    accent: (
      <>
        <Line d="M11.5 12h8" width={STROKE.line} />
        <Line d="M16.4 8.9 19.5 12l-3.1 3.1" width={STROKE.line} />
      </>
    ),
  },
  /** Question — a missing piece of information, flagged (never invented). */
  question: {
    tone: "accent",
    animated: true,
    ink: <circle cx={12} cy={12} r={8.6} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />,
    accent: (
      <>
        <Line d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.3" width={STROKE.line} />
        <Dot cx={12} cy={16.7} r={1.1} />
      </>
    ),
  },
  /** Change the stage of a dossier: the node sent along the line. */
  stageMove: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Dot cx={5.6} cy={12} r={2.6} />
        <Line d="M9.4 12h5.2" width={STROKE.line} />
      </>
    ),
    accent: <Dot cx={18.4} cy={12} r={2.8} />,
  },
  /** Validated output of a run: a disc and its check. */
  checkCircle: {
    tone: "accent",
    animated: true,
    ink: <circle cx={12} cy={12} r={8.6} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />,
    accent: <Line d="M8.2 12.3l2.6 2.6 5-5.1" width={STROKE.bold} m="check" />,
  },
  /** Context of a run built from code-like instructions. */
  code: {
    tone: "accent",
    animated: true,
    ink: <Line d="M8 7.2 3.4 12 8 16.8M16 7.2l4.6 4.8-4.6 4.8" width={STROKE.bold} />,
    accent: <Line d="M13.4 5.6 10.6 18.4" width={STROKE.line} />,
  },
  /** Persisted: the result filed in the box. */
  archive: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <rect x={3} y={4} width={18} height={4.6} rx={1.8} fill="currentColor" />
        <Blob d="M4.4 10.2h15.2v7.6a2.6 2.6 0 0 1-2.6 2.6H7a2.6 2.6 0 0 1-2.6-2.6z" />
      </>
    ),
    accent: <rect x={9.4} y={12.6} width={5.2} height={2} rx={1} fill="currentColor" />,
  },
} as const satisfies Record<string, IconDefinition>;
