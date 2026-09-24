/**
 * Page-level pause of the landing animations (WCAG 2.2.2 « Pause, Stop,
 * Hide »): one switch stops the hero demonstration, the living background and
 * the CSS loops of the page. Stored on `<html data-landing-motion>` so plain
 * CSS can pause its own animations too. Browser only.
 */

const EVENT = "landing-motion";
const ATTRIBUTE = "landingMotion";

export function isLandingPaused(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset[ATTRIBUTE] === "paused";
}

export function setLandingPaused(paused: boolean) {
  if (paused) document.documentElement.dataset[ATTRIBUTE] = "paused";
  else delete document.documentElement.dataset[ATTRIBUTE];
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Calls `listener` with the new value on every change; returns the unsubscribe. */
export function onLandingMotion(listener: (paused: boolean) => void): () => void {
  const handler = () => listener(isLandingPaused());
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
