import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import Trash from "../Trash.jsx";

const deletedAt = new Date().toISOString();

describe("Papelera", () => {
  it("filtra, restaura y elimina definitivamente", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Trash />, {
      trash: [
        {
          data: { id: "task-1", text: "Comprar flores", deletedAt },
          deletedAt,
          id: "task-1",
          type: "task",
        },
        {
          data: {
            content: "Guardar esta idea",
            id: "note-1",
            title: "Carta",
            deletedAt,
          },
          deletedAt,
          id: "note-1",
          type: "note",
        },
      ],
    });

    expect(screen.getByText("Comprar flores")).toBeInTheDocument();
    expect(screen.getByText("Carta")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tareas" }));
    expect(screen.getByText("Comprar flores")).toBeInTheDocument();
    expect(screen.queryByText("Carta")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(screen.queryByText("Comprar flores")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Notas" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", {
      name: "Eliminar Carta para siempre",
    }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Carta"));
    expect(screen.getByText("La papelera está vacía")).toBeInTheDocument();
  });
});
