import { describe, expect, it } from "vitest";
import {
  getActiveReminders,
  getReminderStatus,
  getReminderTriggerAt,
  getUpcomingReminders,
} from "../reminders.js";

const TASK = {
  id: "task-1",
  text: "Llamar a mamá",
  done: false,
  dueDate: "2026-07-20",
  dueTime: "10:00",
  reminderMinutesBefore: 60,
  reminderAcknowledgedAt: null,
};

describe("recordatorios", () => {
  it("calcula el aviso en horario local", () => {
    expect(getReminderTriggerAt(TASK)).toEqual(new Date(2026, 6, 20, 9, 0));
    expect(getReminderStatus(TASK, new Date(2026, 6, 20, 8, 59))).toBe("upcoming");
    expect(getReminderStatus(TASK, new Date(2026, 6, 20, 9, 0))).toBe("active");
  });

  it("excluye recordatorios completados u ocultos", () => {
    const now = new Date(2026, 6, 20, 9, 30);
    expect(getActiveReminders([TASK], now)).toHaveLength(1);
    expect(getActiveReminders([{ ...TASK, done: true }], now)).toHaveLength(0);
    expect(
      getActiveReminders([
        { ...TASK, reminderAcknowledgedAt: "2026-07-20T09:05:00.000Z" },
      ], now),
    ).toHaveLength(0);
  });

  it("ordena los próximos avisos por el momento en que aparecerán", () => {
    const earlier = { ...TASK, id: "earlier" };
    const later = { ...TASK, id: "later", dueTime: "12:00" };
    const reminders = getUpcomingReminders(
      [later, earlier],
      new Date(2026, 6, 20, 8, 0),
    );

    expect(reminders.map((task) => task.id)).toEqual(["earlier", "later"]);
  });
});
