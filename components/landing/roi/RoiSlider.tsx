"use client";

import { useId, type CSSProperties } from "react";

import { cn } from "@/components/ui/cn";

import type { RoiKind, SliderSpec } from "./roi-model";
import { RoiTags } from "./RoiTag";
import styles from "./roi.module.css";

/**
 * A ROI setting (docs/design-system.md §2.11.8.8 L4-B): a native range input
 * (keyboard: arrows = one step, Home / End = bounds), its visible label, the
 * provenance tag, the value in an `output`, `aria-valuetext` with the unit.
 * 44 px hit area, 4 px track filled in ink up to the value (`--fill`), 20 px
 * round thumb, cobalt focus ring. Disabled in the server HTML (nothing would
 * react without JavaScript). The value lives in the widget's local state:
 * never stored, never sent.
 */
export function RoiSlider({
  label,
  spec,
  value,
  display,
  valueText,
  kind,
  us,
  benchmark,
  disabled,
  onChange,
}: {
  label: string;
  spec: SliderSpec;
  value: number;
  /** Visible value (« 4 », « 15 % »). */
  display: string;
  /** Spoken value (« 4 négociateurs »). */
  valueText: string;
  kind: RoiKind;
  us?: boolean;
  /** A published landmark under the slider (« étude : 4 à 6 h »). */
  benchmark?: { text: string; kind: RoiKind; us?: boolean };
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const fill = ((value - spec.min) / (spec.max - spec.min)) * 100;
  const isDefault = value === spec.defaultValue;
  return (
    <div className={styles.slider} data-roi-slider="">
      <div className={styles.sliderHead}>
        <label htmlFor={id} className={styles.sliderLabel}>
          {label}
        </label>
        <RoiTags kind={kind} us={us} />
        <output htmlFor={id} className={cn(styles.sliderValue, kind === "hypothesis" && isDefault && styles.hypothesisValue)}>
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-valuetext={valueText}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
      {benchmark ? (
        <p className={styles.benchmark}>
          <span>{benchmark.text}</span>
          <RoiTags kind={benchmark.kind} us={benchmark.us} />
        </p>
      ) : null}
    </div>
  );
}
