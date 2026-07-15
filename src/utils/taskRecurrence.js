const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const TASK_RECURRENCE = {
  forever: "monthly_forever",
  once: "once",
  year: "monthly_year",
};

export const TASK_RECURRENCE_OPTIONS = [
  {
    hint: "Aparece únicamente en la fecha seleccionada.",
    label: "Solo esta fecha",
    value: TASK_RECURRENCE.once,
  },
  {
    hint: "Se repite el mismo día de cada mes hasta diciembre.",
    label: "Cada mes este año",
    value: TASK_RECURRENCE.year,
  },
  {
    hint: "Se repite el mismo día de cada mes, sin fecha final.",
    label: "Cada mes siempre",
    value: TASK_RECURRENCE.forever,
  },
];

const VALID_RECURRENCES = new Set(
  TASK_RECURRENCE_OPTIONS.map((option) => option.value),
);

function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value);
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeTaskRecurrence(value, dueDate) {
  if (!isDateKey(dueDate) || !VALID_RECURRENCES.has(value)) {
    return TASK_RECURRENCE.once;
  }
  return value;
}

export function normalizeCompletedOccurrenceDates(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isDateKey))].sort();
}

export function taskOccursOnDate(task, dateKey) {
  if (!isDateKey(task?.dueDate) || !isDateKey(dateKey)) return false;
  const recurrence = normalizeTaskRecurrence(task.recurrence, task.dueDate);
  if (recurrence === TASK_RECURRENCE.once) return task.dueDate === dateKey;
  if (dateKey < task.dueDate) return false;

  const origin = dateFromKey(task.dueDate);
  const occurrence = dateFromKey(dateKey);
  if (origin.getDate() !== occurrence.getDate()) return false;

  return recurrence === TASK_RECURRENCE.forever
    || origin.getFullYear() === occurrence.getFullYear();
}

export function createTaskOccurrence(task, dateKey) {
  if (!taskOccursOnDate(task, dateKey)) return null;
  const recurrence = normalizeTaskRecurrence(task.recurrence, task.dueDate);
  const completedDates = normalizeCompletedOccurrenceDates(
    task.recurrenceCompletedDates,
  );

  return {
    ...task,
    done: Boolean(task.done || completedDates.includes(dateKey)),
    dueDate: dateKey,
    occurrenceDate: dateKey,
    occurrenceKey: `${task.id}:${dateKey}`,
    recurrence,
    recurring: recurrence !== TASK_RECURRENCE.once,
  };
}

export function groupTaskOccurrences(tasks, dateKeys) {
  const grouped = new Map(dateKeys.map((dateKey) => [dateKey, []]));
  dateKeys.forEach((dateKey) => {
    tasks.forEach((task) => {
      const occurrence = createTaskOccurrence(task, dateKey);
      if (occurrence) grouped.get(dateKey).push(occurrence);
    });
  });
  return grouped;
}

export function getUpcomingTaskOccurrences(tasks, today, limit = 6) {
  const occurrences = [];

  tasks.forEach((task) => {
    const recurrence = normalizeTaskRecurrence(task.recurrence, task.dueDate);
    if (recurrence === TASK_RECURRENCE.once) {
      if (task.dueDate >= today && !task.done) {
        const occurrence = createTaskOccurrence(task, task.dueDate);
        if (occurrence) occurrences.push(occurrence);
      }
      return;
    }

    const cursor = dateFromKey(today);
    for (let offset = 0; offset <= 370; offset += 1) {
      const dateKey = dateToKey(cursor);
      const occurrence = createTaskOccurrence(task, dateKey);
      if (occurrence && !occurrence.done) occurrences.push(occurrence);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return occurrences
    .sort((first, second) => {
      if (first.dueDate !== second.dueDate) {
        return first.dueDate.localeCompare(second.dueDate);
      }
      return first.text.localeCompare(second.text, "es-MX");
    })
    .slice(0, limit);
}

export function getTaskRecurrenceLabel(value) {
  return TASK_RECURRENCE_OPTIONS.find((option) => option.value === value)?.label
    ?? TASK_RECURRENCE_OPTIONS[0].label;
}
