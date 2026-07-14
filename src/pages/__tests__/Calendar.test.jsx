import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import { getLocalDateKey } from "../../utils/date.js";
import Calendar from "../Calendar.jsx";

function formatMonth(date) {
  const value = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(date);
  return value.charAt(0).toLocaleUpperCase("es-MX") + value.slice(1);
}

describe("Calendario", () => {
  it("muestra, crea y completa tareas del día seleccionado", async () => {
    const user = userEvent.setup();
    const today = getLocalDateKey();
    renderWithWorkspace(<Calendar />, {
      tasks: [
        {
          id: "task-today",
          text: "Preparar desayuno",
          done: false,
          dueDate: today,
          priority: "high",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(screen.getByRole("heading", { name: "Calendario" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Marcar Preparar desayuno" })).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Nueva tarea para este día" }),
      "Comprar fruta",
    );
    await user.selectOptions(
      screen.getByLabelText("Prioridad de la nueva tarea"),
      "low",
    );
    await user.click(screen.getByRole("button", { name: "Añadir al día" }));

    const newTask = screen.getByRole("checkbox", { name: "Marcar Comprar fruta" });
    await user.click(newTask);
    expect(
      screen.getByRole("checkbox", { name: "Desmarcar Comprar fruta" }),
    ).toBeChecked();
  });

  it("navega entre meses y abre la administración de tareas", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const nextMonth = new Date();
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    renderWithWorkspace(<Calendar onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByRole("grid", { name: formatMonth(nextMonth) })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Administrar todas las tareas" }));
    expect(onNavigate).toHaveBeenCalledWith("tasks");
  });
});
