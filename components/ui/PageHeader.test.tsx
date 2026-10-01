// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

afterEach(() => {
  cleanup();
});

describe("PageHeader", () => {
  it("shows the overline above the title, outside the heading's accessible name", () => {
    render(<PageHeader overline="Pilotage" title="Tableau de bord" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Tableau de bord" });
    const overline = screen.getByTestId("overline");
    expect(overline.textContent).toBe("Pilotage");
    expect(heading.contains(overline)).toBe(false);
    // Before the title in the document order.
    expect(overline.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The veil sits on a wrapper: the overline keeps its own ::before for the dash.
    expect(overline.parentElement?.className).toContain("particle-veil");
    expect(overline.className).not.toContain("particle-veil");
  });

  it("sets the h1 in Bricolage 600 on the page scale (32 / 42 / 48 px)", () => {
    render(<PageHeader title="Contacts vendeurs" />);
    const heading = screen.getByRole("heading", { level: 1 });
    for (const name of ["font-display", "font-semibold", "text-title", "sm:text-hero", "lg:text-page"]) {
      expect(heading.className).toContain(name);
    }
    expect(heading.className).not.toMatch(/font-(bold|extrabold)/);
  });

  it("renders no overline when none is given (breadcrumb screens)", () => {
    render(<PageHeader eyebrow={<span>Contacts</span>} title="Claire Martin" />);
    expect(screen.queryByTestId("overline")).toBeNull();
  });
});
