import { LANDING_TEXTS } from "@/components/landing-texts";

import type { RoiTagName } from "./roi-model";
import styles from "./roi.module.css";

const TAGS = LANDING_TEXTS.roi.tags;

/**
 * Provenance tag of a ROI figure (docs/design-system.md §2.11.8.8 L4-B),
 * distinct without colour: « Source » solid border, « Hypothèse » dashed
 * border, « Potentiel estimé » sunken fill, « Étude américaine » light
 * border. Server-safe.
 */
export function RoiTag({ tag }: { tag: RoiTagName }) {
  return (
    <span className={styles.tag} data-roi-tag={tag}>
      {TAGS[tag]}
    </span>
  );
}

/** The tags of a value: its kind, then « Étude américaine » when the study is American. */
export function RoiTags({ kind, us = false }: { kind: RoiTagName; us?: boolean }) {
  return (
    <span className={styles.tags}>
      <RoiTag tag={kind} />
      {us ? <RoiTag tag="us" /> : null}
    </span>
  );
}
