
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CircleCheckBig,
  Flower2,
  GripVertical,
  Heart,
  ListTodo,
  NotebookPen,
  Pin,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { readJSON, readText, writeJSON, writeText } from "../utils/storage.jsx";
import { styles } from "./styles";

const TODAY_STORAGE_KEY = "lili_today_top3_v1";
const TODAY_DATE_KEY = "lili_today_date_v1";
const QUICK_NOTE_STORAGE_KEY = "lili_quick_note_v1";
const TASKS_STORAGE_KEY = "lili_tasks_v1";
const NOTES_STORAGE_KEY = "lili_notes_v1";

// Para usar una imagen personalizada, colócala en /public y escribe aquí su ruta.
// Ejemplo: const BRAND_IMAGE = "/logo-lili.png";
const BRAND_IMAGE = null;

// Cada página puede usar un icono de Lucide o una imagen con imageSrc: "/icons/hoy.png".
const PAGES = [
  { id: "today", name: "Hoy", icon: Sun, color: "#b45309" },
  { id: "tasks", name: "Tareas", icon: ListTodo, color: "#047857" },
  { id: "notes", name: "Notas", icon: NotebookPen, color: "#1d4ed8" },
  { id: "memories", name: "Recuerdos", icon: Camera, color: "#7e22ce" },
  { id: "pinterest", name: "Pinterest", icon: Pin, color: "#be123c" },
];

function AppIcon({ icon: Icon, imageSrc, size = 18, strokeWidth = 1.8 }) {
  if (imageSrc) {
    return <img src={imageSrc} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  }

  return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} />;
}

function SectionTitle({ icon, label, color = "#962626" }) {
  return (
    <span style={styles.sectionTitle}>
      <span style={{ color, display: "inline-flex" }}>
        <AppIcon icon={icon} size={16} />
      </span>
      <span>{label}</span>
    </span>
  );
}

function createPriorities() {
  return [
    { id: crypto.randomUUID(), text: "Prioridad 1", done: false },
    { id: crypto.randomUUID(), text: "Prioridad 2", done: false },
    { id: crypto.randomUUID(), text: "Prioridad 3", done: false },
  ];
}

function createTasks() {
  return [
    { id: crypto.randomUUID(), text: "Hacer tarea", done: false },
    { id: crypto.randomUUID(), text: "Tomar agua", done: false },
    { id: crypto.randomUUID(), text: "Tiempo para mí", done: false },
  ];
}

