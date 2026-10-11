"use client";

import { useCallback, useRef } from "react";

/**
 * Runs an async task at most once at a time.
 *
 * The busy state rendered by React disables the button, but only after a
 * render: this ref blocks a second click (or a second submit) that would land
 * before it. Returns `undefined` when the call was ignored.
 */
export function useSingleFlight() {
  const inFlight = useRef(false);

  return useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    try {
      return await task();
    } finally {
      inFlight.current = false;
    }
  }, []);
}
