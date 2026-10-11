import { describe, expect, it } from "vitest";

import { countAccent, findAccent, isAnimatable, splitAccent, splitTextAccent, tokensOf } from "./editorial-title";

describe("splitAccent", () => {
  it("finds a whole word and keeps the punctuation outside", () => {
    expect(splitAccent("main.", "main")).toEqual(["", "main", "."]);
    expect(splitAccent("chemin,", "chemin")).toEqual(["", "chemin", ","]);
  });

  it("keeps an elided article outside the accent", () => {
    expect(splitAccent("l'administratif.", "administratif")).toEqual(["l'", "administratif", "."]);
    expect(splitAccent("s'arrête.", "s'arrête")).toEqual(["", "s'arrête", "."]);
  });

  it("never matches inside a longer word", () => {
    expect(splitAccent("maintenant", "main")).toBeNull();
    expect(splitAccent("demain", "main")).toBeNull();
    expect(splitAccent("traités", "traité")).toBeNull();
  });

  it("returns null for an empty accent", () => {
    expect(splitAccent("main", "")).toBeNull();
  });
});

describe("countAccent / findAccent", () => {
  const lines = ["Chaque demande", "vendeur avance.", "Votre agence", "garde la main."];

  it("counts whole-word occurrences across the lines", () => {
    expect(countAccent(lines, "main")).toBe(1);
    expect(countAccent(lines, "maintenant")).toBe(0);
    expect(countAccent(["la main, la main."], "main")).toBe(2);
  });

  it("locates the unique accent, and refuses an absent or repeated one", () => {
    expect(findAccent(lines, "main")).toEqual({ line: 3, token: 2 });
    expect(findAccent(lines, "absent")).toBeNull();
    expect(findAccent(["la main, la main."], "main")).toBeNull();
    expect(findAccent(lines, undefined)).toBeNull();
  });
});

describe("tokensOf / isAnimatable", () => {
  it("splits on spaces and ignores doubled spaces", () => {
    expect(tokensOf("Votre  équipe décide.")).toEqual(["Votre", "équipe", "décide."]);
  });

  it("animates one to four author lines only", () => {
    expect(isAnimatable([])).toBe(false);
    expect(isAnimatable(["a"])).toBe(true);
    expect(isAnimatable(["a", "b", "c", "d"])).toBe(true);
    expect(isAnimatable(["a", "b", "c", "d", "e"])).toBe(false);
  });
});

describe("splitTextAccent", () => {
  it("splits a one-line title so that the parts give back the exact text", () => {
    const title = "Aucun contact pour l’instant";
    const parts = splitTextAccent(title, "contact");
    expect(parts).toEqual(["Aucun ", "contact", " pour l’instant"]);
    expect(parts?.join("")).toBe(title);
    expect(splitTextAccent("Aucun dossier à relancer", "relancer")).toEqual(["Aucun dossier à ", "relancer", ""]);
  });

  it("returns null when the word is absent, partial or repeated", () => {
    expect(splitTextAccent("Aucune tâche ouverte", "ouvert")).toBeNull();
    expect(splitTextAccent("Aucune tâche ouverte", undefined)).toBeNull();
    expect(splitTextAccent("venir, venir", "venir")).toBeNull();
  });
});
