import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flag,
  Plus,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { getLocalDateKey } from "../utils/date.js";
import {
  formatReminderLead,
  formatTaskTime,
  REMINDER_OPTIONS,
} from "../utils/reminders.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const PRIORITY_LABELS = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase("es-MX") + value.slice(1);
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildMonthDays(month) {
  const first = firstDayOfMonth(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    return {
      date,
      key: getLocalDateKey(date),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function formatMonth(date) {
  return capitalize(
    new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    }).format(date),
  );
}

function formatLongDate(value) {
  return capitalize(
    new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateFromKey(value)),
  );
}

function formatAgendaDate(value) {
  return capitalize(
    new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(dateFromKey(value)),
  );
}

function sortDatedTasks(first, second) {
  if (first.done !== second.done) return first.done ? 1 : -1;
  if (first.dueDate !== second.dueDate) return first.dueDate.localeCompare(second.dueDate);

  const weights = { high: 0, medium: 1, low: 2 };
  const priorityOrder = (weights[first.priority] ?? 1) - (weights[second.priority] ?? 1);
  if (priorityOrder !== 0) return priorityOrder;

  return new Date(second.createdAt ?? 0).getTime() - new Date(first.createdAt ?? 0).getTime();
}

function CalendarTaskLine({ compact = false, task }) {
  return (
    <span
      className={`calendarTaskLine calendarTask${task.priority ?? "medium"}${task.done ? " calendarTaskDone" : ""}${compact ? " calendarTaskCompact" : ""}`}
    >
      <span aria-hidden="true" className="calendarTaskDot" />
      <span>{task.text}</span>
    </span>
  );
}

