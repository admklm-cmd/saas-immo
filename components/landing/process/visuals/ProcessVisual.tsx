import type { ComponentType } from "react";

import type { ProcessStep, ProcessStepKey } from "../process-carousel";
import { EmmaVisual } from "./EmmaVisual";
import { HugoVisual } from "./HugoVisual";
import { LeaVisual } from "./LeaVisual";
import { LouisVisual } from "./LouisVisual";
import { MandateVisual } from "./MandateVisual";
import { ReviewVisual } from "./ReviewVisual";
import { SarahVisual } from "./SarahVisual";
import timings from "./frame.module.css";
import { VisualFrame, type VisualState } from "./VisualFrame";

const DRAWINGS: Readonly<Record<ProcessStepKey, { Drawing: ComponentType; timing: string | undefined }>> = {
  lea: { Drawing: LeaVisual, timing: timings.timingLea },
  hugo: { Drawing: HugoVisual, timing: timings.timingHugo },
  emma: { Drawing: EmmaVisual, timing: timings.timingEmma },
  review: { Drawing: ReviewVisual, timing: timings.timingReview },
  louis: { Drawing: LouisVisual, timing: timings.timingLouis },
  sarah: { Drawing: SarahVisual, timing: timings.timingSarah },
  mandate: { Drawing: MandateVisual, timing: timings.timingMandate },
};

/** The animated window of the step `step` (one drawing per step, §2.11.8.5). */
export function ProcessVisual({ step, state, paused }: { step: ProcessStep; state: VisualState; paused: boolean }) {
  const { Drawing, timing } = DRAWINGS[step.key];
  return (
    <VisualFrame step={step} state={state} paused={paused} className={timing}>
      <Drawing />
    </VisualFrame>
  );
}
