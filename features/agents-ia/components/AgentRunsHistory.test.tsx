// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import type { AgentRunsPage, AgentRunSummary } from "../types";
import { AgentRunsHistory } from "./AgentRunsHistory";

const TEXTS = APP_TEXTS.runHistory;
const NO_FILTER = { agent: "", status: "" };

afterEach(() => {
  cleanup();
});

function run(overrides: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: "run-1",
    agent: "hugo",
    agentLabel: "Hugo",
    status: "succeeded",
    statusLabel: "Réussie",
    contactId: "contact-1",
    contactName: "Sophie Marchand",
    decision: "Qualification enregistrée.",
    error: null,
    provider: "simulator",
    model: "simulator-1",
    inputTokens: 10,
    outputTokens: 5,
    isSimulation: true,
    startedAt: "2026-09-17T08:00:00.000Z",
    finishedAt: "2026-09-17T08:00:01.000Z",
    ...overrides,
  };
}

function page(overrides: Partial<AgentRunsPage> = {}): AgentRunsPage {
  return {
    runs: [run()],
    total: 1,
    limit: 25,
    offset: 0,
    hasMore: false,
    appliedFilters: { limit: 25, offset: 0 },
    ...overrides,
  };
}

describe("AgentRunsHistory", () => {
  it("counts the page against the exact total and badges simulated runs", () => {
    render(
      <AgentRunsHistory
        page={page({
          runs: [
            run(),
            run({ id: "run-2", agent: "lea", agentLabel: "Léa", contactId: null, contactName: null }),
          ],
          total: 84,
          hasMore: true,
        })}
        errorMessage={null}
        selected={NO_FILTER}
      />,
    );

    expect(screen.getByText(TEXTS.range(1, 2, 84))).toBeDefined();
    expect(screen.getByRole("link", { name: TEXTS.next }).getAttribute("href")).toBe(
      "/agents-ia?offset=25#historique",
    );
    expect(screen.queryByRole("link", { name: TEXTS.previous })).toBeNull();
    // Léa has no contact: stated, never a dash and never a dead link.
    expect(screen.getByText(APP_TEXTS.agentsIa.inboundLead)).toBeDefined();
    // The others name their contact instead of a generic link label.
    expect(screen.getByRole("link", { name: "Sophie Marchand" }).getAttribute("href")).toBe(
      "/contacts/contact-1",
    );
    expect(screen.getAllByText(APP_TEXTS.states.simulation)).toHaveLength(2);
  });

  it("keeps the filters in the pagination links", () => {
    render(
      <AgentRunsHistory
        page={page({ total: 60, offset: 25, hasMore: true })}
        errorMessage={null}
        selected={{ agent: "hugo", status: "blocked" }}
      />,
    );

    expect(screen.getByRole("link", { name: TEXTS.previous }).getAttribute("href")).toBe(
      "/agents-ia?agent=hugo&status=blocked#historique",
    );
    expect(screen.getByRole("link", { name: TEXTS.next }).getAttribute("href")).toBe(
      "/agents-ia?agent=hugo&status=blocked&offset=50#historique",
    );
  });

  it("treats a page past the end as an empty list, not as an error", () => {
    render(
      <AgentRunsHistory
        page={page({ runs: [], total: 12, offset: 100, hasMore: false })}
        errorMessage={null}
        selected={NO_FILTER}
      />,
    );

    expect(screen.getByText(TEXTS.emptyTitle)).toBeDefined();
    expect(screen.queryByTestId("run-history-error")).toBeNull();
  });

  it("shows the server's French message when the filters are refused", () => {
    render(
      <AgentRunsHistory
        page={null}
        errorMessage={AGENT_ERROR_MESSAGES.invalid_filters}
        selected={{ agent: "inconnu", status: "" }}
      />,
    );

    expect(screen.getByTestId("run-history-error").textContent).toContain(
      AGENT_ERROR_MESSAGES.invalid_filters,
    );
    // No table is drawn: nothing pretends to be the filtered result.
    expect(screen.queryByTestId("run-history-rows")).toBeNull();
    // Two ways back to an unfiltered history: in the alert, and in the form.
    expect(screen.getAllByRole("link", { name: TEXTS.filterReset })).toHaveLength(2);
  });

  it("offers the filters as a plain GET form, with an « all » option", () => {
    render(<AgentRunsHistory page={page()} errorMessage={null} selected={NO_FILTER} />);

    const form = screen.getByRole("form", { name: TEXTS.filtersLabel });
    expect(form.getAttribute("method")).toBe("get");
    const agentSelect = screen.getByLabelText(TEXTS.filterAgent) as HTMLSelectElement;
    expect(agentSelect.value).toBe("");
    expect(Array.from(agentSelect.options).map((option) => option.textContent)).toEqual([
      TEXTS.filterAll,
      "Léa",
      "Hugo",
      "Emma",
      "Louis",
      "Sarah",
    ]);
  });
});