function isItemList(value) {
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

function isPriorityList(value) {
  return isItemList(value) && value.length === 3;
}

function isNoteList(value) {
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

function formatNoteDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * App = componente raíz (root).
 * - Contiene el layout principal (sidebar + main)
 * - Controla la navegación por estado (active)
 */
export default function App() {
  /**
   * active = pestaña/página seleccionada actualmente
   * setActive = función para cambiar de pestaña
   */
  const [active, setActive] = useState("today");

  /**
   * activePage = información de la página activa (name, icon...)
   * - useMemo aquí evita recalcular el find en cada render
   * - (aunque find es barato, está bien para practicar)
   */
  const activePage = useMemo(() => PAGES.find((p) => p.id === active), [active]);

  /**
   * IMPORTANTÍSIMO:
   * No puedes poner un <h1> suelto fuera del return (JSX inválido / bug).
   * Si quieres un debug, mételo dentro del return.
   */

  return (
    <div style={styles.app} className="appShell">
      {/* ============== SIDEBAR (navegación) ============== */}
      <aside style={styles.sidebar} className="sidebar">
        {/* Branding / “logo” */}
        <div style={styles.brand} className="brandPanel">
          <div style={styles.brandIcon} className="brandIcon">
            <span style={{ color: "#be123c", display: "inline-flex" }}>
              <AppIcon icon={Heart} imageSrc={BRAND_IMAGE} size={19} strokeWidth={1.7} />
            </span>
          </div>
          <div>
            <div style={styles.brandTitle}>Workspace</div>
            <div style={styles.brandSub}>de lili</div>
          </div>
        </div>

        {/* Menú: se genera a partir de PAGES */}
        <nav style={styles.nav} aria-label="Navegación principal">
          {PAGES.map((p) => {
            const isActive = p.id === active; // ¿este botón es el seleccionado?
            const iconColor = isActive ? "#ffffff" : p.color;
            return (
              <button
                type="button"
                key={p.id} // clave única requerida en listas
                onClick={() => setActive(p.id)} // cambia pantalla
                aria-current={isActive ? "page" : undefined}
                className={`navItem${isActive ? " navItemActive" : ""}`}
                style={{
                  ...styles.navItem, // estilos base
                  ...(isActive ? styles.navItemActive : {}), // estilos cuando está activo
                }}
              >
                <span style={{ ...styles.navIcon, color: iconColor }}>
                  <AppIcon icon={p.icon} imageSrc={p.imageSrc} size={17} />
                </span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer de sidebar (textito / tip) */}
        <div style={styles.sidebarFooter} className="sidebarFooter">
          <div style={styles.tipTitle}>Tip</div>
          <div style={styles.tipText}>y si si?.</div>
        </div>
      </aside>

      {/* ============== MAIN (contenido) ============== */}
      <main style={styles.main}>
        {/* Header principal: muestra el nombre de la página activa */}
        {active !== "today" && (
          <header style={styles.header} className="appHeader">
            <div>
              <h1 style={styles.pageTitle}>{activePage?.name ?? "Página"}</h1>
              <div style={styles.pageSubtitle}>Organizador</div>
            </div>
          </header>
        )}

        {/* Render condicional (router casero):
            Solo se monta el componente que coincide con `active`. */}
        <section style={styles.content} className="content">
          {active === "today" && <Today />}
          {active === "tasks" && <Tasks />}
          {active === "notes" && <Notes />}
          {active === "memories" && <Memories />}
          {active === "pinterest" && <Pinterest />}
        </section>
      </main>
    </div>
  );
}

/* ============================================================
   COMPONENTE REUTILIZABLE: Block
   ------------------------------------------------------------
   Bloque tipo Notion:
   - title: título del bloque
   - right: contenido opcional a la derecha (botón, etc.)
   - children: contenido interno (lo que metas dentro del Block)
   ============================================================ */
function Block({ title, children, right }) {
  return (
    <section style={styles.block} className="glassBlock">
      <div style={styles.blockTop}>
        <div>
          <h2 style={styles.blockTitle}>{title}</h2>
        </div>

        {/* Si `right` existe, lo renderiza; si no, nada */}
        {right ? <div>{right}</div> : null}
      </div>

      {/* Contenido del bloque */}
      <div>{children}</div>
    </section>
  );
}

/* ============================================================
   PÁGINA: TODAY (Hoy)
   ------------------------------------------------------------
   Incluye:
   - Top 3 prioridades (editable, draggable, con reset diario de checks)
   - Nota rápida (QuickNote, guardado manual)
   - Frase del día (estática)
   ============================================================ */
function Today() {
  /**
   * items = arreglo de prioridades:
   * [{ id, text, done }, ...]
   *
   * Nota: usamos función en useState para que localStorage se lea
   * solo una vez al montar el componente.
   */
  const [items, setItems] = useState(() => {
    const today = getLocalDateKey();
    const lastDate = readText(TODAY_DATE_KEY);
    let initial = readJSON(TODAY_STORAGE_KEY, createPriorities(), isPriorityList);

    if (lastDate !== today) {
      initial = initial.map((item) => ({ ...item, done: false }));
      writeText(TODAY_DATE_KEY, today);
      writeJSON(TODAY_STORAGE_KEY, initial);
    }

    return initial;
  });

  /**
   * Guardado automático de prioridades:
   * - Cuando items cambia, lo serializamos y guardamos.
   */
  useEffect(() => {
    writeJSON(TODAY_STORAGE_KEY, items);
  }, [items]);

  // Programa el siguiente reinicio para la medianoche local.
  useEffect(() => {
    let timeoutId;

    function scheduleNextDay() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const delay = nextMidnight.getTime() - now.getTime() + 100;

      timeoutId = window.setTimeout(() => {
        const nextDate = getLocalDateKey();
        setItems((previous) => previous.map((item) => ({ ...item, done: false })));
        writeText(TODAY_DATE_KEY, nextDate);
        scheduleNextDay();
      }, delay);
    }

    scheduleNextDay();
    return () => window.clearTimeout(timeoutId);
  }, []);

  // toggle: invierte done en un item (marcar/desmarcar)
  function toggle(id) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }

  // updateText: actualiza el texto de una prioridad
  function updateText(id, text) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, text } : x)));
  }

  // resetToday: pone done=false a todos (como “reiniciar el día”)
  function resetToday() {
    setItems((prev) => prev.map((x) => ({ ...x, done: false })));
    writeText(TODAY_DATE_KEY, getLocalDateKey());
  }

  function moveItem(from, to) {
    if (to < 0 || to >= items.length || from === to) return;

    setItems((previous) => {
      const copy = [...previous];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  return (
    <div style={styles.stack}>
      <Block title={<SectionTitle icon={Sun} label="Hoy" color="#b45309" />}>
        <div style={styles.p}>
          Bienvenida. Aquí vas a tener tu día clarito: prioridades, notas y cositas bonitas.
        </div>
      </Block>

      {/* Grid en 2 columnas: Prioridades + Nota rápida */}
      <div style={styles.grid2} className="grid2">
        {/* ================= Top 3 Prioridades (con drag & drop) ================= */}
        <Block
          title="Top 3 prioridades"
          right={
            <button
              type="button"
              style={styles.ghostBtn}
              onClick={resetToday}
              title="Reinicia checks de hoy"
            >
              Reiniciar hoy
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it, idx) => (
              <div
                key={it.id}
                style={styles.dragRow}
                className="glassRow priorityRow"
                draggable
                /* Drag start:
                   guardamos índice origen en dataTransfer */
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(idx));
                  e.dataTransfer.effectAllowed = "move";
                }}
                /* Drag over:
                   preventDefault permite que el drop sea válido */
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                /* Drop:
                   - leemos from y to
                   - reordenamos el arreglo con splice */
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  const to = idx;

                  if (Number.isNaN(from) || from === to) return;

                  moveItem(from, to);
                }}
              >
                {/* Handle visual para indicar que se puede arrastrar */}
                <span aria-hidden="true" style={styles.dragHandle} title="Arrastra para reordenar">
                  <GripVertical size={17} strokeWidth={1.8} />
                </span>

                {/* Checkbox + input editable */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => toggle(it.id)}
                    aria-label={`${it.done ? "Desmarcar" : "Marcar"} ${it.text || `prioridad ${idx + 1}`}`}
                    style={{ width: 16, height: 16 }}
                  />
                  <input
                    value={it.text}
                    onChange={(e) => updateText(it.id, e.target.value)}
                    aria-label={`Texto de prioridad ${idx + 1}`}
                    placeholder={`Prioridad ${idx + 1}`}
                    style={{
                      ...styles.inlineInput,
                      textDecoration: it.done ? "line-through" : "none",
                      color: it.done ? "#6b7280" : "#111827",
                    }}
                  />
                </div>

                <div style={styles.moveButtons}>
                  <button
                    type="button"
                    style={styles.moveBtn}
                    className="glassIconButton"
                    onClick={() => moveItem(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label={`Mover ${it.text || `prioridad ${idx + 1}`} hacia arriba`}
                  >
                    <ArrowUp aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    style={styles.moveBtn}
                    className="glassIconButton"
                    onClick={() => moveItem(idx, idx + 1)}
                    disabled={idx === items.length - 1}
                    aria-label={`Mover ${it.text || `prioridad ${idx + 1}`} hacia abajo`}
                  >
                    <ArrowDown aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            Tip: arrastra con los puntitos para reordenar.
          </div>
        </Block>

        {/* ================= Nota rápida (componente aparte) ================= */}
        <Block title="Nota rápida">
          <QuickNote />
        </Block>
      </div>

      {/* Frase del día (estática por ahora) */}
      <Block title="Frase del día">
        <div style={styles.quote}>
          <Flower2
            aria-hidden="true"
            size={17}
            strokeWidth={1.7}
            style={{ color: "#be123c", flexShrink: 0 }}
          />
          <span>“Un día a la vez, pero contigo todo se siente más ligero.”</span>
        </div>
      </Block>
    </div>
  );
}

