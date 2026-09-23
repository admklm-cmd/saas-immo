// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatedErrorState } from "./AnimatedErrorState";
import { Button } from "./Button";
import { isRetryableErrorCode } from "./retryable";
import { useSingleFlight } from "./use-single-flight";

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

type ActionResult = { error: { code: string; message: string } | null };
type HarnessState = { kind: "idle" | "loading" | "done" } | { kind: "error"; message: string; retryable: boolean };

/** The same wiring as the real panels: single flight, real busy state, retry only when retryable. */
function Harness({ action }: { action: () => Promise<ActionResult> }) {
  const singleFlight = useSingleFlight();
  const [state, setState] = useState<HarnessState>({ kind: "idle" });

  function run() {
    return singleFlight(async () => {
      setState({ kind: "loading" });
      try {
        const { error } = await action();
        setState(
          error
            ? { kind: "error", message: error.message, retryable: isRetryableErrorCode(error.code) }
            : { kind: "done" },
        );
      } catch {
        setState({ kind: "error", message: "Erreur technique.", retryable: true });
      }
    });
  }

  return (
    <div>
      <Button isLoading={state.kind === "loading"} onClick={() => void run()}>
        {state.kind === "loading" ? "Simulation en cours…" : "Lancer Hugo"}
      </Button>
      {state.kind === "error" ? (
        <AnimatedErrorState title="L'agent n'a pas pu s'exécuter" onRetry={state.retryable ? () => void run() : undefined}>
          {state.message}
        </AnimatedErrorState>
      ) : null}
      {state.kind === "done" ? <p>Terminé</p> : null}
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("Button — real asynchronous states", () => {
  it("shows the three-dot loader while loading, then stops it at once on success", async () => {
    const pending = deferred<ActionResult>();
    render(<Harness action={() => pending.promise} />);

    fireEvent.click(screen.getByRole("button", { name: "Lancer Hugo" }));
    const busy = screen.getByRole("button", { name: "Simulation en cours…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("three-dot-loader")).toBeTruthy();

    await act(async () => pending.resolve({ error: null }));
    expect(screen.getByText("Terminé")).toBeTruthy();
    expect(screen.queryByTestId("three-dot-loader")).toBeNull();
    expect(screen.getByRole("button", { name: "Lancer Hugo" }).hasAttribute("aria-busy")).toBe(false);
  });

  it("loading → technical error → « Réessayer » → a new attempt that succeeds", async () => {
    const action = vi
      .fn<() => Promise<ActionResult>>()
      .mockResolvedValueOnce({ error: { code: "ai_provider_unavailable", message: "Fournisseur indisponible." } })
      .mockResolvedValueOnce({ error: null });
    render(<Harness action={action} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lancer Hugo" })));
    expect(screen.getByRole("alert").textContent).toContain("Fournisseur indisponible.");
    expect(screen.queryByTestId("three-dot-loader")).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Réessayer" })));
    expect(action).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Terminé")).toBeTruthy();
  });

  it("offers no « Réessayer » after a guard-rail refusal", async () => {
    const action = vi.fn(async () => ({ error: { code: "ai_paused", message: "Agents suspendus." } }));
    render(<Harness action={action} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lancer Hugo" })));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });

  it("sends a single request on a double click", async () => {
    const pending = deferred<ActionResult>();
    const action = vi.fn(() => pending.promise);
    render(<Harness action={action} />);

    const button = screen.getByRole("button", { name: "Lancer Hugo" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ error: null }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not animate when disabled, and only moves with motion allowed", () => {
    render(<Button disabled>Envoyer</Button>);
    const button = screen.getByRole("button", { name: "Envoyer" });
    expect(button.hasAttribute("disabled")).toBe(true);
    // No hover, no press: pointer events are off for a disabled button.
    expect(button.className).toContain("disabled:pointer-events-none");
    // Every movement is gated by prefers-reduced-motion: no-preference.
    const moves = button.className.split(/\s+/).filter((name) => /translate|scale/.test(name) && !name.startsWith("transition-"));
    expect(moves.length).toBeGreaterThan(0);
    for (const name of moves) expect(name.startsWith("motion-safe:")).toBe(true);
    expect(button.className).toContain("motion-safe:active:scale-[0.97]");
  });
});
