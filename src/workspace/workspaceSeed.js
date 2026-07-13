import { STORAGE_KEYS } from "../app/config.js";
import { getLocalDateKey } from "../utils/date.js";
import {
  createPriorities,
  createTasks,
  isItemList,
  isNoteList,
  isPriorityList,
} from "../utils/models.js";
import { readJSON, readText } from "../utils/storage.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : crypto.randomUUID();
}

function safeDate(value, fallback) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime())
    ? value
    : fallback;
}

export function readLocalWorkspaceSeed() {
  const today = getLocalDateKey();
  const storedPriorityDate = readText(STORAGE_KEYS.todayDate);
  const storedTasks = readJSON(STORAGE_KEYS.tasks, null, isItemList);
  const storedNotes = readJSON(STORAGE_KEYS.notes, [], isNoteList);
  const storedPriorities = readJSON(
    STORAGE_KEYS.todayPriorities,
    null,
    isPriorityList,
  );
  const now = new Date().toISOString();

  const tasks = (storedTasks ?? createTasks())
    .map((task) => ({
      id: safeId(task.id),
      text: task.text.trim().slice(0, 500),
      done: task.done,
    }))
    .filter((task) => task.text.length > 0);

  const notes = storedNotes.map((note) => ({
    id: safeId(note.id),
    title: note.title.slice(0, 200),
    content: note.content.slice(0, 100000),
    pinned: note.pinned,
    created_at: safeDate(note.createdAt, now),
    updated_at: safeDate(note.updatedAt, now),
  }));

  const priorities = (storedPriorities ?? createPriorities()).map((priority) => ({
    id: safeId(priority.id),
    text: priority.text.slice(0, 500),
    done: storedPriorityDate === today && priority.done,
  }));

  return {
    localDate: today,
    notes,
    priorities,
    quickNote: readText(STORAGE_KEYS.quickNote).slice(0, 10000),
    tasks,
  };
}
