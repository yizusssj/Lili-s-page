import { useEffect, useState } from "react";
import { ListTodo, Plus, Sparkles, Trash2 } from "lucide-react";
import { STORAGE_KEYS } from "../app/config.js";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { createTasks, isItemList } from "../utils/models.js";
import { readJSON, writeJSON } from "../utils/storage.js";

export default function Tasks() {
  const [newTask, setNewTask] = useState("");
  const [tasks, setTasks] = useState(() =>
    readJSON(STORAGE_KEYS.tasks, createTasks(), isItemList),
  );

  useEffect(() => {
    writeJSON(STORAGE_KEYS.tasks, tasks);
  }, [tasks]);

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setTasks((previous) => [{ id: crypto.randomUUID(), text, done: false }, ...previous]);
    setNewTask("");
  }

  function toggleTask(id) {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }

  const remaining = tasks.filter((task) => !task.done).length;

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={ListTodo} label="Tareas" color="#047857" />}
        right={
          <button
            type="button"
            style={styles.ghostBtn}
            onClick={() => setTasks((previous) => previous.filter((task) => !task.done))}
          >
            Limpiar hechas
          </button>
        }
      >
        <div style={{ display: "flex", gap: 10 }} className="taskComposer">
          <label htmlFor="new-task" className="srOnly">
            Nueva tarea
          </label>
          <input
            id="new-task"
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTask();
            }}
            placeholder="Agregar tarea..."
            style={styles.input}
          />
          <button type="button" style={styles.primaryBtnSmall} onClick={addTask}>
            <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
            Añadir
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          Pendientes: <b style={{ color: "#111827" }}>{remaining}</b>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.length === 0 ? (
            <div style={styles.emptyMessage}>
              <Sparkles aria-hidden="true" size={17} strokeWidth={1.7} />
              <span>Sin tareas por ahora</span>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} style={styles.taskRow} className="glassRow taskRow">
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    aria-label={`${task.done ? "Desmarcar" : "Marcar"} ${task.text}`}
                    style={{ width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: task.done ? "#6b7280" : "#111827",
                      textDecoration: task.done ? "line-through" : "none",
                    }}
                  >
                    {task.text}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setTasks((previous) => previous.filter((item) => item.id !== task.id))}
                  style={styles.iconBtn}
                  className="glassIconButton"
                  title="Eliminar"
                  aria-label={`Eliminar ${task.text}`}
                >
                  <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </div>
            ))
          )}
        </div>
      </Block>

      <Block title="Listas sugeridas">
        <ul style={styles.list}>
          <li>Escuela</li>
          <li>Personal</li>
          <li>Casa</li>
          <li>Recurrentes</li>
        </ul>
      </Block>
    </div>
  );
}
