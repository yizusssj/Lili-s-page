import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Camera,
  CircleCheckBig,
  GripVertical,
  Images,
  ListTodo,
  NotebookPen,
  Pin,
  Sun,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { formatCalendarDate, formatNoteDate } from "../utils/date.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase("es-MX") + value.slice(1);
}

function getGreeting(date) {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function QuickNote() {
  const { quickNote, saveQuickNote } = useWorkspace();
  const [draft, setDraft] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const statusTimeout = useRef(null);
  const text = draft ?? quickNote;

  useEffect(
    () => () => {
      window.clearTimeout(statusTimeout.current);
    },
    [],
  );

  async function save() {
    setSaveStatus("saving");
    const wasSaved = await saveQuickNote(text);
    if (wasSaved) setDraft(null);
    setSaveStatus(wasSaved ? "saved" : "error");
    window.clearTimeout(statusTimeout.current);
    statusTimeout.current = window.setTimeout(() => setSaveStatus("idle"), 1800);
  }

  return (
    <>
      <textarea
        id="quick-note"
        aria-label="Nota rápida"
        placeholder="Escribe algo..."
        value={text}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={10000}
        style={styles.textarea}
        rows={6}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button
          type="button"
          style={styles.primaryBtn}
          onClick={() => void save()}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Guardando..." : "Guardar"}
        </button>
        <span
          aria-live="polite"
          style={{ fontSize: 12, color: saveStatus === "error" ? "#b91c1c" : "#15803d" }}
        >
          {saveStatus === "saved" && (
            <span style={styles.statusWithIcon}>
              <CircleCheckBig aria-hidden="true" size={14} strokeWidth={1.8} />
              Guardado
            </span>
          )}
          {saveStatus === "error" && "No se pudo guardar"}
        </span>
      </div>
    </>
  );
}

function DashboardMetric({ color, icon: Icon, label, onClick, value }) {
  return (
    <button
      type="button"
      className="dashboardMetric"
      onClick={onClick}
      aria-label={`${value} ${label}`}
    >
      <span className="dashboardMetricIcon" style={{ color }}>
        <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
      </span>
      <span className="dashboardMetricCopy">
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="dashboardMetricArrow"
        size={16}
        strokeWidth={1.8}
      />
    </button>
  );
}

export default function Today({ onNavigate = () => {} }) {
  const {
    albums,
    memories,
    movePriority,
    notes,
    priorities: items,
    resetPriorities,
    tasks,
    togglePriority,
    updatePriorityText,
  } = useWorkspace();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clockId = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(clockId);
  }, []);

  useEffect(() => {
    let timeoutId;

    function scheduleNextDay() {
      const currentDate = new Date();
      const nextMidnight = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + 1,
      );
      const delay = nextMidnight.getTime() - currentDate.getTime() + 100;

      timeoutId = window.setTimeout(() => {
        resetPriorities();
        setNow(new Date());
        scheduleNextDay();
      }, delay);
    }

    scheduleNextDay();
    return () => window.clearTimeout(timeoutId);
  }, [resetPriorities]);

  const pendingTasks = tasks.filter((task) => !task.done).length;
  const completedPriorities = items.filter((item) => item.done).length;
  const priorityProgress = items.length
    ? Math.round((completedPriorities / items.length) * 100)
    : 0;
  const formattedDate = capitalize(
    new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(now),
  );

  const featuredNote = useMemo(
    () =>
      [...notes].sort((first, second) => {
        if (first.pinned !== second.pinned) return first.pinned ? -1 : 1;
        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
      })[0] ?? null,
    [notes],
  );

  const latestMemory = useMemo(
    () =>
      [...memories].sort((first, second) => {
        const dateOrder = (second.memoryDate ?? "").localeCompare(first.memoryDate ?? "");
        if (dateOrder !== 0) return dateOrder;
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      })[0] ?? null,
    [memories],
  );
  const latestMemoryAlbum = latestMemory
    ? albums.find((album) => album.id === latestMemory.albumId) ?? null
    : null;

  return (
    <div style={styles.stack}>
      <Block title={<SectionTitle icon={Sun} label="Hoy" color="#b45309" />}>
        <div className="todayHero">
          <div>
            <div className="todayGreeting">{getGreeting(now)}</div>
            <h1 className="todayHeading">Tu día, en un solo lugar.</h1>
            <p className="todayIntro">
              Revisa lo importante y continúa justo donde lo dejaste.
            </p>

            <div className="todayProgress" aria-label={`${priorityProgress}% de prioridades completadas`}>
              <div className="todayProgressLabel">
                <span>Prioridades de hoy</span>
                <strong>{completedPriorities} de {items.length}</strong>
              </div>
              <div className="todayProgressTrack" aria-hidden="true">
                <span style={{ width: `${priorityProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="todayDate">
            <CalendarDays aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{formattedDate}</span>
          </div>
        </div>
      </Block>

      <div className="dashboardMetrics" aria-label="Resumen del workspace">
        <DashboardMetric
          color="#047857"
          icon={ListTodo}
          label={pendingTasks === 1 ? "tarea pendiente" : "tareas pendientes"}
          onClick={() => onNavigate("tasks")}
          value={pendingTasks}
        />
        <DashboardMetric
          color="#1d4ed8"
          icon={NotebookPen}
          label={notes.length === 1 ? "nota guardada" : "notas guardadas"}
          onClick={() => onNavigate("notes")}
          value={notes.length}
        />
        <DashboardMetric
          color="#7e22ce"
          icon={Camera}
          label={memories.length === 1 ? "recuerdo" : "recuerdos"}
          onClick={() => onNavigate("memories")}
          value={memories.length}
        />
      </div>

      <div style={styles.grid2} className="grid2 todayWorkspaceGrid">
        <Block
          title="Top 3 prioridades"
          right={
            <button
              type="button"
              style={styles.ghostBtn}
              onClick={resetPriorities}
              title="Reinicia checks de hoy"
            >
              Reiniciar hoy
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                style={styles.dragRow}
                className="glassRow priorityRow"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", String(index));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = Number(event.dataTransfer.getData("text/plain"));
                  if (!Number.isNaN(from)) movePriority(from, index);
                }}
              >
                <span aria-hidden="true" style={styles.dragHandle} title="Arrastra para reordenar">
                  <GripVertical size={17} strokeWidth={1.8} />
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => togglePriority(item.id)}
                    aria-label={`${item.done ? "Desmarcar" : "Marcar"} ${item.text || `prioridad ${index + 1}`}`}
                    style={{ width: 16, height: 16 }}
                  />
                  <input
                    value={item.text}
                    onChange={(event) => updatePriorityText(item.id, event.target.value)}
                    aria-label={`Texto de prioridad ${index + 1}`}
                    placeholder={`Prioridad ${index + 1}`}
                    maxLength={500}
                    style={{
                      ...styles.inlineInput,
                      textDecoration: item.done ? "line-through" : "none",
                      color: item.done ? "#6b7280" : "#111827",
                    }}
                  />
                </div>

                <div style={styles.moveButtons}>
                  <button
                    type="button"
                    style={styles.moveBtn}
                    className="glassIconButton"
                    onClick={() => movePriority(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Mover ${item.text || `prioridad ${index + 1}`} hacia arriba`}
                  >
                    <ArrowUp aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    style={styles.moveBtn}
                    className="glassIconButton"
                    onClick={() => movePriority(index, index + 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Mover ${item.text || `prioridad ${index + 1}`} hacia abajo`}
                  >
                    <ArrowDown aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            Arrastra con los puntos para cambiar el orden.
          </div>
        </Block>

        <Block title="Nota rápida">
          <QuickNote />
        </Block>
      </div>

      <div className="dashboardPreviewGrid">
        <Block
          title="Nota destacada"
          right={
            <button type="button" style={styles.ghostBtn} onClick={() => onNavigate("notes")}>
              Ver notas
              <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
            </button>
          }
        >
          {featuredNote ? (
            <button
              type="button"
              className="dashboardNotePreview"
              onClick={() => onNavigate("notes")}
            >
              <span className="dashboardPreviewHeading">
                <span className="dashboardPreviewIcon dashboardPreviewIconNote">
                  {featuredNote.pinned ? (
                    <Pin aria-hidden="true" size={17} strokeWidth={1.8} />
                  ) : (
                    <NotebookPen aria-hidden="true" size={17} strokeWidth={1.8} />
                  )}
                </span>
                <span>
                  <strong>{featuredNote.title.trim() || "Sin título"}</strong>
                  <small>{formatNoteDate(featuredNote.updatedAt)}</small>
                </span>
              </span>
              <span className="dashboardNoteExcerpt">
                {featuredNote.content.trim() || "Esta nota todavía no tiene contenido."}
              </span>
            </button>
          ) : (
            <div className="dashboardEmpty">
              <NotebookPen aria-hidden="true" size={22} strokeWidth={1.6} />
              <div>
                <strong>Aún no hay notas</strong>
                <span>Cuando crees una, aparecerá aquí.</span>
              </div>
            </div>
          )}
        </Block>

        <Block
          title="Recuerdo reciente"
          right={
            <button type="button" style={styles.ghostBtn} onClick={() => onNavigate("memories")}>
              Ver recuerdos
              <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
            </button>
          }
        >
          {latestMemory ? (
            <button
              type="button"
              className="dashboardMemoryPreview"
              onClick={() => onNavigate("memories")}
            >
              <span className="dashboardMemoryImage">
                {latestMemory.imageUrl ? (
                  <img src={latestMemory.imageUrl} alt="" />
                ) : (
                  <Images aria-hidden="true" size={25} strokeWidth={1.5} />
                )}
              </span>
              <span className="dashboardMemoryCopy">
                {latestMemoryAlbum && <small>{latestMemoryAlbum.title}</small>}
                <strong>{latestMemory.title?.trim() || "Un momento para recordar"}</strong>
                <span>{formatCalendarDate(latestMemory.memoryDate)}</span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="dashboardMemoryArrow"
                size={17}
                strokeWidth={1.8}
              />
            </button>
          ) : (
            <div className="dashboardEmpty">
              <Camera aria-hidden="true" size={22} strokeWidth={1.6} />
              <div>
                <strong>Aún no hay recuerdos</strong>
                <span>Tu foto más reciente aparecerá aquí.</span>
              </div>
            </div>
          )}
        </Block>
      </div>
    </div>
  );
}
