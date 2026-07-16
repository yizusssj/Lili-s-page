import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Flag,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
  X,
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

const PRIORITIES = {
  high: { label: "Alta", weight: 0 },
  medium: { label: "Media", weight: 1 },
  low: { label: "Baja", weight: 2 },
};

const FILTERS = [
  { id: "pending", label: "Pendientes" },
  { id: "today", label: "Hoy" },
  { id: "upcoming", label: "Próximas" },
  { id: "completed", label: "Completadas" },
];

function getTomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getLocalDateKey(date);
}

function formatShortDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function getDueStatus(task, today, tomorrow) {
  if (!task.dueDate) return null;
  if (task.done) return { kind: "done", label: formatShortDate(task.dueDate) };
  if (task.dueDate < today) {
    return { kind: "overdue", label: `Vencida · ${formatShortDate(task.dueDate)}` };
  }
  if (task.dueDate === today) return { kind: "today", label: "Vence hoy" };
  if (task.dueDate === tomorrow) return { kind: "upcoming", label: "Mañana" };
  return { kind: "upcoming", label: formatShortDate(task.dueDate) };
}

function isFocusTask(task, today) {
  return !task.done && (
    task.priority === "high"
    || (task.dueDate && task.dueDate <= today)
  );
}

function sortTasks(first, second, today) {
  if (first.done !== second.done) return first.done ? 1 : -1;

  const getGroup = (task) => {
    if (task.done) return 5;
    if (task.dueDate && task.dueDate < today) return 0;
    if (task.dueDate === today) return 1;
    if (task.priority === "high") return 2;
    if (task.dueDate) return 3;
    return 4;
  };

  const groupOrder = getGroup(first) - getGroup(second);
  if (groupOrder !== 0) return groupOrder;

  if (first.dueDate && second.dueDate && first.dueDate !== second.dueDate) {
    return first.dueDate.localeCompare(second.dueDate);
  }

  const priorityOrder = (PRIORITIES[first.priority]?.weight ?? 1)
    - (PRIORITIES[second.priority]?.weight ?? 1);
  if (priorityOrder !== 0) return priorityOrder;

  return new Date(second.createdAt ?? 0).getTime() - new Date(first.createdAt ?? 0).getTime();
}

