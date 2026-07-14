import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import Tasks from "../Tasks.jsx";

describe("Tareas", () => {
  it("crea, completa y elimina una tarea compartida", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Tasks />);

    await user.type(screen.getByRole("textbox", { name: "Nueva tarea" }), "Comprar flores");
    await user.selectOptions(screen.getByLabelText("Prioridad"), "high");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const checkbox = screen.getByRole("checkbox", { name: "Marcar Comprar flores" });
    expect(screen.getByText("Alta", { selector: ".taskPriority" })).toBeInTheDocument();
    await user.click(checkbox);

    await user.click(screen.getByRole("tab", { name: /Completadas/ }));
    expect(
      screen.getByRole("checkbox", { name: "Desmarcar Comprar flores" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Eliminar Comprar flores" }));
    expect(screen.queryByText("Comprar flores")).not.toBeInTheDocument();
  });

  it("edita el nombre, la fecha y la prioridad", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Tasks />, {
      tasks: [
        {
          id: "task-1",
          text: "Preparar maleta",
          done: false,
          dueDate: null,
          priority: "high",
          createdAt: "2026-07-13T12:00:00.000Z",
          updatedAt: "2026-07-13T12:00:00.000Z",
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Editar Preparar maleta" }));
    const nameInput = screen.getByRole("textbox", {
      name: "Editar nombre de Preparar maleta",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "Preparar equipaje");
    await user.type(
      screen.getByLabelText("Editar fecha de Preparar maleta"),
      "2026-07-30",
    );
    await user.selectOptions(
      screen.getByLabelText("Editar prioridad de Preparar maleta"),
      "low",
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByText("Preparar equipaje")).toBeInTheDocument();
    expect(screen.getByText("Baja", { selector: ".taskPriority" })).toBeInTheDocument();
  });
});