/* ============================================================
   COMPONENTE: QuickNote
   ------------------------------------------------------------
   Mini nota guardable en localStorage con botón Guardar:
   - text: contenido
   - saveStatus: estado temporal de guardado
   ============================================================ */
function QuickNote() {
  // Carga inicial desde localStorage (solo una vez)
  const [text, setText] = useState(() => readText(QUICK_NOTE_STORAGE_KEY));

  // Para UX: mensaje de éxito o error temporal.
  const [saveStatus, setSaveStatus] = useState("idle");
  const statusTimeout = useRef(null);

  useEffect(
    () => () => {
      window.clearTimeout(statusTimeout.current);
    },
    [],
  );

  // Guardar manual
  function save() {
    const wasSaved = writeText(QUICK_NOTE_STORAGE_KEY, text);
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
        onChange={(e) => setText(e.target.value)}
        style={styles.textarea}
        rows={6}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button type="button" style={styles.primaryBtn} onClick={save}>
          Guardar
        </button>

        <span aria-live="polite" style={{ fontSize: 12, color: saveStatus === "error" ? "#b91c1c" : "#15803d" }}>
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

/* ============================================================
   PÁGINA: Tasks
   ------------------------------------------------------------
   CRUD básico (Create/Read/Update/Delete):
   - Crear tarea
   - Marcar done
   - Borrar
   - Limpiar hechas
   - Persistir en localStorage
   ============================================================ */
function Tasks() {
  // input controlado (lo que escribes antes de “Añadir”)
  const [newTask, setNewTask] = useState("");

  // tasks: carga desde localStorage o defaults
  const [tasks, setTasks] = useState(() => {
    return readJSON(TASKS_STORAGE_KEY, createTasks(), isItemList);
  });

  // Persistencia: cuando tasks cambia, guarda JSON en localStorage
  useEffect(() => {
    writeJSON(TASKS_STORAGE_KEY, tasks);
  }, [tasks]);

  // Agregar tarea nueva (con trim para evitar strings vacíos)
  function addTask() {
    const text = newTask.trim();
    if (!text) return;

    setTasks((prev) => [{ id: crypto.randomUUID(), text, done: false }, ...prev]);
    setNewTask("");
  }

  // Toggle done por id
  function toggleTask(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  // Eliminar tarea
  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // Limpiar tareas hechas (deja solo !done)
  function clearDone() {
    setTasks((prev) => prev.filter((t) => !t.done));
  }

  // Conteo de pendientes
  const remaining = tasks.filter((t) => !t.done).length;

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={ListTodo} label="Tareas" color="#047857" />}
        right={
          <button type="button" style={styles.ghostBtn} onClick={clearDone}>
            Limpiar hechas
          </button>
        }
      >
        {/* Input + botón */}
        <div style={{ display: "flex", gap: 10 }} className="taskComposer">
          <label htmlFor="new-task" className="srOnly">
            Nueva tarea
          </label>
          <input
            id="new-task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => {
              // UX: Enter para agregar
              if (e.key === "Enter") addTask();
            }}
            placeholder="Agregar tarea..."
            style={styles.input}
          />
          <button type="button" style={styles.primaryBtnSmall} onClick={addTask}>
            <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
            Añadir
          </button>
        </div>

        {/* Contador */}
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          Pendientes: <b style={{ color: "#111827" }}>{remaining}</b>
        </div>

        {/* Lista de tareas */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.length === 0 ? (
            <div style={styles.emptyMessage}>
              <Sparkles aria-hidden="true" size={17} strokeWidth={1.7} />
              <span>Sin tareas por ahora</span>
            </div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} style={styles.taskRow} className="glassRow taskRow">
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                    aria-label={`${t.done ? "Desmarcar" : "Marcar"} ${t.text}`}
                    style={{ width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: t.done ? "#6b7280" : "#111827",
                      textDecoration: t.done ? "line-through" : "none",
                    }}
                  >
                    {t.text}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => deleteTask(t.id)}
                  style={styles.iconBtn}
                  className="glassIconButton"
                  title="Eliminar"
                  aria-label={`Eliminar ${t.text}`}
                >
                  <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </div>
            ))
          )}
        </div>
      </Block>

      {/* Placeholder: lista sugerida */}
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

