// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { TASK_ERROR_MESSAGES } from "../types";
import { CompleteTaskButton } from "./CompleteTaskButton";
import { TaskCompletionProvider } from "./TaskCompletionProvider";

const completeTask = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/tasks/actions", () => ({ completeTask }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const TEXTS = APP_TEXTS.tasks;
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const TITLE = "Recueillir le consentement avant tout contact";

beforeEach(() => {
  completeTask.mockReset();
  refresh.mockReset();
});

afterEach(() => cleanup());

function renderButton() {
  return render(
    <TaskCompletionProvider>
      <CompleteTaskButton taskId={TASK_ID} taskTitle={TITLE} />
    </TaskCompletionProvider>,
  );
}

function button(): HTMLButtonElement {
  return screen.getByTestId("complete-task") as HTMLButtonElement;
}

describe("CompleteTaskButton", () => {
  it("marque la tâche comme faite, l'annonce dans la zone live et relit la liste", async () => {
    completeTask.mockResolvedValue({
      data: { id: TASK_ID, contactId: null, status: "done", completedAt: "2026-09-23T10:00:00.000Z" },
      error: null,
    });
    renderButton();

    await act(async () => {
      fireEvent.click(button());
    });

    expect(completeTask).toHaveBeenCalledWith(TASK_ID);
    const status = screen.getByTestId("task-completion-status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain(TEXTS.completed(TITLE));
    expect(refresh).toHaveBeenCalledTimes(1);
    // Closed: no second submission possible while the list refreshes.
    expect(button().disabled).toBe(true);
  });

  it("n'envoie qu'une seule requête sur un double clic", async () => {
    let resolve: (value: unknown) => void = () => {};
    completeTask.mockImplementation(() => new Promise((next) => (resolve = next)));
    renderButton();

    await act(async () => {
      fireEvent.click(button());
      fireEvent.click(button());
    });
    expect(button().disabled).toBe(true);
    expect(button().getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolve({ data: { id: TASK_ID, contactId: null, status: "done", completedAt: "2026-09-23T10:00:00.000Z" }, error: null });
    });
    await act(async () => {
      fireEvent.click(button());
    });

    expect(completeTask).toHaveBeenCalledTimes(1);
  });

  it("traite « déjà terminée » comme une information, pas comme une alerte", async () => {
    completeTask.mockResolvedValue({
      data: null,
      error: { code: "task_already_done", message: TASK_ERROR_MESSAGES.task_already_done },
    });
    renderButton();

    await act(async () => {
      fireEvent.click(button());
    });

    expect(screen.queryByRole("alert")).toBeNull();
    const status = screen.getByTestId("task-completion-status");
    expect(status.textContent).toContain(TASK_ERROR_MESSAGES.task_already_done);
    expect(status.textContent).toContain(TEXTS.alreadyDoneTitle);
    expect(refresh).toHaveBeenCalled();
  });

  it("affiche le message d'erreur du serveur tel quel et laisse réessayer", async () => {
    completeTask.mockResolvedValue({
      data: null,
      error: { code: "task_cancelled", message: TASK_ERROR_MESSAGES.task_cancelled },
    });
    renderButton();

    await act(async () => {
      fireEvent.click(button());
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(TEXTS.completeErrorTitle);
    expect(alert.textContent).toContain(TASK_ERROR_MESSAGES.task_cancelled);
    expect(refresh).not.toHaveBeenCalled();
    expect(button().disabled).toBe(false);
  });

  it("reste utilisable si l'action lève une exception inattendue", async () => {
    completeTask.mockRejectedValue(new Error("network"));
    renderButton();

    await act(async () => {
      fireEvent.click(button());
    });

    expect(screen.getByRole("alert").textContent).toContain(APP_TEXTS.states.unexpected);
    expect(screen.getByRole("alert").textContent).not.toContain("network");
    expect(button().disabled).toBe(false);
  });
});
