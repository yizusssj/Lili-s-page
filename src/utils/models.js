export function createPriorities() {
  return [
    { id: crypto.randomUUID(), text: "Prioridad 1", done: false },
    { id: crypto.randomUUID(), text: "Prioridad 2", done: false },
    { id: crypto.randomUUID(), text: "Prioridad 3", done: false },
  ];
}

export function createTasks() {
  return [
    { id: crypto.randomUUID(), text: "Hacer tarea", done: false },
    { id: crypto.randomUUID(), text: "Tomar agua", done: false },
    { id: crypto.randomUUID(), text: "Tiempo para mí", done: false },
  ];
}

export function isItemList(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        typeof item.done === "boolean",
    )
  );
}

export function isPriorityList(value) {
  return isItemList(value) && value.length === 3;
}

export function isNoteList(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (note) =>
        note &&
        typeof note.id === "string" &&
        typeof note.title === "string" &&
        typeof note.content === "string" &&
        typeof note.pinned === "boolean" &&
        typeof note.createdAt === "string" &&
        typeof note.updatedAt === "string",
    )
  );
}
