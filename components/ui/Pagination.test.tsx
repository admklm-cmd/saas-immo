// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { Pagination } from "./Pagination";

const TEXTS = APP_TEXTS.pagination;
const hrefFor = (offset: number) => (offset > 0 ? `/taches?offset=${offset}` : "/taches");

afterEach(() => cleanup());

describe("Pagination", () => {
  it("affiche « 26–50 sur 131 » et les deux directions sur une page du milieu", () => {
    render(<Pagination offset={25} limit={25} count={25} total={131} hasMore hrefFor={hrefFor} />);

    expect(screen.getByRole("navigation", { name: TEXTS.label }).textContent).toContain(TEXTS.range(26, 50, 131));
    expect(screen.getByText("26–50 sur 131")).toBeDefined();
    expect(screen.getByRole("link", { name: new RegExp(TEXTS.previous) }).getAttribute("href")).toBe("/taches");
    expect(screen.getByRole("link", { name: new RegExp(TEXTS.next) }).getAttribute("href")).toBe("/taches?offset=50");
  });

  it("dessine ses flèches avec les icônes de la famille, décoratives, sans caractère tapé", () => {
    render(<Pagination offset={25} limit={25} count={25} total={131} hasMore hrefFor={hrefFor} />);

    const previous = screen.getByRole("link", { name: TEXTS.previous });
    const next = screen.getByRole("link", { name: TEXTS.next });
    expect(`${previous.textContent}${next.textContent}`).not.toMatch(/[←→]/);
    expect(within(previous).getByTestId("button-arrow").getAttribute("aria-hidden")).toBe("true");
    expect(previous.querySelector('svg[data-icon="arrowLeft"]')).not.toBeNull();
    expect(next.querySelector('svg[data-icon="arrowRight"]')).not.toBeNull();
  });

  it("n'offre aucun lien « Précédent » sur la première page ni « Suivant » sur la dernière", () => {
    render(<Pagination offset={0} limit={25} count={6} total={6} hasMore={false} hrefFor={hrefFor} />);

    expect(screen.getByText(TEXTS.range(1, 6, 6))).toBeDefined();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(TEXTS.previous)).toBeNull();
    expect(screen.queryByText(TEXTS.next)).toBeNull();
  });

  it("affiche « 0–0 sur N » sur une page au-delà de la fin, sans inventer d'éléments", () => {
    render(<Pagination offset={50} limit={25} count={0} total={12} hasMore={false} hrefFor={hrefFor} />);

    expect(screen.getByText(TEXTS.range(0, 0, 12))).toBeDefined();
    expect(screen.getByRole("link", { name: new RegExp(TEXTS.previous) }).getAttribute("href")).toBe(
      "/taches?offset=25",
    );
  });
});
