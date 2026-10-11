// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import type { AgentRunsPage, AgentsDashboard, AiPausedState } from "@/features/agents-ia/types";
import type { Result } from "@/lib/utils/result";

/**
 * The « Agents IA » screen, assembled from its three server reads.
 *
 * What this file protects: **the kill switch is a safety control, not a
 * statistic**. It used to be rendered inside the dashboard block, so a single
 * failed count made the only way to suspend the five agents disappear from the
 * screen. That regression must never come back.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// The panel is a client component wired to a server action: the screen is what
// is under test here, not the mutation (covered by the E2E journey).
vi.mock("@/features/agents-ia/actions", () => ({
  setAgencyAiPaused: vi.fn(),
}));

vi.mock("@/features/agents-ia/queries", () => ({
  getAgentsOverview: vi.fn(),
  getAiPausedState: vi.fn(),
  getAgentRuns: vi.fn(),
  getRunSteps: vi.fn(),
}));

vi.mock("@/features/contacts/queries", () => ({
  getContactTimeline: vi.fn(),
}));

const { getAgentRuns, getAgentsOverview, getAiPausedState } = await import(
  "@/features/agents-ia/queries"
);
const AgentsIaPage = (await import("./page")).default;

const KILL_SWITCH: AiPausedState = {
  agencyId: "agency-1",
  agencyName: "Calanques Immobilier (fictive)",
  aiPaused: false,
  canResume: true,
};

const EMPTY_HISTORY: AgentRunsPage = {
  runs: [],
  total: 0,
  limit: 25,
  offset: 0,
  hasMore: false,
  appliedFilters: { limit: 25, offset: 0 },
};

function failed<T>(code: string, message: string): Result<T> {
  return { data: null, error: { code, message } };
}

async function renderPage(): Promise<void> {
  render(await AgentsIaPage({ searchParams: Promise.resolve({}) }));
}

afterEach(() => {
  cleanup();
});

describe("Écran Agents IA", () => {
  it("garde le coupe-circuit affiché et actionnable quand le tableau de bord échoue", async () => {
    const message = "Impossible de compter les exécutions des agents. Réessayez.";
    vi.mocked(getAgentsOverview).mockResolvedValue(failed<AgentsDashboard>("overview_failed", message));
    vi.mocked(getAiPausedState).mockResolvedValue({ data: KILL_SWITCH, error: null });
    vi.mocked(getAgentRuns).mockResolvedValue({ data: EMPTY_HISTORY, error: null });

    await renderPage();

    // The failure is stated, with the server's own French message.
    expect(screen.getByTestId("agents-overview-error").textContent).toContain(message);

    // …and the emergency control is still there, enabled, not a disabled stub.
    const killSwitch = screen.getByTestId("kill-switch");
    expect(killSwitch.textContent).toContain(APP_TEXTS.killSwitch.running);
    const toggle = screen.getByTestId("kill-switch-toggle") as HTMLButtonElement;
    expect(toggle.disabled).toBe(false);
    expect(toggle.textContent).toContain(APP_TEXTS.killSwitch.pause);

    // No figure is invented to fill the gap.
    expect(screen.queryByTestId("agency-activity")).toBeNull();
  });

  it("montre l'état suspendu depuis la lecture dédiée, sans dépendre des chiffres", async () => {
    vi.mocked(getAgentsOverview).mockResolvedValue(
      failed<AgentsDashboard>("overview_failed", "Lecture impossible."),
    );
    vi.mocked(getAiPausedState).mockResolvedValue({
      data: { ...KILL_SWITCH, aiPaused: true, canResume: false },
      error: null,
    });
    vi.mocked(getAgentRuns).mockResolvedValue({ data: EMPTY_HISTORY, error: null });

    await renderPage();

    // Header badge: the agency must see it is suspended even here.
    expect(screen.getAllByText(APP_TEXTS.killSwitch.paused).length).toBeGreaterThan(0);
    // A non-director cannot resume: refusal explained, not silently ignored.
    expect((screen.getByTestId("kill-switch-toggle") as HTMLButtonElement).disabled).toBe(true);
  });

  it("montre d'abord la situation immédiate, puis le parcours du dernier dossier (ou un état vide)", async () => {
    const dashboard: AgentsDashboard = {
      agencyId: "agency-1",
      agencyName: "Calanques Immobilier (fictive)",
      aiPaused: false,
      dailyRunLimit: 100,
      runsToday: 0,
      runsTodayTotal: 0,
      windows: {
        today: { key: "today", label: "aujourd'hui", startsAt: "2026-09-19T22:00:00.000Z", days: 1 },
        last7Days: { key: "last7Days", label: "sur 7 jours", startsAt: "2026-09-13T22:00:00.000Z", days: 7 },
      },
      canResume: true,
      pendingValidationCount: 2,
      agents: [],
    };
    vi.mocked(getAgentsOverview).mockResolvedValue({ data: dashboard, error: null });
    vi.mocked(getAiPausedState).mockResolvedValue({ data: KILL_SWITCH, error: null });
    vi.mocked(getAgentRuns).mockResolvedValue({ data: EMPTY_HISTORY, error: null });

    await renderPage();

    expect(screen.getByTestId("situation-pending").textContent).toContain("2");
    // No run belongs to a contact yet: an empty state with a suggested action, nothing invented.
    expect(screen.getByTestId("selected-dossier").textContent).toContain(APP_TEXTS.dossierJourney.emptyTitle);
    expect(screen.queryByTestId("dossier-rail")).toBeNull();
  });

  it("explique la panne du coupe-circuit lui-même plutôt que de le faire disparaître", async () => {
    const message = "Impossible de lire l'état des agents IA de votre agence.";
    vi.mocked(getAgentsOverview).mockResolvedValue(
      failed<AgentsDashboard>("overview_failed", "Lecture impossible."),
    );
    vi.mocked(getAiPausedState).mockResolvedValue(failed<AiPausedState>("kill_switch_failed", message));
    vi.mocked(getAgentRuns).mockResolvedValue({ data: EMPTY_HISTORY, error: null });

    await renderPage();

    expect(screen.getByTestId("kill-switch-unavailable").textContent).toContain(message);
  });
});