function Notes() {
  const [notes, setNotes] = useState(() => readJSON(NOTES_STORAGE_KEY, [], isNoteList));
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [storageStatus, setStorageStatus] = useState("idle");

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");

    return [...notes]
      .filter((note) => {
        if (!normalizedQuery) return true;
        return `${note.title} ${note.content}`.toLocaleLowerCase("es-MX").includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, query]);

  const selectedNote =
    visibleNotes.find((note) => note.id === selectedId) ?? visibleNotes[0] ?? null;

  function saveNotes(nextNotes) {
    setNotes(nextNotes);
    setStorageStatus(writeJSON(NOTES_STORAGE_KEY, nextNotes) ? "saved" : "error");
  }

  function createNote() {
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      title: "Nueva nota",
      content: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };

    saveNotes([note, ...notes]);
    setSelectedId(note.id);
    setQuery("");
  }

  function updateSelectedNote(fields) {
    if (!selectedNote) return;

    const nextNotes = notes.map((note) =>
      note.id === selectedNote.id
        ? { ...note, ...fields, updatedAt: new Date().toISOString() }
        : note,
    );
    saveNotes(nextNotes);
  }

  function deleteSelectedNote() {
    if (!selectedNote) return;

    const label = selectedNote.title.trim() || "Sin título";
    if (!window.confirm(`¿Eliminar la nota “${label}”? Esta acción no se puede deshacer.`)) return;

    const nextNotes = notes.filter((note) => note.id !== selectedNote.id);
    saveNotes(nextNotes);
    setSelectedId(nextNotes[0]?.id ?? null);
  }

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={NotebookPen} label="Notas" color="#1d4ed8" />}
        right={
          <button type="button" style={styles.primaryBtnSmall} onClick={createNote}>
            <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
            Nueva nota
          </button>
        }
      >
        <div style={styles.p}>
          Guarda ideas, pendientes y cosas importantes. Los cambios se guardan automáticamente.
        </div>
      </Block>

      <div style={styles.notesLayout} className="notesLayout">
        <Block title={`Tus notas (${notes.length})`}>
          <label htmlFor="note-search" className="srOnly">
            Buscar notas
          </label>
          <input
            id="note-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar notas..."
            style={styles.input}
          />

          <div style={styles.noteList} aria-label="Lista de notas">
            {visibleNotes.length === 0 ? (
              <div style={styles.emptyState}>
                <div aria-hidden="true" style={styles.emptyIcon}>
                  {notes.length === 0 ? (
                    <NotebookPen size={24} strokeWidth={1.6} />
                  ) : (
                    <Search size={24} strokeWidth={1.6} />
                  )}
                </div>
                <div style={{ fontWeight: 650 }}>
                  {notes.length === 0 ? "Aún no hay notas" : "No encontramos resultados"}
                </div>
                <div style={styles.p}>
                  {notes.length === 0
                    ? "Crea la primera para comenzar."
                    : "Prueba con otra palabra."}
                </div>
              </div>
            ) : (
              visibleNotes.map((note) => {
                const isSelected = note.id === selectedNote?.id;
                return (
                  <button
                    type="button"
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                    aria-pressed={isSelected}
                    className={`noteCard${isSelected ? " noteCardActive" : ""}`}
                    style={{
                      ...styles.noteCard,
                      ...(isSelected ? styles.noteCardActive : {}),
                    }}
                  >
                    <span style={styles.noteCardTop}>
                      <span style={styles.noteCardTitle}>{note.title.trim() || "Sin título"}</span>
                      {note.pinned && (
                        <span
                          aria-label="Nota fijada"
                          title="Nota fijada"
                          style={{ color: "#be123c", display: "inline-flex" }}
                        >
                          <Pin size={14} strokeWidth={1.8} fill="currentColor" />
                        </span>
                      )}
                    </span>
                    <span style={styles.notePreview}>
                      {note.content.trim() || "Nota vacía"}
                    </span>
                    <span style={styles.noteDate}>{formatNoteDate(note.updatedAt)}</span>
                  </button>
                );
              })
            )}
          </div>
        </Block>

        <Block title="Editor">
          {selectedNote ? (
            <div style={styles.noteEditor}>
              <label htmlFor="note-title" style={styles.fieldLabel}>
                Título
              </label>
              <input
                id="note-title"
                value={selectedNote.title}
                onChange={(event) => updateSelectedNote({ title: event.target.value })}
                placeholder="Título de la nota"
                style={styles.input}
              />

              <label htmlFor="note-content" style={styles.fieldLabel}>
                Contenido
              </label>
              <textarea
                id="note-content"
                value={selectedNote.content}
                onChange={(event) => updateSelectedNote({ content: event.target.value })}
                placeholder="Escribe tu nota..."
                rows={14}
                style={styles.noteTextarea}
              />

              <div style={styles.noteActions} className="noteActions">
                <button
                  type="button"
                  style={styles.ghostBtn}
                  onClick={() => updateSelectedNote({ pinned: !selectedNote.pinned })}
                  aria-pressed={selectedNote.pinned}
                >
                  <Pin
                    aria-hidden="true"
                    size={14}
                    strokeWidth={1.8}
                    fill={selectedNote.pinned ? "currentColor" : "none"}
                  />
                  {selectedNote.pinned ? "Desfijar" : "Fijar"}
                </button>
                <button type="button" style={styles.dangerBtn} onClick={deleteSelectedNote}>
                  Eliminar
                </button>
              </div>

              <div style={styles.noteMeta}>
                <span>Modificada: {formatNoteDate(selectedNote.updatedAt)}</span>
                <span
                  aria-live="polite"
                  style={{ color: storageStatus === "error" ? "#b91c1c" : "#15803d" }}
                >
                  {storageStatus === "saved" && (
                    <span style={styles.statusWithIcon}>
                      <CircleCheckBig aria-hidden="true" size={13} strokeWidth={1.8} />
                      Guardado automático
                    </span>
                  )}
                  {storageStatus === "error" && "No se pudo guardar en este navegador"}
                </span>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={{ fontWeight: 650 }}>Selecciona o crea una nota</div>
              <div style={styles.p}>El editor aparecerá aquí.</div>
              <button type="button" style={styles.primaryBtnSmall} onClick={createNote}>
                <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
                Crear mi primera nota
              </button>
            </div>
          )}
        </Block>
      </div>
    </div>
  );
}

