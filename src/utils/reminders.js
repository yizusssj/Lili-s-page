export const REMINDER_OPTIONS = [
  { label: "Sin recordatorio", value: "" },
  { label: "A la hora", value: "0" },
  { label: "1 hora antes", value: "60" },
  { label: "1 día antes", value: "1440" },
];

const VALID_REMINDER_MINUTES = new Set([0, 60, 1440]);

export function normalizeReminderMinutes(value) {
  if (value === "" || value === null || value === undefined) return null;
  const minutes = Number(value);
  return VALID_REMINDER_MINUTES.has(minutes) ? minutes : null;
}

export function getTaskDueAt(task) {
  if (!task?.dueDate || !task?.dueTime) return null;

  const dateParts = task.dueDate.split("-").map(Number);
  const timeParts = task.dueTime.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) return null;

  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  const dueAt = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    Number.isNaN(dueAt.getTime())
    || dueAt.getFullYear() !== year
    || dueAt.getMonth() !== month - 1
    || dueAt.getDate() !== day
    || dueAt.getHours() !== hour
    || dueAt.getMinutes() !== minute
  ) {
    return null;
  }

  return dueAt;
}

export function getReminderTriggerAt(task) {
  const dueAt = getTaskDueAt(task);
  const minutes = normalizeReminderMinutes(task?.reminderMinutesBefore);
  if (!dueAt || minutes === null) return null;

  return new Date(dueAt.getTime() - minutes * 60_000);
}

export function getReminderStatus(task, now = new Date()) {
  if (task?.done) return "completed";
  if (task?.reminderAcknowledgedAt) return "acknowledged";

  const triggerAt = getReminderTriggerAt(task);
  if (!triggerAt) return "none";
  return now.getTime() >= triggerAt.getTime() ? "active" : "upcoming";
}

export function getActiveReminders(tasks, now = new Date()) {
  return tasks
    .filter((task) => getReminderStatus(task, now) === "active")
    .sort((first, second) => {
      const firstDue = getTaskDueAt(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const secondDue = getTaskDueAt(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return firstDue - secondDue;
    });
}

export function getUpcomingReminders(tasks, now = new Date(), limit = 5) {
  return tasks
    .filter((task) => getReminderStatus(task, now) === "upcoming")
    .sort(
      (first, second) =>
        getReminderTriggerAt(first).getTime() - getReminderTriggerAt(second).getTime(),
    )
    .slice(0, limit);
}

export function formatTaskTime(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}/.test(value)) return "";
  const [hour, minute] = value.split(":").map(Number);
  const time = new Date(2000, 0, 1, hour, minute);
  if (Number.isNaN(time.getTime())) return "";

  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
}

export function formatReminderLead(value) {
  const minutes = normalizeReminderMinutes(value);
  if (minutes === 0) return "A la hora";
  if (minutes === 60) return "1 h antes";
  if (minutes === 1440) return "1 día antes";
  return "";
}
