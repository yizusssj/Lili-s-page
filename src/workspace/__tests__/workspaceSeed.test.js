import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../app/config.js";
import { getLocalDateKey } from "../../utils/date.js";
import { readLocalWorkspaceSeed } from "../workspaceSeed.js";

describe("importación inicial del workspace", () => {
  it("crea un contenido inicial válido cuando no existe almacenamiento local", () => {
    const seed = readLocalWorkspaceSeed();

    expect(seed.localDate).toBe(getLocalDateKey());
    expect(seed.tasks).toHaveLength(3);
    expect(seed.priorities).toHaveLength(3);
    expect(seed.priorities.every((priority) => !priority.done)).toBe(true);
    expect(seed.notes).toEqual([]);
    expect(seed.quickNote).toBe("");
  });

  it("importa datos reales y reinicia checks pertenecientes a un día anterior", () => {
    localStorage.setItem(
      STORAGE_KEYS.tasks,
      JSON.stringify([
        {
          id: "10000000-0000-4000-8000-000000000010",
          text: "Comprar flores",
          done: true,
        },
      ]),
    );
    localStorage.setItem(
      STORAGE_KEYS.todayPriorities,
      JSON.stringify([
        { id: "10000000-0000-4000-8000-000000000011", text: "Uno", done: true },
        { id: "10000000-0000-4000-8000-000000000012", text: "Dos", done: true },
        { id: "10000000-0000-4000-8000-000000000013", text: "Tres", done: true },
      ]),
    );
    localStorage.setItem(STORAGE_KEYS.todayDate, "2000-01-01");
    localStorage.setItem(STORAGE_KEYS.quickNote, "Una nota local");

    const seed = readLocalWorkspaceSeed();

    expect(seed.tasks).toEqual([
      expect.objectContaining({ text: "Comprar flores", done: true }),
    ]);
    expect(seed.priorities.every((priority) => !priority.done)).toBe(true);
    expect(seed.quickNote).toBe("Una nota local");
  });
});