export default function Tasks() {
  const {
    addTask,
    clearCompletedTasks,
    removeTask,
    tasks,
    toggleTask,
    updateTask,
  } = useWorkspace();
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newReminder, setNewReminder] = useState("");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [editingId, setEditingId] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [editedDueDate, setEditedDueDate] = useState("");
  const [editedDueTime, setEditedDueTime] = useState("");
  const [editedPriority, setEditedPriority] = useState("medium");
  const [editedReminder, setEditedReminder] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const today = getLocalDateKey();
  const tomorrow = getTomorrowKey();

  const counts = useMemo(() => {
    const pending = tasks.filter((task) => !task.done);
    return {
      completed: tasks.length - pending.length,
      pending: pending.length,
      today: pending.filter((task) => isFocusTask(task, today)).length,
      upcoming: pending.filter((task) => task.dueDate && task.dueDate > today).length,
    };
  }, [tasks, today]);

  const visibleTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => {
          if (filter === "completed") return task.done;
          if (filter === "today") return isFocusTask(task, today);
          if (filter === "upcoming") {
            return !task.done && task.dueDate && task.dueDate > today;
          }
          return !task.done;
        })
        .sort((first, second) => sortTasks(first, second, today)),
    [filter, tasks, today],
  );

  async function handleAddTask(event) {
    event.preventDefault();
    const text = newTask.trim();
    if (!text || adding) return;

    setAdding(true);
    const saved = await addTask({
      dueDate: newDueDate || null,
      dueTime: newDueTime || null,
      priority: newPriority,
      reminderMinutesBefore: newReminder,
      text,
    });
    if (saved) {
      setNewTask("");
      setNewDueDate("");
      setNewDueTime("");
      setNewPriority("medium");
      setNewReminder("");
      setFilter("pending");
    }
    setAdding(false);
  }

  function startEditing(task) {
    setEditingId(task.id);
    setEditedText(task.text);
    setEditedDueDate(task.dueDate ?? "");
    setEditedDueTime(task.dueTime ?? "");
    setEditedPriority(task.priority ?? "medium");
    setEditedReminder(task.reminderMinutesBefore?.toString() ?? "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditedText("");
    setEditedDueDate("");
    setEditedDueTime("");
    setEditedPriority("medium");
    setEditedReminder("");
  }

  async function saveEditing(event, taskId) {
    event.preventDefault();
    if (!editedText.trim() || savingEdit) return;

    setSavingEdit(true);
    const saved = await updateTask(taskId, {
      dueDate: editedDueDate || null,
      dueTime: editedDueTime || null,
      priority: editedPriority,
      reminderMinutesBefore: editedReminder,
      text: editedText,
    });
    if (saved) cancelEditing();
    setSavingEdit(false);
  }

  async function deleteTask(taskId) {
    if (editingId === taskId) cancelEditing();
    await removeTask(taskId);
  }

  const emptyCopy = {
    completed: ["Aún no hay tareas completadas", "Cuando termines una tarea, aparecerá aquí."],
    pending: ["Todo está en orden", "No tienes tareas pendientes por ahora."],
    today: ["Nada urgente por ahora", "Las tareas de hoy, vencidas o de prioridad alta aparecerán aquí."],
    upcoming: ["Sin tareas próximas", "Añade una fecha para organizar lo que viene."],
  }[filter];

  return (
    <div style={styles.stack}>
      <Block title={<SectionTitle icon={ListTodo} label="Tareas" color="#047857" />}>
        <div className="taskPageIntro">
          <div>
            <h1>Organiza lo que sigue.</h1>
            <p>Añade una fecha o prioridad solo cuando realmente la necesites.</p>
          </div>

          <div className="taskSummary" aria-label="Resumen de tareas">
            <div>
              <CircleAlert aria-hidden="true" size={17} strokeWidth={1.7} />
              <span><strong>{counts.today}</strong> para hoy</span>
            </div>
            <div>
              <Clock3 aria-hidden="true" size={17} strokeWidth={1.7} />
              <span><strong>{counts.upcoming}</strong> próximas</span>
            </div>
            <div>
              <CheckCircle2 aria-hidden="true" size={17} strokeWidth={1.7} />
              <span><strong>{counts.completed}</strong> hechas</span>
            </div>
          </div>
        </div>

        <form className="taskComposerAdvanced" onSubmit={handleAddTask}>
          <label className="taskFormField taskFormFieldText" htmlFor="new-task">
            <span>Nueva tarea</span>
            <input
              id="new-task"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="¿Qué necesitas hacer?"
              maxLength={500}
              autoComplete="off"
            />
          </label>

          <label className="taskFormField" htmlFor="new-task-date">
            <span>Fecha opcional</span>
            <span className="taskInputWithIcon">
              <CalendarDays aria-hidden="true" size={15} strokeWidth={1.7} />
              <input
                id="new-task-date"
                type="date"
                min={today}
                value={newDueDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewDueDate(value);
                  if (!value) {
                    setNewDueTime("");
                    setNewReminder("");
                  }
                }}
              />
            </span>
          </label>

          <label className="taskFormField" htmlFor="new-task-time">
            <span>Hora opcional</span>
            <span className="taskInputWithIcon">
              <Clock3 aria-hidden="true" size={15} strokeWidth={1.7} />
              <input
                id="new-task-time"
                type="time"
                value={newDueTime}
                disabled={!newDueDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewDueTime(value);
                  if (!value) setNewReminder("");
                }}
              />
            </span>
          </label>

          <label className="taskFormField" htmlFor="new-task-priority">
            <span>Prioridad</span>
            <span className="taskInputWithIcon">
              <Flag aria-hidden="true" size={15} strokeWidth={1.7} />
              <select
                id="new-task-priority"
                value={newPriority}
                onChange={(event) => setNewPriority(event.target.value)}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </span>
          </label>

          <label className="taskFormField" htmlFor="new-task-reminder">
            <span>Recordatorio</span>
            <span className="taskInputWithIcon">
              <Bell aria-hidden="true" size={15} strokeWidth={1.7} />
              <select
                id="new-task-reminder"
                value={newReminder}
                disabled={!newDueDate || !newDueTime}
                onChange={(event) => setNewReminder(event.target.value)}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <button
            type="submit"
            style={styles.primaryBtnSmall}
            className="taskAddButton"
            disabled={adding || !newTask.trim()}
          >
            <Plus aria-hidden="true" size={16} strokeWidth={1.9} />
            {adding ? "Añadiendo..." : "Añadir"}
          </button>
        </form>
      </Block>

      <Block
        title="Tu lista"
        right={
          <button
            type="button"
            style={styles.ghostBtn}
            onClick={() => void clearCompletedTasks()}
            disabled={counts.completed === 0}
          >
            Limpiar completadas
          </button>
        }
      >
        <div className="taskFilters" role="tablist" aria-label="Filtrar tareas">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`taskFilter${filter === item.id ? " taskFilterActive" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>{counts[item.id]}</span>
            </button>
          ))}
        </div>

        <div className="advancedTaskList">
          {visibleTasks.length === 0 ? (
            <div className="taskEmptyState">
              <span className="taskEmptyIcon">
                <CheckCircle2 aria-hidden="true" size={25} strokeWidth={1.5} />
              </span>
              <strong>{emptyCopy[0]}</strong>
              <p>{emptyCopy[1]}</p>
            </div>
          ) : (
            visibleTasks.map((task) => {
              const dueStatus = getDueStatus(task, today, tomorrow);
              const priority = PRIORITIES[task.priority] ?? PRIORITIES.medium;
              const isEditing = editingId === task.id;

              return (
                <article
                  key={task.id}
                  className={`advancedTaskRow${task.done ? " advancedTaskRowDone" : ""}${dueStatus?.kind === "overdue" ? " advancedTaskRowOverdue" : ""}`}
                >
                  <div className="advancedTaskMain">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => void toggleTask(task.id)}
                      aria-label={`${task.done ? "Desmarcar" : "Marcar"} ${task.text}`}
                    />

                    <div className="advancedTaskCopy">
                      <strong>{task.text}</strong>
                      <div className="advancedTaskMeta">
                        <span className={`taskPriority taskPriority${task.priority ?? "medium"}`}>
                          <Flag aria-hidden="true" size={11} strokeWidth={1.8} />
                          {priority.label}
                        </span>
                        {dueStatus && (
                          <span className={`taskDue taskDue${dueStatus.kind}`}>
                            <CalendarDays aria-hidden="true" size={12} strokeWidth={1.8} />
                            {dueStatus.label}
                          </span>
                        )}
                        {task.dueTime && (
                          <span className="taskDue">
                            <Clock3 aria-hidden="true" size={12} strokeWidth={1.8} />
                            {formatTaskTime(task.dueTime)}
                          </span>
                        )}
                        {task.reminderMinutesBefore !== null
                          && task.reminderMinutesBefore !== undefined && (
                            <span className="taskReminderMeta">
                              <Bell aria-hidden="true" size={12} strokeWidth={1.8} />
                              {formatReminderLead(task.reminderMinutesBefore)}
                            </span>
                          )}
                      </div>
                    </div>

                    <div className="advancedTaskActions">
                      <button
                        type="button"
                        onClick={() => startEditing(task)}
                        style={styles.iconBtn}
                        className="glassIconButton"
                        aria-label={`Editar ${task.text}`}
                        disabled={isEditing}
                      >
                        <Pencil aria-hidden="true" size={14} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTask(task.id)}
                        style={styles.iconBtn}
                        className="glassIconButton"
                        aria-label={`Mover ${task.text} a la papelera`}
                      >
                        <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <form
                      className="taskEditForm"
                      onSubmit={(event) => void saveEditing(event, task.id)}
                    >
                      <label className="taskFormField taskEditText">
                        <span>Nombre</span>
                        <input
                          aria-label={`Editar nombre de ${task.text}`}
                          value={editedText}
                          onChange={(event) => setEditedText(event.target.value)}
                          maxLength={500}
                          autoFocus
                        />
                      </label>
                      <label className="taskFormField">
                        <span>Fecha</span>
                        <input
                          aria-label={`Editar fecha de ${task.text}`}
                          type="date"
                          value={editedDueDate}
                          onChange={(event) => {
                            const value = event.target.value;
                            setEditedDueDate(value);
                            if (!value) {
                              setEditedDueTime("");
                              setEditedReminder("");
                            }
                          }}
                        />
                      </label>
                      <label className="taskFormField">
                        <span>Hora</span>
                        <input
                          aria-label={`Editar hora de ${task.text}`}
                          type="time"
                          value={editedDueTime}
                          disabled={!editedDueDate}
                          onChange={(event) => {
                            const value = event.target.value;
                            setEditedDueTime(value);
                            if (!value) setEditedReminder("");
                          }}
                        />
                      </label>
                      <label className="taskFormField">
                        <span>Prioridad</span>
                        <select
                          aria-label={`Editar prioridad de ${task.text}`}
                          value={editedPriority}
                          onChange={(event) => setEditedPriority(event.target.value)}
                        >
                          <option value="low">Baja</option>
                          <option value="medium">Media</option>
                          <option value="high">Alta</option>
                        </select>
                      </label>
                      <label className="taskFormField">
                        <span>Recordatorio</span>
                        <select
                          aria-label={`Editar recordatorio de ${task.text}`}
                          value={editedReminder}
                          disabled={!editedDueDate || !editedDueTime}
                          onChange={(event) => setEditedReminder(event.target.value)}
                        >
                          {REMINDER_OPTIONS.map((option) => (
                            <option key={option.value || "none"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="taskEditActions">
                        <button
                          type="button"
                          style={styles.ghostBtn}
                          onClick={cancelEditing}
                          disabled={savingEdit}
                        >
                          <X aria-hidden="true" size={14} strokeWidth={1.8} />
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          style={styles.primaryBtnSmall}
                          disabled={savingEdit || !editedText.trim()}
                        >
                          {savingEdit ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })
          )}
        </div>
      </Block>
    </div>
  );
}
