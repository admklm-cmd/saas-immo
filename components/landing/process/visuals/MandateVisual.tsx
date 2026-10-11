import type { CSSProperties } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";
import { PIPELINE_STAGES } from "@/features/pipeline/types";

import { CursorYou } from "../../ecosystem/CursorYou";
import styles from "./decisions.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.mandate;
/** The real stages of the pipeline, « Perdu » aside. */
const STAGES = PIPELINE_STAGES.filter((stage) => stage !== "perdu");
const LAST = STAGES.length - 1;

/**
 * Card 7 — the mandate: a point climbs the real stages of the pipeline and
 * STOPS at « Estimation faite »; « Mandat signé » waits, dashed, « À
 * confirmer »; the « Vous » cursor clicks « Confirmer » and the node becomes a
 * filled disc with a double contour. Never declared by an agent.
 */
export function MandateVisual() {
  return (
    <div className={frame.stage}>
      <ol className={styles.stages} style={{ "--last": LAST } as CSSProperties}>
        {STAGES.map((stage, index) => (
          <li key={stage} className={styles.stageRow} style={{ "--stage-index": index } as CSSProperties}>
            {index === LAST ? (
              <>
                <span className={styles.nodeLast}>
                  <span className={styles.nodeDashed} />
                  <span className={styles.nodeSealed} />
                </span>
                <span className={styles.stageName}>{PIPELINE_STAGE_LABELS[stage]}</span>
                <span className={styles.stagePending}>{TEXTS.pending}</span>
                <span className={styles.confirmTarget}>
                  <span className={styles.confirm}>
                    <Icon name="check" px={12} />
                    {TEXTS.confirm}
                  </span>
                  <CursorYou label={TEXTS.cursor} className={styles.cursorLate} style={{ left: "60%", top: "66%" }} />
                </span>
              </>
            ) : (
              <>
                <span className={styles.node} />
                <span className={styles.stageName}>{PIPELINE_STAGE_LABELS[stage]}</span>
              </>
            )}
          </li>
        ))}
        <li className={styles.point} aria-hidden="true" />
      </ol>
    </div>
  );
}
