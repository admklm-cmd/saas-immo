"use client";

import { createContext, useContext } from "react";

/**
 * `true` once `ChartStage` lets the chart start its own animation (or at once
 * under reduced motion). Outside a stage the chart simply shows: `true`.
 */
const ChartReadyContext = createContext(true);

export const ChartReadyProvider = ChartReadyContext.Provider;

export function useChartReady(): boolean {
  return useContext(ChartReadyContext);
}
