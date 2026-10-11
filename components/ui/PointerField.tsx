"use client";

import { useEffect } from "react";

import { watchPointerField } from "./pointer-field";

/**
 * Mounts the single, delegated pointer listener of the page (see
 * `pointer-field.ts`). Render it ONCE per layout; it renders nothing and never
 * re-renders on pointer moves. Its effect is purely decorative: every control
 * works identically without it (no JavaScript, touch screen, reduced motion).
 */
export function PointerField() {
  useEffect(() => watchPointerField(window), []);
  return null;
}
