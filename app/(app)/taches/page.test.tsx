// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { openTask, tasksPage } from "@/features/tasks/components/task-fixture";
import { TASK_ERROR_MESSAGES } from "@/features/tasks/types";

/**
 * The `/taches` screen, assembled from `getOpenTasks()`: exact total with its
 * scope, URL filters with `aria-current`, pagination, empty and error states.
 */

vi.mock("@/features/tasks/queries", () => ({ getOpenTasks: vi.fn() }));
vi.mock("@/features/tasks/actions", () => ({ completeTask: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { getOpenTasks } = await import("@/features/tasks/queries");
const TasksPage = (await import("./page")).default;

const TEXTS = APP_TEXTS.tasks;

afterEach(() => cleanup());

async function renderPage(params: Record<string, string> = {}) {
  render(await TasksPage({ searchParams: Promise.resolve(params) }));
}

function filters() {
  return screen.getByRole("navigation", { name: TEXTS.filtersLabel });
}

describe("Écran Tâches", () => {
  it("affiche le total exact avec son périmètre, le filtre courant et la pagination", async () => {
    const items = Array.from({ length: 25 }, (_, index) =>
      openTask({ id: `00000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`, title: `Tâche ${index}` }),
    );
    vi.mocked(getOpenTasks).mockResolvedValue({
      data: tasksPage({ items, total: 131, offset: 25, hasMore: true }),
      error: null,
    });

    await renderPage({ offset: "25" });

    expect(getOpenTasks).toHaveBeenCalledWith({ offset: "25" });
    expect(screen.getByRole("heading", { level: 1, name: TEXTS.title })).toBeDefined();
    const total = screen.getByTestId("tasks-total");
    expect(within(total).getByTestId("tasks-total-value").textContent).toBe("131");
    expect(total.textContent).toContain(TEXTS.unit(131));
    expect(total.textContent).toContain(TEXTS.scopes.all);

    const current = within(filters()).getByRole("link", { current: "page" });
    expect(current.textContent).toBe(TEXTS.filters.all);
    expect(within(filters()).getByRole("link", { name: TEXTS.filters.overdue }).getAttribute("href")).toBe(
      "/taches?scope=overdue",
    );
    expect(within(filters()).getByRole("link", { name: TEXTS.filters.mine }).getAttribute("href")).toBe(
      "/taches?scope=mine",
    );

    expect(screen.getAllByTestId("task-row")).toHaveLength(25);
    expect(screen.getByTestId("tasks-pagination").textContent).toContain("26–50 sur 131");
  });

  it("passe le filtre de l'URL tel quel et marque « En retard » comme courant", async () => {
    vi.mocked(getOpenTasks).mockResolvedValue({
      data: tasksPage({ scope: "overdue", items: [openTask({ isOverdue: true })] }),
      error: null,
    });

    await renderPage({ scope: "overdue" });

    expect(getOpenTasks).toHaveBeenCalledWith({ scope: "overdue" });
    expect(within(filters()).getByRole("link", { current: "page" }).textContent).toBe(TEXTS.filters.overdue);
    expect(screen.getByTestId("tasks-total").textContent).toContain(TEXTS.scopes.overdue);
  });

  it("propose une action utile quand aucune tâche n'est ouverte", async () => {
    vi.mocked(getOpenTasks).mockResolvedValue({ data: tasksPage({ items: [], total: 0 }), error: null });

    await renderPage();

    expect(screen.getByText(TEXTS.emptyTitles.all)).toBeDefined();
    expect(screen.getByRole("link", { name: TEXTS.emptyAction }).getAttribute("href")).toBe("/contacts");
    expect(screen.getByTestId("tasks-total-value").textContent).toBe("0");
  });

  it("distingue une page au-delà de la fin d'une liste vide", async () => {
    vi.mocked(getOpenTasks).mockResolvedValue({
      data: tasksPage({ items: [], total: 3, offset: 50 }),
      error: null,
    });

    await renderPage({ offset: "50" });

    expect(screen.getByText(TEXTS.pastEndTitle)).toBeDefined();
    expect(screen.getByRole("link", { name: TEXTS.pastEndAction }).getAttribute("href")).toBe("/taches");
    expect(screen.queryByText(TEXTS.emptyTitles.all)).toBeNull();
  });

  it("affiche l'erreur du serveur telle quelle, avec un retour aux filtres par défaut", async () => {
    vi.mocked(getOpenTasks).mockResolvedValue({
      data: null,
      error: { code: "invalid_task_filter", message: TASK_ERROR_MESSAGES.invalid_task_filter },
    });

    await renderPage({ scope: "toutes" });

    const alert = screen.getByTestId("tasks-error");
    expect(alert.textContent).toContain(TEXTS.errorTitle);
    expect(alert.textContent).toContain(TASK_ERROR_MESSAGES.invalid_task_filter);
    expect(within(alert).getByRole("link", { name: TEXTS.resetFilters }).getAttribute("href")).toBe("/taches");
    // An unknown filter is never shown as the current one.
    expect(within(filters()).queryByRole("link", { current: "page" })).toBeNull();
    expect(screen.queryByTestId("tasks-total")).toBeNull();
  });
});
