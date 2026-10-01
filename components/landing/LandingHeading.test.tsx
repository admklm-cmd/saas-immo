import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { LandingFinal } from "./LandingFinal";
import { LandingHeading } from "./LandingHeading";

const FINAL = LANDING_TEXTS.final;

describe("LandingHeading veil", () => {
  it("keeps the readability veil by default (sections on the living background)", () => {
    const html = renderToStaticMarkup(
      <LandingHeading id="t" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} />,
    );
    expect(html).toContain("particle-veil");
  });

  it("drops the veil on request", () => {
    const html = renderToStaticMarkup(
      <LandingHeading id="t" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} veil={false} />,
    );
    expect(html).not.toContain("particle-veil");
  });

  it("has no veil inside the opaque final panel, which keeps its prototype note", () => {
    const html = renderToStaticMarkup(<LandingFinal />);
    expect(html).not.toContain("particle-veil");
    expect(html).toContain(FINAL.note);
  });
});
