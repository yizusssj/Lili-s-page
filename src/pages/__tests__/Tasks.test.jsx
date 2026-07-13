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
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const checkbox = screen.getByRole("checkbox", { name: "Marcar Comprar flores" });
    await user.click(checkbox);

    expect(
      screen.getByRole("checkbox", { name: "Desmarcar Comprar flores" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Eliminar Comprar flores" }));

    expect(screen.queryByText("Comprar flores")).not.toBeInTheDocument();
  });
});
