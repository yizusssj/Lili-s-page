import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellRing, Check, Clock3, EyeOff, X } from "lucide-react";
import {
  formatTaskTime,
  getActiveReminders,
  getReminderTriggerAt,
  getTaskDueAt,
  getUpcomingReminders,
} from "../utils/reminders.js";
import { useWorkspace } from "../workspace/workspaceContext.js";
import PushNotificationSettings from "./PushNotificationSettings.jsx";

export const OPEN_REMINDERS_EVENT = "lili:open-reminders";

function formatReminderDate(date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ActiveReminder({ now, onAcknowledge, onComplete, task }) {
  const dueAt = getTaskDueAt(task);
  const isOverdue = dueAt && dueAt.getTime() < now.getTime();

  return (
    <article className="reminderItem reminderItemActive">
      <span className="reminderItemIcon">
        <BellRing aria-hidden="true" size={17} strokeWidth={1.8} />
      </span>
      <div className="reminderItemCopy">
        <strong>{task.text}</strong>
        <span>
          <Clock3 aria-hidden="true" size={12} strokeWidth={1.8} />
          {isOverdue ? "Venció" : "Programada"} {formatReminderDate(dueAt)}
        </span>
        <div className="reminderItemActions">
          <button type="button" onClick={() => onComplete(task.id)}>
            <Check aria-hidden="true" size={13} strokeWidth={2} />
            Completar
          </button>
          <button type="button" onClick={() => onAcknowledge(task.id)}>
            <EyeOff aria-hidden="true" size={13} strokeWidth={1.8} />
            Ocultar
          </button>
        </div>
      </div>
    </article>
  );
}

function UpcomingReminder({ task }) {
  const triggerAt = getReminderTriggerAt(task);

  return (
    <article className="reminderItem">
      <span className="reminderItemIcon reminderItemIconQuiet">
        <Bell aria-hidden="true" size={16} strokeWidth={1.8} />
      </span>
      <div className="reminderItemCopy">
        <strong>{task.text}</strong>
        <span>
          Avisará {formatReminderDate(triggerAt)} · {formatTaskTime(task.dueTime)}
        </span>
      </div>
    </article>
  );
}

export default function ReminderCenter() {
  const { tasks, toggleTask, updateTask } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30_000);
    const openCenter = () => {
      setNow(new Date());
      setOpen(true);
    };
    window.addEventListener(OPEN_REMINDERS_EVENT, openCenter);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(OPEN_REMINDERS_EVENT, openCenter);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const activeReminders = useMemo(
    () => getActiveReminders(tasks, now),
    [now, tasks],
  );
  const upcomingReminders = useMemo(
    () => getUpcomingReminders(tasks, now),
    [now, tasks],
  );

  async function acknowledge(taskId) {
    await updateTask(taskId, {
      reminderAcknowledgedAt: new Date().toISOString(),
    });
  }

  const panel = open ? createPortal(
    <div className="reminderOverlay" role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        className="reminderPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-panel-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="reminderPanelHeader">
          <div>
            <span className="reminderPanelEyebrow">Tu agenda</span>
            <h2 id="reminder-panel-title">Recordatorios</h2>
          </div>
          <button
            type="button"
            className="glassIconButton reminderClose"
            aria-label="Cerrar recordatorios"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" size={17} strokeWidth={1.8} />
          </button>
        </header>

        <div className="reminderPanelBody">
          <PushNotificationSettings />

          {activeReminders.length > 0 && (
            <section className="reminderGroup" aria-label="Recordatorios pendientes">
              <div className="reminderGroupTitle">
                <span>Pendientes</span>
                <strong>{activeReminders.length}</strong>
              </div>
              {activeReminders.map((task) => (
                <ActiveReminder
                  key={task.id}
                  now={now}
                  task={task}
                  onAcknowledge={(taskId) => void acknowledge(taskId)}
                  onComplete={(taskId) => void toggleTask(taskId)}
                />
              ))}
            </section>
          )}

          <section className="reminderGroup" aria-label="Próximos recordatorios">
            <div className="reminderGroupTitle">
              <span>Próximos</span>
              <strong>{upcomingReminders.length}</strong>
            </div>
            {upcomingReminders.length > 0 ? (
              upcomingReminders.map((task) => (
                <UpcomingReminder key={task.id} task={task} />
              ))
            ) : (
              <div className="reminderEmpty">
                <Bell aria-hidden="true" size={21} strokeWidth={1.5} />
                <strong>Tu agenda está tranquila</strong>
                <span>Configura una hora y un aviso desde Tareas o Calendario.</span>
              </div>
            )}
          </section>
        </div>

        <footer className="reminderPanelFooter">
          Los avisos internos siguen disponibles aunque no actives los del celular.
        </footer>
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        className={`glassIconButton reminderCenterTrigger${activeReminders.length ? " reminderCenterTriggerActive" : ""}`}
        aria-label={`Abrir recordatorios${activeReminders.length ? `, ${activeReminders.length} pendientes` : ""}`}
        aria-expanded={open}
        title="Recordatorios"
        onClick={() => {
          setNow(new Date());
          setOpen(true);
        }}
      >
        {activeReminders.length ? (
          <BellRing aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : (
          <Bell aria-hidden="true" size={16} strokeWidth={1.8} />
        )}
        {activeReminders.length > 0 && (
          <span className="reminderBadge" aria-hidden="true">
            {Math.min(activeReminders.length, 9)}
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
