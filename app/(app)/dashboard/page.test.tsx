// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { makePilotage } from "@/features/dashboard/components/pilotage/pilotage-fixture";
import { makeSummary } from "@/features/dashboard/components/summary-fixture";

/**
 * The `/dashboard` screen: a statistics page built from `getDashboardSummary()` (the reminder)
 * and `getDashboardPilotage()` called for the four periods. Only an invalid session or agency
 * replaces the screen with an error.
 */

vi.mock("@/features/dashboard/queries", () => ({
  getDashboardSummary: vi.fn(),
  getDashboardPilotage: vi.fn(),
}));
// The islands have their own tests.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/charts/ChartStage", () => ({ ChartStage: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const { getDashboardSummary, getDashboardPilotage } = await import("@/features/dashboard/queries");
const DashboardPage = (await import("./page")).default;

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubBrowser() {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", undefined);
}

describe("Écran Tableau de bord", () => {
  it("lit les quatre périodes, rend la période de l'URL et aucune liste de l'ancien tableau de bord", async () => {
    stubBrowser();
    vi.mocked(getDashboardSummary).mockResolvedValue({ data: makeSummary(), error: null });
    vi.mocked(getDashboardPilotage).mockImplementation(async (key) => ({ data: makePilotage(key), error: null }));

    render(await DashboardPage({ searchParams: Promise.resolve({ periode: "30j" }) }));

    expect(vi.mocked(getDashboardPilotage).mock.calls.map(([key]) => key).sort()).toEqual(["30d", "365d", "7d", "90d"]);
    expect(screen.getByRole("heading", { level: 1, name: TEXTS.title })).toBeDefined();
    expect(screen.getByTestId("pilotage").getAttribute("data-period")).toBe("30d");
    expect(screen.getByTestId("period-30d").getAttribute("aria-checked")).toBe("true");
    for (const old of ["dashboard-todo", "dashboard-pipeline", "dashboard-upcoming", "dashboard-activity"]) {
      expect(screen.queryByTestId(old)).toBeNull();
    }
    expect(screen.getByTestId("dashboard-primary-action").getAttribute("href")).toBe("/agents-ia/a-valider");
  });

  it("retombe sur « 1 an » pour une valeur inconnue", async () => {
    stubBrowser();
    vi.mocked(getDashboardSummary).mockResolvedValue({ data: makeSummary(), error: null });
    vi.mocked(getDashboardPilotage).mockImplementation(async (key) => ({ data: makePilotage(key), error: null }));
    render(await DashboardPage({ searchParams: Promise.resolve({ periode: "zzz" }) }));
    expect(screen.getByTestId("pilotage").getAttribute("data-period")).toBe("365d");
  });

  it("une période en échec affiche « Indisponible » sans masquer les autres", async () => {
    stubBrowser();
    vi.mocked(getDashboardSummary).mockResolvedValue({ data: makeSummary(), error: null });
    vi.mocked(getDashboardPilotage).mockImplementation(async (key) =>
      key === "365d" ? { data: null, error: { code: "x", message: "x" } } : { data: makePilotage(key), error: null },
    );
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("stage-unavailable").textContent).toContain(TEXTS.pilotage.unavailable);
  });

  it("affiche une erreur utile avec une action quand la session ou l'agence est invalide", async () => {
    const message = "Votre session a expiré. Reconnectez-vous.";
    vi.mocked(getDashboardPilotage).mockResolvedValue({ data: null, error: { code: "x", message: "x" } });
    vi.mocked(getDashboardSummary).mockResolvedValue({ data: null, error: { code: "unauthenticated", message } });

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    const alert = screen.getByTestId("dashboard-error");
    expect(alert.textContent).toContain(TEXTS.errorTitle);
    expect(alert.textContent).toContain(message);
    expect(screen.getByRole("link", { name: APP_TEXTS.states.retry }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByTestId("pilotage")).toBeNull();
  });
});
