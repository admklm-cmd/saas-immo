// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { makeSummary } from "@/features/dashboard/components/summary-fixture";

/**
 * The `/dashboard` screen, assembled from `getDashboardSummary()`.
 *
 * Only an invalid session or agency replaces the screen with an error; in every
 * other case the four blocks are rendered, « À faire maintenant » first.
 */

vi.mock("@/features/dashboard/queries", () => ({
  getDashboardSummary: vi.fn(),
}));

const { getDashboardSummary } = await import("@/features/dashboard/queries");
const DashboardPage = (await import("./page")).default;

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => cleanup());

describe("Écran Tableau de bord", () => {
  it("affiche les quatre blocs, « À faire maintenant » en premier", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({ data: makeSummary(), error: null });

    render(await DashboardPage());

    expect(screen.getByRole("heading", { level: 1, name: TEXTS.title })).toBeDefined();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings[0]).toBe(TEXTS.todoTitle);
    expect(headings).toEqual(
      expect.arrayContaining([TEXTS.pipelineTitle, TEXTS.agentsTitle, TEXTS.upcomingTitle]),
    );
    expect(screen.queryByText(TEXTS.unavailable)).toBeNull();
  });

  it("affiche une erreur utile avec une action quand la session ou l'agence est invalide", async () => {
    const message = "Votre session a expiré. Reconnectez-vous.";
    vi.mocked(getDashboardSummary).mockResolvedValue({
      data: null,
      error: { code: "unauthenticated", message },
    });

    render(await DashboardPage());

    const alert = screen.getByTestId("dashboard-error");
    expect(alert.textContent).toContain(TEXTS.errorTitle);
    expect(alert.textContent).toContain(message);
    expect(screen.getByRole("link", { name: APP_TEXTS.states.retry }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByTestId("dashboard-todo")).toBeNull();
  });
});
