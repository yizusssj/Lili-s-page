import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import Notes from "../Notes.jsx";

describe("Notas", () => {
  it("crea, edita, fija y elimina una nota compartida", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Notes />);

    await user.click(screen.getByRole("button", { name: "Nueva nota" }));

    const title = screen.getByRole("textbox", { name: "Título" });
    await user.clear(title);
    await user.type(title, "Carta especial");
    await user.type(
      screen.getByRole("textbox", { name: "Contenido" }),
      "Una nota que debe seguir aquí después de recargar.",
    );
    await user.click(screen.getByRole("button", { name: "Fijar" }));

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Carta especial");
    expect(screen.getByRole("textbox", { name: "Contenido" })).toHaveValue(
      "Una nota que debe seguir aquí después de recargar.",
    );
    expect(screen.getByRole("button", { name: "Desfijar" })).toBePressed();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Papelera" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Carta especial"));
    expect(screen.getByText("Aún no hay notas")).toBeInTheDocument();
  });
});
