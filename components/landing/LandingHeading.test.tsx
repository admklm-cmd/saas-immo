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

  it("passes tone and alignment to the title, unchanged by default", () => {
    const plain = document.createElement("div");
    plain.innerHTML = renderToStaticMarkup(<LandingHeading id="t" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} />);
    expect(plain.querySelector("h2")!.hasAttribute("data-title-color")).toBe(false);
    expect(plain.querySelector("h2")!.hasAttribute("data-title-align")).toBe(false);
    expect(plain.firstElementChild!.className).not.toContain("text-center");

    const centred = document.createElement("div");
    centred.innerHTML = renderToStaticMarkup(
      <LandingHeading id="t" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} veil={false} tone="inverse" align="center" />,
    );
    const title = centred.querySelector("h2")!;
    expect(title.getAttribute("data-title-color")).toBe("inverse");
    expect(title.getAttribute("data-title-align")).toBe("center");
    expect(centred.firstElementChild!.className).toContain("mx-auto");
    expect(centred.firstElementChild!.className).toContain("text-center");
  });

  it("centres the overline block in the centred mode only (§2.11.8.7 L3-C)", () => {
    const start = document.createElement("div");
    start.innerHTML = renderToStaticMarkup(<LandingHeading id="t" kicker="Le contrôle" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} />);
    const startOverline = start.querySelector("[data-testid='overline']")!.parentElement!;
    expect(startOverline.className).toContain("w-fit");
    expect(startOverline.className).not.toContain("mx-auto");

    const centred = document.createElement("div");
    centred.innerHTML = renderToStaticMarkup(
      <LandingHeading id="t" kicker="Le contrôle" titleLines={FINAL.titleLines} titleAccent={FINAL.titleAccent} align="center" />,
    );
    const overline = centred.querySelector("[data-testid='overline']")!.parentElement!;
    expect(overline.className).toContain("w-fit");
    expect(overline.className).toContain("mx-auto");
  });

  it("has no veil inside the opaque final panel, which keeps its prototype note", () => {
    const html = renderToStaticMarkup(<LandingFinal />);
    expect(html).not.toContain("particle-veil");
    expect(html).toContain(FINAL.note);
  });
});