export default function Calendar({ onNavigate = () => {} }) {
  const { addTask, tasks, toggleTask } = useWorkspace();
  const [visibleMonth, setVisibleMonth] = useState(() => firstDayOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey());
  const [newTask, setNewTask] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newReminder, setNewReminder] = useState("");
  const [adding, setAdding] = useState(false);
  const today = getLocalDateKey();

  const datedTasks = useMemo(
    () => tasks.filter((task) => task.dueDate).sort(sortDatedTasks),
    [tasks],
  );

  const tasksByDate = useMemo(() => {
    const grouped = new Map();
    datedTasks.forEach((task) => {
      const current = grouped.get(task.dueDate) ?? [];
      current.push(task);
      grouped.set(task.dueDate, current);
    });
    return grouped;
  }, [datedTasks]);

  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const selectedTasks = tasksByDate.get(selectedDate) ?? [];

  const upcomingTasks = useMemo(
    () => datedTasks.filter((task) => !task.done && task.dueDate >= today).slice(0, 6),
    [datedTasks, today],
  );

  const overdueCount = datedTasks.filter(
    (task) => !task.done && task.dueDate < today,
  ).length;
  const withoutDateCount = tasks.filter((task) => !task.done && !task.dueDate).length;

  function selectDay(day) {
    setSelectedDate(day.key);
    if (!day.inCurrentMonth) setVisibleMonth(firstDayOfMonth(day.date));
  }

  function changeMonth(amount) {
    const nextMonth = addMonths(visibleMonth, amount);
    const currentDate = new Date();
    const isCurrentMonth = nextMonth.getFullYear() === currentDate.getFullYear()
      && nextMonth.getMonth() === currentDate.getMonth();
    setVisibleMonth(nextMonth);
    setSelectedDate(
      isCurrentMonth
        ? getLocalDateKey(currentDate)
        : getLocalDateKey(nextMonth),
    );
  }

  function goToToday() {
    const currentDate = new Date();
    setVisibleMonth(firstDayOfMonth(currentDate));
    setSelectedDate(getLocalDateKey(currentDate));
  }

  async function handleAddTask(event) {
    event.preventDefault();
    const text = newTask.trim();
    if (!text || adding) return;

    setAdding(true);
    const saved = await addTask({
      dueDate: selectedDate,
      dueTime: newDueTime || null,
      priority: newPriority,
      reminderMinutesBefore: newReminder,
      text,
    });
    if (saved) {
      setNewTask("");
      setNewDueTime("");
      setNewPriority("medium");
      setNewReminder("");
    }
    setAdding(false);
  }

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={CalendarDays} label="Calendario" color="#287f95" />}
        right={
          <div className="calendarControls" aria-label="Controles del calendario">
            <button
              type="button"
              className="calendarControlButton calendarControlIcon"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft aria-hidden="true" size={17} strokeWidth={1.9} />
            </button>
            <button type="button" className="calendarControlButton" onClick={goToToday}>
              Hoy
            </button>
            <button
              type="button"
              className="calendarControlButton calendarControlIcon"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight aria-hidden="true" size={17} strokeWidth={1.9} />
            </button>
          </div>
        }
      >
        <div className="calendarIntro">
          <div>
            <h1>{formatMonth(visibleMonth)}</h1>
            <p>Organiza tus pendientes por fecha y mira con claridad lo que viene.</p>
          </div>
          <div className="calendarSummary" aria-label="Resumen del calendario">
            <span>
              <CircleAlert aria-hidden="true" size={15} strokeWidth={1.7} />
              <strong>{overdueCount}</strong> vencidas
            </span>
            <span>
              <Clock3 aria-hidden="true" size={15} strokeWidth={1.7} />
              <strong>{withoutDateCount}</strong> sin fecha
            </span>
          </div>
        </div>
      </Block>

      <div className="calendarLayout">
        <Block title="Vista del mes">
          <div className="calendarDesktop">
            <div className="calendarWeekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="calendarGrid" role="grid" aria-label={formatMonth(visibleMonth)}>
              {monthDays.map((day) => {
                const dayTasks = tasksByDate.get(day.key) ?? [];
                const hiddenCount = Math.max(0, dayTasks.length - 3);
                const accessibleDate = formatLongDate(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    role="gridcell"
                    aria-selected={selectedDate === day.key}
                    aria-label={`${accessibleDate}, ${dayTasks.length} ${dayTasks.length === 1 ? "tarea" : "tareas"}`}
                    className={`calendarDay${day.inCurrentMonth ? "" : " calendarDayOutside"}${day.key === today ? " calendarDayToday" : ""}${selectedDate === day.key ? " calendarDaySelected" : ""}`}
                    onClick={() => selectDay(day)}
                  >
                    <span className="calendarDayNumber">{day.date.getDate()}</span>
                    <span className="calendarDayTasks">
                      {dayTasks.slice(0, 3).map((task) => (
                        <CalendarTaskLine key={task.id} compact task={task} />
                      ))}
                      {hiddenCount > 0 && (
                        <span className="calendarMoreTasks">+{hiddenCount} más</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </Block>

        <div className="calendarSidebar">
          <Block title={formatLongDate(selectedDate)}>
            <label className="calendarMobileDatePicker" htmlFor="calendar-selected-date">
              <span>Elegir fecha</span>
              <input
                id="calendar-selected-date"
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  if (!nextDate) return;
                  setSelectedDate(nextDate);
                  setVisibleMonth(firstDayOfMonth(dateFromKey(nextDate)));
                }}
              />
            </label>

            <form className="calendarQuickAdd" onSubmit={handleAddTask}>
                <label htmlFor="calendar-new-task">Nueva tarea para este día</label>
                <input
                  id="calendar-new-task"
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  placeholder="Escribe una tarea..."
                  maxLength={500}
                  autoComplete="off"
                />
                <div className="calendarScheduleFields">
                  <label htmlFor="calendar-task-time" className="srOnly">
                    Hora de la nueva tarea
                  </label>
                  <input
                    id="calendar-task-time"
                    type="time"
                    value={newDueTime}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNewDueTime(value);
                      if (!value) setNewReminder("");
                    }}
                  />
                  <label htmlFor="calendar-task-reminder" className="srOnly">
                    Recordatorio de la nueva tarea
                  </label>
                  <select
                    id="calendar-task-reminder"
                    value={newReminder}
                    disabled={!newDueTime}
                    onChange={(event) => setNewReminder(event.target.value)}
                  >
                    {REMINDER_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="calendarQuickActions">
                  <label htmlFor="calendar-task-priority" className="srOnly">
                    Prioridad de la nueva tarea
                  </label>
                  <select
                    id="calendar-task-priority"
                    value={newPriority}
                    onChange={(event) => setNewPriority(event.target.value)}
                  >
                    <option value="low">Prioridad baja</option>
                    <option value="medium">Prioridad media</option>
                    <option value="high">Prioridad alta</option>
                  </select>
                  <button type="submit" disabled={adding || !newTask.trim()}>
                    <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
                    {adding ? "Añadiendo..." : "Añadir al día"}
                  </button>
                </div>
            </form>

            <div className="calendarSelectedTasks">
              {selectedTasks.length === 0 ? (
                <div className="calendarDayEmpty">
                  <CheckCircle2 aria-hidden="true" size={20} strokeWidth={1.6} />
                  <span>No hay tareas para este día.</span>
                </div>
              ) : (
                selectedTasks.map((task) => (
                  <label key={task.id} className="calendarSelectedTask">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => void toggleTask(task.id)}
                      aria-label={`${task.done ? "Desmarcar" : "Marcar"} ${task.text}`}
                    />
                    <span className="calendarSelectedCopy">
                      <strong>{task.text}</strong>
                      <span className="calendarSelectedMeta">
                        <small className={`calendarPriorityLabel calendarPriority${task.priority ?? "medium"}`}>
                          <Flag aria-hidden="true" size={11} strokeWidth={1.8} />
                          {PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.medium}
                        </small>
                        {task.dueTime && (
                          <small>
                            <Clock3 aria-hidden="true" size={11} strokeWidth={1.8} />
                            {formatTaskTime(task.dueTime)}
                          </small>
                        )}
                        {task.reminderMinutesBefore !== null
                          && task.reminderMinutesBefore !== undefined && (
                            <small>
                              <Bell aria-hidden="true" size={11} strokeWidth={1.8} />
                              {formatReminderLead(task.reminderMinutesBefore)}
                            </small>
                          )}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <button
              type="button"
              className="calendarOpenTasks"
              onClick={() => onNavigate("tasks")}
            >
              Administrar todas las tareas
              <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
            </button>
          </Block>

          <Block title="Próximas tareas">
            <div className="calendarUpcoming">
              {upcomingTasks.length === 0 ? (
                <div className="calendarUpcomingEmpty">No hay fechas próximas.</div>
              ) : (
                upcomingTasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className="calendarUpcomingTask"
                    onClick={() => {
                      setSelectedDate(task.dueDate);
                      setVisibleMonth(firstDayOfMonth(dateFromKey(task.dueDate)));
                    }}
                  >
                    <span className={`calendarUpcomingDate calendarUpcoming${task.priority ?? "medium"}`}>
                      <strong>{dateFromKey(task.dueDate).getDate()}</strong>
                      <small>{new Intl.DateTimeFormat("es-MX", { month: "short" }).format(dateFromKey(task.dueDate))}</small>
                    </span>
                    <span>
                      <strong>{task.text}</strong>
                      <small>
                        {formatAgendaDate(task.dueDate)}
                        {task.dueTime ? ` · ${formatTaskTime(task.dueTime)}` : ""}
                      </small>
                    </span>
                    <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>
                ))
              )}
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
}
