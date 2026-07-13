import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../app/config.js";
import Tasks from "../Tasks.jsx";

function readTasks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) ?? "[]");
}

describe("Tareas", () => {
  it("crea, completa, recupera y elimina una tarea", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Tasks />);

    await user.type(screen.getByRole("textbox", { name: "Nueva tarea" }), "Comprar flores");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const checkbox = screen.getByRole("checkbox", { name: "Marcar Comprar flores" });
    await user.click(checkbox);

    await waitFor(() => {
      expect(readTasks()).toContainEqual(
        expect.objectContaining({ text: "Comprar flores", done: true }),
      );
    });

    unmount();
    render(<Tasks />);

    expect(
      screen.getByRole("checkbox", { name: "Desmarcar Comprar flores" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Eliminar Comprar flores" }));

    await waitFor(() => {
      expect(readTasks().some((task) => task.text === "Comprar flores")).toBe(false);
    });
    expect(screen.queryByText("Comprar flores")).not.toBeInTheDocument();
  });
});
