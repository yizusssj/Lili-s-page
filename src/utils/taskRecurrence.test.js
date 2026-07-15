import { describe, expect, it } from "vitest";
import {
  createTaskOccurrence,
  getUpcomingTaskOccurrences,
  TASK_RECURRENCE,
  taskOccursOnDate,
} from "./taskRecurrence.js";

describe("taskRecurrence", () => {
  it("mantiene una tarea normal únicamente en su fecha", () => {
    const task = { id: "once", dueDate: "2026-07-15", recurrence: "once" };
    expect(taskOccursOnDate(task, "2026-07-15")).toBe(true);
    expect(taskOccursOnDate(task, "2026-08-15")).toBe(false);
  });

  it("repite mensualmente hasta diciembre o indefinidamente", () => {
    const yearly = {
      id: "year",
      dueDate: "2026-07-15",
      recurrence: TASK_RECURRENCE.year,
    };
    const forever = { ...yearly, id: "forever", recurrence: TASK_RECURRENCE.forever };

    expect(taskOccursOnDate(yearly, "2026-12-15")).toBe(true);
    expect(taskOccursOnDate(yearly, "2027-01-15")).toBe(false);
    expect(taskOccursOnDate(forever, "2027-01-15")).toBe(true);
  });

  it("permite completar una aparición sin terminar toda la serie", () => {
    const task = {
      id: "series",
      dueDate: "2026-07-15",
      recurrence: TASK_RECURRENCE.forever,
      recurrenceCompletedDates: ["2026-08-15"],
    };

    expect(createTaskOccurrence(task, "2026-08-15").done).toBe(true);
    expect(createTaskOccurrence(task, "2026-09-15").done).toBe(false);
  });

  it("ordena las próximas apariciones", () => {
    const tasks = [{
      id: "series",
      text: "Pago",
      done: false,
      dueDate: "2026-07-15",
      recurrence: TASK_RECURRENCE.forever,
    }];
    const upcoming = getUpcomingTaskOccurrences(tasks, "2026-08-01", 2);
    expect(upcoming.map((task) => task.dueDate)).toEqual([
      "2026-08-15",
      "2026-09-15",
    ]);
  });
});
