// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { BRAND } from "@/components/brand";

import { Logo } from "./Logo";
import { LogoSymbol } from "./LogoSymbol";

afterEach(cleanup);

it("exposes the product name once, as the accessible name of the lock-up", () => {
  render(<Logo />);

  const marks = screen.getAllByRole("img", { name: BRAND.name });
  expect(marks).toHaveLength(1);
});

it("sets the word mark as live text, on the two lines of the brand", () => {
  render(<Logo />);

  for (const line of BRAND.wordmark) {
    expect(screen.getByText(line)).toBeTruthy();
  }
});

it("keeps the symbol decorative inside the lock-up", () => {
  const { container } = render(<Logo />);

  const symbol = container.querySelector(".brand-symbol");
  expect(symbol?.getAttribute("aria-hidden")).toBe("true");
  expect(symbol?.getAttribute("aria-label")).toBeNull();
});

it("names the symbol when it stands alone — a logo is never decorative", () => {
  render(<LogoSymbol />);

  expect(screen.getByRole("img", { name: BRAND.name })).toBeTruthy();
});

it("lets the symbol be silenced when the name is already written next to it", () => {
  const { container } = render(<LogoSymbol label={null} />);

  expect(screen.queryByRole("img")).toBeNull();
  expect(container.querySelector(".brand-symbol")?.getAttribute("aria-hidden")).toBe("true");
});

it("keeps the artwork proportions instead of hard-coding a ratio", () => {
  const { container } = render(<LogoSymbol />);

  const symbol = container.querySelector<HTMLElement>(".brand-symbol");
  expect(symbol?.style.aspectRatio).toBe(`${BRAND.symbol.width} / ${BRAND.symbol.height}`);
});

it("inherits its colour instead of shipping a black and a white component", () => {
  const { container } = render(<LogoSymbol className="text-ink-inverse" />);

  // Inversion is handled by `currentColor` through the CSS mask: the component
  // carries no tone prop and no second asset path.
  const symbol = container.querySelector(".brand-symbol");
  expect(symbol?.className).toContain("text-ink-inverse");
  expect(container.querySelector("img")).toBeNull();
});
