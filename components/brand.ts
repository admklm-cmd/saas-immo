/**
 * Single source of truth for the brand.
 *
 * Nothing else in the codebase may spell the product name out: screens,
 * metadata, tests and documentation all read it from here. Renaming the
 * product is therefore a one-file change (this one), and a stale name cannot
 * survive in a corner of the interface.
 *
 * Deliberately NOT in `components/texts.ts`: the brand is not French interface
 * copy, it is a proper noun reused by `metadata`, by the logo components and
 * by the E2E suite. `APP_TEXTS.brand` simply re-exports this object, so the
 * existing call sites keep working.
 */

/**
 * The brand symbol — a mark, never an illustration.
 *
 * `src` / `srcInverse` are flat-colour PNGs carrying the alpha of the master
 * artwork (black for light surfaces, white for dark ones). The interface
 * itself paints the mark with `currentColor` through `src` used as a CSS mask
 * (see the `.brand-symbol` utility in `app/globals.css`), so a single file
 * covers both backgrounds; `srcInverse` exists for the contexts that cannot
 * mask — exports, slide decks, emails.
 *
 * The day a vector master is delivered, only `src`, `srcInverse` and the URL
 * of `.brand-symbol` change. No screen and no component is touched.
 */
const SYMBOL = {
  src: "/brand/ascend-symbol-black.png",
  srcInverse: "/brand/ascend-symbol-white.png",
  /** Intrinsic size of the artwork, trimmed to the glyph's bounding box. */
  width: 992,
  height: 770,
} as const;

export const BRAND = {
  /** Full product name. Page titles, accessible name of the logo, documents. */
  name: "Ascend Strategy",
  /** Short form, for the spots where the full lock-up does not fit. */
  shortName: "Ascend",
  /**
   * The word mark, already split into the two typographic lines set next to
   * the symbol. `Logo` never re-splits the name by hand.
   */
  wordmark: ["Ascend", "Strategy"],
  /** One-line signature. Never a promise, never a figure. */
  tagline: "CRM et agents IA pour agences immobilières indépendantes",
  /** Prototype marker shown next to the logo (CLAUDE.md: nothing is live). */
  prototype: "Prototype",
  symbol: SYMBOL,
} as const;
