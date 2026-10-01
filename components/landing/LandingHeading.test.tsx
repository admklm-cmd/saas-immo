// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { LandingFinal } from "./LandingFinal";
import { LandingHeading } from "./LandingHeading";

const FINAL = LANDING_TEXTS.final;

describe("LandingHeading veil", () => {
  it("keeps a readability veil by default (sections on the network background)", () => {
    const html = renderToStaticMarkup(
      <LandingHeading id="t" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} />,
    );
    expect(html).toContain("network-veil-title");
  });

  it("splits the veils by role: 90 % for the overline and the paragraph, 70 % for the title, each a quiet zone", () => {
    const html = renderToStaticMarkup(
      <LandingHeading id="t" kicker="Le contrôle" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} body="Corps." />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const title = container.querySelector("h2")!.parentElement!;
    expect(title.className).toContain("network-veil-title");
    expect(title.className).not.toContain("particle-veil");
    expect(title.hasAttribute("data-network-quiet")).toBe(true);
    const overline = container.querySelector("[data-testid='overline']")!.parentElement!;
    expect(overline.className).toContain("particle-veil");
    expect(container.firstElementChild!.lastElementChild!.className).toContain("particle-veil");
    expect(container.querySelectorAll("[data-network-quiet]")).toHaveLength(3);
  });

  it("drops the veil on request", () => {
    const html = renderToStaticMarkup(
      <LandingHeading id="t" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} veil={false} />,
    );
    expect(html).not.toContain("particle-veil");
    expect(html).not.toContain("network-veil-title");
    expect(html).not.toContain("data-network-quiet");
  });

  it("has no veil inside the opaque final panel, which keeps its prototype note", () => {
    const html = renderToStaticMarkup(<LandingFinal />);
    expect(html).not.toContain("particle-veil");
    expect(html).toContain(FINAL.note);
  });
});
