import { useState } from "react";
import { ListTodo, Plus, Sparkles, Trash2 } from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { useWorkspace } from "../workspace/workspaceContext.js";

export default function Tasks() {
  const {
    addTask,
    clearCompletedTasks,
    removeTask,
    tasks,
    toggleTask,
  } = useWorkspace();
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAddTask() {
    const text = newTask.trim();
    if (!text || adding) return;
    setAdding(true);
    const saved = await addTask(text);
    if (saved) setNewTask("");
    setAdding(false);
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
              onClick={() => void clearCompletedTasks()}
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
              if (event.key === "Enter") void handleAddTask();
            }}
            placeholder="Agregar tarea..."
            maxLength={500}
            style={styles.input}
          />
          <button
            type="button"
            style={styles.primaryBtnSmall}
            onClick={() => void handleAddTask()}
            disabled={adding}
          >
            <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
            {adding ? "Añadiendo..." : "Añadir"}
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
                    onChange={() => void toggleTask(task.id)}
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
                  onClick={() => void removeTask(task.id)}
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
