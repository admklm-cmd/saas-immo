// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("is a non-submitting button by default", () => {
    render(<Button>Lancer Hugo</Button>);
    const button = screen.getByRole("button", { name: "Lancer Hugo" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("announces and blocks the busy state while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Exécution en cours…
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(true);

    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the secondary variant visually distinct from the primary one", () => {
    const { container: primary } = render(<Button variant="primary">A</Button>);
    const { container: secondary } = render(<Button variant="secondary">B</Button>);

    expect(primary.firstElementChild?.className).toContain("bg-inverse");
    expect(secondary.firstElementChild?.className).toContain("border-line-strong");
  });
});
