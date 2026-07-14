import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it("resume el workspace y permite abrir sus secciones", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderWithWorkspace(<Today onNavigate={onNavigate} />, {
      albums: [
        {
          id: "album-1",
          title: "Viaje",
          description: "",
          createdAt: "2026-07-01T12:00:00.000Z",
          updatedAt: "2026-07-01T12:00:00.000Z",
        },
      ],
      memories: [
        {
          id: "memory-1",
          albumId: "album-1",
          title: "Atardecer",
          description: "",
          memoryDate: "2026-07-12",
          createdAt: "2026-07-12T23:00:00.000Z",
          imageUrl: "https://example.test/atardecer.jpg",
        },
      ],
      notes: [
        {
          id: "note-1",
          title: "Ideas del viaje",
          content: "Lugares que queremos conocer.",
          pinned: true,
          createdAt: "2026-07-11T12:00:00.000Z",
          updatedAt: "2026-07-12T12:00:00.000Z",
        },
      ],
      tasks: [
        { id: "task-1", text: "Preparar maleta", done: false },
        { id: "task-2", text: "Comprar boletos", done: true },
      ],
    });

    expect(screen.getByText("Ideas del viaje")).toBeInTheDocument();
    expect(screen.getByText("Atardecer")).toBeInTheDocument();
    expect(screen.getByText("Viaje")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "1 tarea pendiente" }));
    expect(onNavigate).toHaveBeenCalledWith("tasks");
  });
});