/* ============================================================
   SECCION: Memories (placeholder)
   ------------------------------------------------------------
   Aquí luego puedes meter upload de fotos + texto
   (con localStorage o ya con Firebase Storage).
   ============================================================ */
function Memories() {
  return (
    <div style={styles.stack}>
      <Block title={<SectionTitle icon={Camera} label="Recuerdos" color="#7e22ce" />}>
        <div style={styles.p}>Después metere para subir fotos y escribirte una mini-carta.</div>
      </Block>
    </div>
  );
}

/* ============================================================
   SECCION: Pinterest (embed de boards públicos)
   ------------------------------------------------------------
   Idea:
   - boards: lista de boards públicos con name + url
   - activeBoard: URL del board seleccionado
   - Tabs: botones para cambiar activeBoard
   - Embed: <a data-pin-do="embedBoard" ... href={activeBoard}>
   - Script oficial pinit.js convierte ese <a> en widget visual.
   ============================================================ */
function Pinterest() {
  // Lista de boards (puedes meter más)
  const boards = [
    {
      name: "My way",
      url: "https://mx.pinterest.com/cosmologyp/my-way/",
    },
  ];

  // Board activo
  const [activeBoard, setActiveBoard] = useState(boards[0]?.url ?? "");
  const [widgetStatus, setWidgetStatus] = useState("loading");

  /**
   * (A) Cargar el script oficial UNA SOLA VEZ:
   * - Si ya existe, no lo vuelve a meter.
   */
  useEffect(() => {
    const id = "pinterest-widget-js";
    let script = document.getElementById(id);

    const handleLoad = () => setWidgetStatus("ready");
    const handleError = () => setWidgetStatus("error");

    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.async = true;
      script.defer = true;
      script.src = "https://assets.pinterest.com/js/pinit.js";
      document.body.appendChild(script);
    }

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (window.PinUtils?.build) {
      handleLoad();
    }

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  /**
   * (B) Cada vez que cambie activeBoard:
   * - Intentamos que Pinterest reconstruya el widget (PinUtils.build)
   * - setTimeout da tiempo a React a renderizar el <a> antes del build()
   */
  useEffect(() => {
    if (widgetStatus !== "ready") return undefined;

    const t = setTimeout(() => {
      try {
        if (window.PinUtils && window.PinUtils.build) {
          window.PinUtils.build();
        }
      } catch (e) {
        console.warn("Pinterest build error:", e);
      }
    }, 150);

    return () => clearTimeout(t);
  }, [activeBoard, widgetStatus]);

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={Pin} label="Pinterest" color="#be123c" />}
        right={<span style={{ fontSize: 12, color: "#6b7280" }}>Boards</span>}
      >
        <div style={styles.p}>Selecciona uno y aqui se te mostrará el contenido jiji.</div>

        {/* Tabs (botones) */}
        <div style={styles.boardTabs}>
          {boards.map((b) => {
            const isActive = b.url === activeBoard;
            return (
              <button
                type="button"
                key={b.url}
                onClick={() => setActiveBoard(b.url)}
                aria-pressed={isActive}
                className={`boardTab${isActive ? " boardTabActive" : ""}`}
                style={{ ...styles.tabBtn, ...(isActive ? styles.tabBtnActive : {}) }}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </Block>

      <Block title="Vista del board">
        {/* key={activeBoard} fuerza remount: React destruye y crea de nuevo
            el <a>, ayudando a Pinterest a detectar el cambio */}
        <div key={activeBoard} className="pinterestEmbed">
          <a
            data-pin-do="embedBoard"
            data-pin-board-width="900"
            data-pin-scale-height="900"
            data-pin-scale-width="115"
            href={activeBoard}
            aria-label="Abrir el board seleccionado en Pinterest"
          >
            Ver en Pinterest
          </a>
        </div>

        {widgetStatus === "error" && (
          <div role="status" style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
            No se pudo cargar Pinterest. Puedes abrir el board con el enlace de arriba.
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Si tarda, cambia de tab y vuelve (Pinterest a veces se pone lento).
        </div>
      </Block>
    </div>
  );
}

/* ============================================================
   STYLES (design system en JS)
   ------------------------------------------------------------
   Esto es un objeto con estilos inline.
   Ventajas:
   - Todo en un solo archivo (rápido para prototipo)
   Desventajas:
   - Crece rápido; luego conviene CSS/Tailwind o componentes separados.
   ============================================================ */

