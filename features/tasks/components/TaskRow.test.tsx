// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";

import { openTask } from "./task-fixture";
import { TaskRow } from "./TaskRow";

vi.mock("@/features/tasks/actions", () => ({ completeTask: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const TEXTS = APP_TEXTS.tasks;

afterEach(() => cleanup());

describe("TaskRow", () => {
  it("affiche le titre, le contact lié, l'échéance en heure de Paris et l'agent créateur", () => {
    const task = openTask();
    render(<TaskRow task={task} />);

    const row = screen.getByTestId("task-row");
    expect(within(row).getByRole("heading", { level: 3, name: task.title })).toBeDefined();
    expect(within(row).getByRole("link", { name: "Camille Berthier" }).getAttribute("href")).toBe(
      `/contacts/${task.contactId}`,
    );
    expect(row.textContent).toContain(TEXTS.dueAt(formatDateTime(task.dueAt ?? "")));
    expect(row.textContent).toContain(TEXTS.openedBy("Hugo"));
    expect(row.textContent).not.toContain(TEXTS.overdue);
  });

  it("dit « En retard » en toutes lettres, pas seulement par un style", () => {
    render(<TaskRow task={openTask({ isOverdue: true })} />);

    const row = screen.getByTestId("task-row");
    // Visible text, hence read by assistive technology and in greyscale.
    expect(within(row).getByText(TEXTS.overdue)).toBeDefined();
  });

  it("présente une tâche d'agence sans lien vers une fiche", () => {
    render(<TaskRow task={openTask({ contactId: null, contactName: null, createdByAgent: null, dueAt: null })} />);

    const row = screen.getByTestId("task-row");
    expect(row.textContent).toContain(TEXTS.agencyTask);
    expect(row.textContent).toContain(TEXTS.noDueDate);
    expect(within(row).queryAllByRole("link")).toHaveLength(0);
  });

  it("rend un titre malveillant comme du texte brut et garde l'identifiant dans un seul segment d'URL", () => {
    const payload = `<img src=x onerror="alert(1)">`;
    const { container } = render(<TaskRow task={openTask({ title: payload, contactId: "../../agents-ia?x=1" })} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("task-row").textContent).toContain(payload);
    expect(screen.getByRole("link", { name: "Camille Berthier" }).getAttribute("href")).toBe(
      `/contacts/${encodeURIComponent("../../agents-ia?x=1")}`,
    );
  });

  it("donne au bouton un nom accessible distinct par tâche", () => {
    const task = openTask();
    render(<TaskRow task={task} />);

    const button = screen.getByRole("button", { name: new RegExp(TEXTS.complete) });
    expect(button.textContent).toContain(task.title);
  });
});
