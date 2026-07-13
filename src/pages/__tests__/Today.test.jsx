import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import Today from "../Today.jsx";

describe("Hoy", () => {
  it("edita, completa, reordena y reinicia las prioridades compartidas", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Today />);

    const firstPriority = screen.getByRole("textbox", { name: "Texto de prioridad 1" });
    await user.clear(firstPriority);
    await user.type(firstPriority, "Preparar sorpresa");
    await user.click(screen.getByRole("checkbox", { name: "Marcar Preparar sorpresa" }));
    await user.click(
      screen.getByRole("button", { name: "Mover Preparar sorpresa hacia abajo" }),
    );

    expect(screen.getByDisplayValue("Preparar sorpresa")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Desmarcar Preparar sorpresa" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Reiniciar hoy" }));

    expect(screen.getByRole("checkbox", { name: "Marcar Preparar sorpresa" })).not.toBeChecked();
  });

  it("guarda la nota rápida compartida", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<Today />);

    await user.type(
      screen.getByRole("textbox", { name: "Nota rápida" }),
      "Comprar flores mañana",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("Guardado")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nota rápida" })).toHaveValue(
      "Comprar flores mañana",
    );
  });
});
