import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../../app/config.js";
import Notes from "../Notes.jsx";

function readNotes() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.notes) ?? "[]");
}

describe("Notas", () => {
  it("crea, edita, fija, recupera y elimina una nota", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Notes />);

    await user.click(screen.getByRole("button", { name: "Nueva nota" }));

    const title = screen.getByRole("textbox", { name: "Título" });
    await user.clear(title);
    await user.type(title, "Carta especial");
    await user.type(
      screen.getByRole("textbox", { name: "Contenido" }),
      "Una nota que debe seguir aquí después de recargar.",
    );
    await user.click(screen.getByRole("button", { name: "Fijar" }));

    await waitFor(() => {
      expect(readNotes()[0]).toMatchObject({
        title: "Carta especial",
        content: "Una nota que debe seguir aquí después de recargar.",
        pinned: true,
      });
    });

    unmount();
    render(<Notes />);

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Carta especial");
    expect(screen.getByRole("textbox", { name: "Contenido" })).toHaveValue(
      "Una nota que debe seguir aquí después de recargar.",
    );
    expect(screen.getByRole("button", { name: "Desfijar" })).toBePressed();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Carta especial"));
    expect(readNotes()).toEqual([]);
    expect(screen.getByText("Aún no hay notas")).toBeInTheDocument();
  });
});
