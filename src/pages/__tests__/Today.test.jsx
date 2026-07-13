import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../app/config.js";
import Today from "../Today.jsx";

function readPriorities() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.todayPriorities) ?? "[]");
}

describe("Hoy", () => {
  it("guarda, reordena y restaura las prioridades del día", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Today />);

    const firstPriority = screen.getByRole("textbox", { name: "Texto de prioridad 1" });
    await user.clear(firstPriority);
    await user.type(firstPriority, "Preparar sorpresa");
    await user.click(screen.getByRole("checkbox", { name: "Marcar Preparar sorpresa" }));
    await user.click(
      screen.getByRole("button", { name: "Mover Preparar sorpresa hacia abajo" }),
    );

    await waitFor(() => {
      const priorities = readPriorities();
      expect(priorities[1]).toMatchObject({ text: "Preparar sorpresa", done: true });
    });

    unmount();
    render(<Today />);

    expect(screen.getByDisplayValue("Preparar sorpresa")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Desmarcar Preparar sorpresa" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Reiniciar hoy" }));

    await waitFor(() => {
      expect(readPriorities().every((priority) => !priority.done)).toBe(true);
    });
  });

  it("guarda y recupera la nota rápida", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Today />);

    await user.type(
      screen.getByRole("textbox", { name: "Nota rápida" }),
      "Comprar flores mañana",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(localStorage.getItem(STORAGE_KEYS.quickNote)).toBe("Comprar flores mañana");
    expect(screen.getByText("Guardado")).toBeInTheDocument();

    unmount();
    render(<Today />);

    expect(screen.getByRole("textbox", { name: "Nota rápida" })).toHaveValue(
      "Comprar flores mañana",
    );
  });
});
