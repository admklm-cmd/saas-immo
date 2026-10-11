import type { IconDefinition } from "../icon-types";
import {
  BELL_PATH,
  Blob,
  CLAPPER_PATH,
  Dot,
  GEAR_PATH,
  Line,
  OnAccent,
  Person,
  STROKE,
  ViewfinderCorners,
} from "../shapes";

/**
 * Board icons, second half (docs/references/icons/planche-1-noir-cobalt.png,
 * rows 3–4): channels, controls and signals.
 */
export const BOARD_SIGNAL_ICONS = {
  /** Téléphone — the handset; its waves pulse one after the other. */
  phone: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob d="M6.9 3.1c.8-.4 1.8-.2 2.3.6l1.9 3.1c.4.7.3 1.6-.3 2.2l-1.4 1.2c.9 2 2.5 3.7 4.5 4.7l1.2-1.4c.6-.6 1.5-.7 2.2-.3l3.1 1.9c.8.5 1 1.5.6 2.3l-.9 1.6c-.7 1.2-2.1 1.8-3.4 1.4C10.6 18.9 5.2 13.5 3.7 7.5c-.4-1.3.2-2.7 1.4-3.4z" />
    ),
    accent: (
      <>
        <Line d="M14.6 5.6a4 4 0 0 1 3.8 3.8" width={STROKE.line} m="seq-1" />
        <Line d="M15 2.4a7 7 0 0 1 6.6 6.6" width={STROKE.line} m="seq-2" />
      </>
    ),
  },
  /** Validation humaine — a person, and the badge of their decision: the check draws. */
  humanValidation: {
    tone: "accent",
    animated: true,
    ink: <Person />,
    accent: (
      <>
        <Dot cx={17.6} cy={17.3} r={4.4} m="disc" />
        <OnAccent d="M15.7 17.4l1.3 1.3 2.6-2.6" m="check" />
      </>
    ),
  },
  /** Simulation — a model in its sandbox: the brackets close in on it. */
  simulation: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <ViewfinderCorners />
        <Line d="M9.1 9.8 14.6 14.2 9.6 16.4" width={2.8} />
        <Dot cx={9.1} cy={9.8} r={2.4} />
        <Dot cx={14.6} cy={14.2} r={2.4} />
        <Dot cx={9.6} cy={16.4} r={1.7} />
      </>
    ),
    accent: <Dot cx={16.7} cy={7.3} r={1.6} />,
  },
  /** Analytics — the bars rise, the last one is still being measured (glass). */
  analytics: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <rect x={2.8} y={15} width={3.5} height={5.8} rx={1.75} fill="currentColor" data-m="bar-1" />
        <rect x={7.9} y={11.4} width={3.5} height={9.4} rx={1.75} fill="currentColor" data-m="bar-2" />
        <rect x={13} y={7.6} width={3.5} height={13.2} rx={1.75} fill="currentColor" data-m="bar-3" />
      </>
    ),
    glass: <rect x={18.1} y={8.6} width={3.3} height={12.2} rx={1.65} fill="currentColor" data-m="bar-4" />,
    accent: <Dot cx={19.75} cy={4.6} r={1.9} />,
  },
  /** Croissance — a rising curve; the arrow climbs to its target. */
  growth: {
    tone: "accent",
    animated: true,
    ink: <Line d="M4 18.4c1.2-2.4 2.9-2.7 4.3-.9 1.4 1.8 3 1.3 4-.8 1-2.1 2.3-3.3 4-3.4" width={STROKE.heavy} />,
    accent: (
      <>
        <Line d="M16.6 11.2 19.2 7.6" width={STROKE.line} />
        <Blob d="M17.2 4.6 21.6 3.2l-.6 4.6z" />
      </>
    ),
  },
  /** Priorité — a target; its core pulses once. */
  priority: {
    tone: "accent",
    animated: true,
    glass: <Dot cx={12} cy={12} r={7} m="halo" />,
    ink: <Line d="M12 2.2v4M12 17.8v4M2.2 12h4M17.8 12h4" width={STROKE.hair} />,
    accent: <Dot cx={12} cy={12} r={3.7} />,
  },
  /** Alerte — the bell, and the red dot that pops (always next to words). */
  alert: {
    tone: "danger",
    animated: true,
    ink: (
      <>
        <Blob d={BELL_PATH} />
        <Blob d={CLAPPER_PATH} />
      </>
    ),
    accent: <Dot cx={18.6} cy={4.6} r={2.5} />,
  },
  /** Recherche — the magnifier sweeps once over what it looks for. */
  search: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <circle cx={10.4} cy={10.4} r={6.7} fill="none" stroke="currentColor" strokeWidth={STROKE.bold} />
        <Line d="M15.5 15.5 20.6 20.6" width={STROKE.heavy} />
      </>
    ),
    accent: <Dot cx={10.4} cy={10.4} r={1.9} />,
  },
  /** Filtres — three sliders; the knobs slide to their setting. */
  filters: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Line d="M3 6h18M3 12h18M3 18h18" width={STROKE.hair} />
        <Dot cx={12.6} cy={12} r={2.1} m="knob-2" />
        <Dot cx={16.6} cy={18} r={2.1} m="knob-3" />
      </>
    ),
    accent: <Dot cx={8.8} cy={6} r={2.3} />,
  },
  /** Paramètres — the gear turns one notch. */
  settings: {
    tone: "accent",
    animated: true,
    ink: (
      <path
        d={GEAR_PATH}
        fill="currentColor"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
        data-m="gear"
      />
    ),
    accent: <Dot cx={12} cy={12} r={2.2} />,
  },
  /** Intégrations — tools around the agency; the links connect, then the new one lights. */
  integrations: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Line d="M11 4.4a8.4 8.4 0 0 1 5.6 4.4" width={STROKE.hair} m="seq-1" />
        <Line d="M16.9 16.4a8.4 8.4 0 0 1-6.6 3.8" width={STROKE.hair} m="seq-2" />
        <Line d="M5.2 15.4a8.4 8.4 0 0 1 .3-6.6" width={STROKE.hair} m="seq-3" />
        <Dot cx={7.8} cy={5.6} r={2.6} />
        <Dot cx={6.8} cy={18.5} r={2.6} />
      </>
    ),
    accent: <Dot cx={18.4} cy={12.4} r={2.9} />,
  },
  /** Notifications — the bell swings once, its waves ring. */
  notifications: {
    tone: "accent",
    animated: true,
    ink: (
      <g transform="translate(12 12.4) scale(0.78) translate(-12 -12)">
        <g data-m="bell">
          <Blob d={BELL_PATH} />
          <Blob d={CLAPPER_PATH} />
        </g>
      </g>
    ),
    accent: (
      <>
        <Line d="M4.4 8.4c-1.3 2.3-1.3 5.2 0 7.5" width={STROKE.line} m="seq-1" />
        <Line d="M19.6 8.4c1.3 2.3 1.3 5.2 0 7.5" width={STROKE.line} m="seq-2" />
      </>
    ),
  },
} as const satisfies Record<string, IconDefinition>;
