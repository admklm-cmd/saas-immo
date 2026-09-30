import type { IconDefinition } from "../icon-types";
import { Blob, Dot, Line, OnAccent, Person, STROKE, ViewfinderCorners } from "../shapes";

/**
 * Board icons, first half (docs/references/icons/planche-1-noir-cobalt.png,
 * rows 1–2): the work of the agency. Each comment says what the story of the
 * icon tells (`icon-motion.module.css`).
 */
export const BOARD_WORK_ICONS = {
  /** Tableau de bord — four panes, the one that matters pulses once. */
  dashboard: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Dot cx={6.8} cy={6.8} r={4.1} />
        <Dot cx={6.8} cy={17.2} r={4.1} />
        <Dot cx={17.2} cy={17.2} r={4.1} />
      </>
    ),
    accent: <Dot cx={17.2} cy={6.8} r={4.1} />,
  },
  /** Contacts — a person, and a second one who joins (fades in). */
  contacts: {
    tone: "accent",
    animated: true,
    glass: (
      <Blob d="M14.6 20.2h5.9c.9 0 1.6-.6 1.4-1.5-.4-2.4-2.1-4-4.4-4-1.1 0-2.1.3-2.9.9.5.9.8 2 .8 3.1 0 .6-.3 1.1-.8 1.5z" />
    ),
    ink: <Person />,
    accent: <Dot cx={17.6} cy={10.1} r={2.4} />,
  },
  /** Leads — a person caught in the viewfinder: the frame focuses on them. */
  leads: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <g data-m="frame">
          <ViewfinderCorners />
        </g>
        <Dot cx={11.4} cy={10} r={2.5} />
        <Blob d="M7.2 17.2c.3-2.3 2-3.7 4.2-3.7s3.9 1.4 4.2 3.7c.1.7-.4 1.3-1.1 1.3H8.3c-.7 0-1.2-.6-1.1-1.3z" />
      </>
    ),
    accent: <Dot cx={16.7} cy={7.3} r={1.6} />,
  },
  /** Pipeline — a funnel, a bead (the dossier) drops through it. */
  pipeline: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Blob d="M4.6 3.2h14.8c1 0 1.8.8 1.8 1.8 0 .8-.6 1.6-1.4 1.8-2.4.6-5.1.9-7.8.9s-5.4-.3-7.8-.9C3.4 6.6 2.8 5.8 2.8 5c0-1 .8-1.8 1.8-1.8z" />
        <rect x={5.4} y={9} width={13.2} height={2.9} rx={1.45} fill="currentColor" />
        <rect x={7.8} y={13.4} width={8.4} height={2.5} rx={1.25} fill="currentColor" />
      </>
    ),
    accent: <Dot cx={12} cy={19.4} r={1.9} />,
  },
  /** Deal — two parties; the glass one slides over the other, the arrow says « up ». */
  deal: {
    tone: "accent",
    animated: true,
    ink: <Dot cx={8.6} cy={13} r={5.9} />,
    glass: <Dot cx={13.6} cy={15} r={5.4} m="sphere" />,
    glassAbove: true,
    accent: (
      <>
        <Line d="M16.4 8.1 20.6 3.9" width={STROKE.line} />
        <Line d="M17.2 3.6h3.6v3.6" width={STROKE.line} />
      </>
    ),
  },
  /** Agent IA — modules linked together; the active node pulses along its link. */
  aiAgent: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Line d="M14.6 6.4 7 12.6 13.6 18.8" width={3.2} />
        <Dot cx={14.6} cy={6.2} r={3.6} />
        <Dot cx={6.6} cy={12.8} r={3.3} />
        <Dot cx={14} cy={19.2} r={1.9} />
      </>
    ),
    accent: <Dot cx={19.2} cy={13.2} r={2.6} />,
  },
  /** Automatisation — a bead travels the scenario path, then leaves by the arrow. */
  automation: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Line d="M4.6 4.4H15a3.6 3.6 0 0 1 0 7.2H8a3.7 3.7 0 0 0 0 7.4h2.6" width={STROKE.hair} />
        <Dot cx={4.6} cy={4.4} r={1.9} />
        <Dot cx={11.9} cy={19} r={2.2} />
      </>
    ),
    accent: (
      <>
        <Dot cx={11.2} cy={11.6} r={2.3} m="bead" />
        <g data-m="exit">
          <Line d="M15.6 19H21" width={STROKE.hair} />
          <Line d="M18.8 16.8 21 19l-2.2 2.2" width={STROKE.hair} />
        </g>
      </>
    ),
  },
  /** Messages — a reply is being written: the three dots blink in sequence. */
  messages: {
    tone: "accent",
    animated: true,
    glass: (
      <Blob d="M12.4 9.8h6.4a3.7 3.7 0 0 1 3.7 3.7v1.3c0 1.5-.9 2.8-2.2 3.4v2.3c0 .5-.6.8-1 .5l-2.9-2.5h-4a3.7 3.7 0 0 1-3.7-3.7v-1.3a3.7 3.7 0 0 1 3.7-3.7z" />
    ),
    ink: (
      <Blob d="M6.2 3.3h8.3a4.6 4.6 0 0 1 4.6 4.6v1.6a4.6 4.6 0 0 1-4.6 4.6H9.3l-4 3.2c-.5.4-1.2 0-1.2-.6v-3.2a4.6 4.6 0 0 1-2.5-4V7.9a4.6 4.6 0 0 1 4.6-4.6z" />
    ),
    accent: (
      <>
        <Dot cx={6.8} cy={8.7} r={1.15} m="seq-1" />
        <Dot cx={10.35} cy={8.7} r={1.15} m="seq-2" />
        <Dot cx={13.9} cy={8.7} r={1.15} m="seq-3" />
      </>
    ),
  },
  /** Calendrier — a page of days; the dot hops to the chosen date. */
  calendar: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <rect
          x={3.4}
          y={5}
          width={17.2}
          height={15.6}
          rx={3}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE.line}
        />
        <Line d="M8 3v3.6M16 3v3.6" width={STROKE.line} />
        <Line d="M3.6 9.4h16.8" width={STROKE.hair} />
        {[7.6, 10.4, 16.4].map((x) => (
          <Dot key={`a${x}`} cx={x} cy={12.9} r={0.85} />
        ))}
        <Dot cx={13.4} cy={12.9} r={0.85} />
        {[7.6, 10.4, 16.4].map((x) => (
          <Dot key={`b${x}`} cx={x} cy={16.6} r={0.85} />
        ))}
      </>
    ),
    accent: <Dot cx={13.4} cy={16.6} r={1.55} />,
  },
  /** Tâches — the first line is done: its check is drawn. */
  tasks: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <circle cx={5.3} cy={12} r={1.9} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />
        <circle cx={5.3} cy={18.2} r={1.9} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />
        <Line d="M10.6 5.8h10M10.6 12h9.4M10.6 18.2h7.6" width={STROKE.bold} />
      </>
    ),
    accent: (
      <>
        <Dot cx={5.3} cy={5.8} r={2.8} m="disc" />
        <OnAccent d="M4 5.9l.95.95L6.7 5.1" m="check" />
      </>
    ),
  },
  /** Rappels — a clock; its hand ticks forward to the reminder. */
  reminders: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <circle cx={11.6} cy={12.6} r={8.4} fill="none" stroke="currentColor" strokeWidth={STROKE.line} />
        <Line d="M11.6 7.9v4.8l2.9 2.5" width={STROKE.bold} m="hand" />
      </>
    ),
    accent: <Dot cx={18.4} cy={6.6} r={1.8} />,
  },
  /** Email — an envelope; the new message drops onto its corner. */
  email: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Blob d="M2.4 10.3 11.3 15.8 20.2 10.3v6.4a2.6 2.6 0 0 1-2.6 2.6H5a2.6 2.6 0 0 1-2.6-2.6z" />
        <Blob d="M5 6.4h12.6c.9 0 1.7.5 2.2 1.2l-8.5 5.3-8.5-5.3c.5-.7 1.3-1.2 2.2-1.2z" />
      </>
    ),
    accent: <Dot cx={19.6} cy={5.4} r={2.7} />,
  },
} as const satisfies Record<string, IconDefinition>;
