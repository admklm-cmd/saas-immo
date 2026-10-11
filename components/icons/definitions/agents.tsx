import type { IconDefinition } from "../icon-types";
import { Blob, Dot, Line, OnAccent, Person, STROKE } from "../shapes";

/**
 * The five AI agents and the other stages of a dossier. Each agent says its
 * JOB (never a personality) and stays distinct from the generic « Agent IA »
 * (linked modules) and from the board icons it could be mistaken for:
 * Léa = a tray a contact drops into, Hugo = a property under the lens,
 * Emma = a message that comes back (follow-up), Louis = a filled calendar
 * card with its slot, Sarah = the dossier sent forward.
 */
export const AGENT_ICON_DEFINITIONS = {
  /** Léa, acquisition — a new contact drops into the agency's tray. */
  lea: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob d="M3 13.3h4.4c.4 0 .8.2 1 .5l1.2 1.8c.2.3.6.5 1 .5h2.8c.4 0 .8-.2 1-.5l1.2-1.8c.2-.3.6-.5 1-.5H21v4.2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
    ),
    accent: <Dot cx={12} cy={7.2} r={2.7} />,
  },
  /** Hugo, qualification — the property under the lens: he identifies it. */
  hugo: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob d="M11 3.4c.5-.4 1.3-.4 1.8 0l6.3 5.2c.4.3.6.7.6 1.2v1.3a6 6 0 0 0-8.6 7.9H5.6a1.8 1.8 0 0 1-1.8-1.8V9.8c0-.5.2-.9.6-1.2z" />
    ),
    accent: (
      <g data-m="lens">
        <circle cx={16.4} cy={16} r={3.3} fill="none" stroke="currentColor" strokeWidth={STROKE.bold} />
        <Line d="M18.8 18.4 21.2 20.8" width={STROKE.bold} />
      </g>
    ),
  },
  /** Emma, relation — a message, and the follow-up that comes back around. */
  emma: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob d="M6.4 3.2h7.4a4.4 4.4 0 0 1 4.4 4.4v1.2a4.4 4.4 0 0 1-4.4 4.4H9.4l-3.7 3c-.5.4-1.2 0-1.2-.6v-2.8A4.4 4.4 0 0 1 2 8.8V7.6a4.4 4.4 0 0 1 4.4-4.4z" />
    ),
    accent: (
      <g data-m="loop">
        <Line d="M21.2 16.8a4 4 0 1 1-1.3-3.4" width={STROKE.line} />
        <Line d="M20.4 11.3v2.4H18" width={STROKE.line} />
      </g>
    ),
  },
  /** Louis, appointment — the calendar card, and the slot he proposes (clock badge). */
  louis: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <rect x={2.8} y={4.4} width={15.6} height={3.2} rx={1.6} fill="currentColor" />
        <Blob d="M2.8 10.8a1.4 1.4 0 0 1 1.4-1.4h12.8a1.4 1.4 0 0 1 1.4 1.4v.4a6.2 6.2 0 0 0-5.3 8.7H5.4a2.6 2.6 0 0 1-2.6-2.6z" />
      </>
    ),
    accent: (
      <>
        <Dot cx={18.3} cy={17.4} r={4.4} m="disc" />
        <OnAccent d="M18.3 15.3v2.3l1.5 1" m="hand" />
      </>
    ),
  },
  /** Sarah, follow-up — the dossier, sent forward until the mandate. */
  sarah: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob d="M2.8 6.6a2.2 2.2 0 0 1 2.2-2.2h3.4c.6 0 1.1.2 1.5.6l1.3 1.4h4.4a2.2 2.2 0 0 1 2.2 2.2v2.2h-3.4a3.2 3.2 0 0 0 0 6.4h3.4v.8a2.2 2.2 0 0 1-2.2 2.2H5a2.2 2.2 0 0 1-2.2-2.2z" />
    ),
    accent: (
      <g data-m="arrow">
        <Line d="M13.6 13.8h7.4" width={STROKE.bold} />
        <Line d="M18.4 11.2 21 13.8l-2.6 2.6" width={STROKE.bold} />
      </g>
    ),
  },

  // --- Other stages of a dossier ------------------------------------------------
  /** Prospect — the seller, and their home. */
  prospect: {
    tone: "accent",
    animated: true,
    ink: <Person />,
    accent: (
      <Blob d="M15.4 8.4 18.2 5.8a.8.8 0 0 1 1.1 0l2.8 2.6c.2.2.3.4.3.7v2.3c0 .5-.4.9-.9.9h-4.6a.9.9 0 0 1-.9-.9V9.1c0-.3.1-.5.3-.7z" />
    ),
  },
  /** Appointment — the place of the estimation visit; the pin lands. */
  appointment: {
    tone: "accent",
    animated: true,
    ink: (
      <Blob
        evenOdd
        d="M12 21.6c-.4 0-.8-.2-1.1-.5C8 18.1 5 14.5 5 10.2a7 7 0 0 1 14 0c0 4.3-3 7.9-5.9 10.9-.3.3-.7.5-1.1.5zM8.6 10.1a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0z"
      />
    ),
    accent: <Dot cx={12} cy={10.1} r={1.9} />,
  },
  /** Mandate — the document, and the signature traced by a person. */
  mandate: {
    tone: "accent",
    animated: true,
    ink: (
      <>
        <Blob d="M5.6 2.6h6.2v4.2a2.4 2.4 0 0 0 2.4 2.4h3.6v4.4a5 5 0 0 0-5.2 3.9l-.4 2.1H5.6a2 2 0 0 1-2-2V4.6a2 2 0 0 1 2-2z" />
        <Blob d="M13.4 2.9 17.5 7a.3.3 0 0 1-.2.6h-3.1a1 1 0 0 1-1-1V3.1a.2.2 0 0 1 .2-.2z" />
      </>
    ),
    accent: (
      <Line
        d="M12.6 19.4c1-2 2.2-2.6 2.6-1.4.3 1 .9 1.3 1.6.2.6-.9 1.3-.9 1.8-.1.4.6 1 .7 2.2.3"
        width={STROKE.line}
        m="signature"
      />
    ),
  },
} as const satisfies Record<string, IconDefinition>;
