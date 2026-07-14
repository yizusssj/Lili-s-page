import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithWorkspace } from "../../test/renderWithWorkspace.jsx";
import { getLocalDateKey } from "../../utils/date.js";
import ReminderCenter from "../ReminderCenter.jsx";

describe("Centro de recordatorios", () => {
  it("muestra y permite ocultar un recordatorio pendiente", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<ReminderCenter />, {
      tasks: [
        {
          id: "reminder-1",
          text: "Preparar la mochila",
          done: false,
          dueDate: getLocalDateKey(),
          dueTime: "00:00",
          priority: "medium",
          reminderMinutesBefore: 0,
          reminderAcknowledgedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await user.click(
      screen.getByRole("button", { name: /Abrir recordatorios, 1 pendientes/ }),
    );
    expect(screen.getByText("Preparar la mochila")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(screen.queryByText("Preparar la mochila")).not.toBeInTheDocument();
  });
});
