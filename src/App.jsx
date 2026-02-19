/**
 * App.jsx (anotado)
 * ------------------------------------------------------------
 * Idea general:
 * - Esto es una SPA (Single Page App) en React SIN react-router.
 * - La “navegación” se hace con un estado `active` que decide qué componente se renderiza.
 * - Persistencia: usamos localStorage para que tareas/prioridades/notas se queden aunque cierres el navegador.
 * - UI: usamos estilos inline en el objeto `styles` para un look Notion/iOS.
 */

import { useMemo, useState, useEffect } from "react";

/**
 * PAGES = “catálogo” de pantallas.
 * - id: identificador interno para comparar (active === "today", etc.)
 * - name: nombre mostrado en el header
 * - icon: icono para el botón de la sidebar
 *
 * Ventaja:
 * - No hardcodeas botones, los generas con .map()
 * - Si agregas una nueva pantalla, solo agregas un objeto aquí.
 */
const PAGES = [
  { id: "today", name: "Hoy", icon: "✨" },
  { id: "tasks", name: "Tareas", icon: "✅" },
  { id: "notes", name: "Notas", icon: "📝" },
  { id: "memories", name: "Recuerdos", icon: "📷" },
  { id: "pinterest", name: "Pinterest", icon: "📌" },
];

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
    <div style={styles.app}>
      {/* ============== SIDEBAR (navegación) ============== */}
      <aside style={styles.sidebar}>
        {/* Branding / “logo” */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>💗</div>
          <div>
            <div style={styles.brandTitle}>Workspace</div>
            <div style={styles.brandSub}>para ella</div>
          </div>
        </div>

        {/* Menú: se genera a partir de PAGES */}
        <nav style={styles.nav}>
          {PAGES.map((p) => {
            const isActive = p.id === active; // ¿este botón es el seleccionado?
            return (
              <button
                key={p.id} // clave única requerida en listas
                onClick={() => setActive(p.id)} // cambia pantalla
                style={{
                  ...styles.navItem, // estilos base
                  ...(isActive ? styles.navItemActive : {}), // estilos cuando está activo
                }}
              >
                <span style={{ width: 22, textAlign: "center" }}>{p.icon}</span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer de sidebar (textito / tip) */}
        <div style={styles.sidebarFooter}>
          <div style={styles.tipTitle}>Tip</div>
          <div style={styles.tipText}>keep it real chaval.</div>
        </div>
      </aside>

      {/* ============== MAIN (contenido) ============== */}
      <main style={styles.main}>
        {/* Header principal: muestra el nombre de la página activa */}
        <header style={styles.header}>
          <div>
            <div style={styles.pageTitle}>{activePage?.name ?? "Página"}</div>
            <div style={styles.pageSubtitle}>Organizador texto de ejemplo</div>
          </div>
        </header>

        {/* Render condicional (router casero):
            Solo se monta el componente que coincide con `active`. */}
        <section style={styles.content}>
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
    <section style={styles.block}>
      <div style={styles.blockTop}>
        <div>
          <div style={styles.blockTitle}>{title}</div>
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
  // Keys para localStorage (persistencia en el navegador)
  const STORAGE_KEY = "lili_today_top3_v1"; // prioridades (array)
  const DATE_KEY = "lili_today_date_v1"; // fecha del último día registrado

  // YYYY-MM-DD (sirve para detectar cambio de día)
  const todayStr = new Date().toISOString().slice(0, 10);

  /**
   * items = arreglo de prioridades:
   * [{ id, text, done }, ...]
   *
   * Nota: usamos función en useState para que localStorage se lea
   * solo una vez al montar el componente.
   */
  const [items, setItems] = useState(() => {
    try {
      const lastDate = localStorage.getItem(DATE_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);

      // Si había algo guardado, lo usa; si no, crea defaults
      let initial = raw
        ? JSON.parse(raw)
        : [
            { id: crypto.randomUUID(), text: "Prioridad 1", done: false },
            { id: crypto.randomUUID(), text: "Prioridad 2", done: false },
            { id: crypto.randomUUID(), text: "Prioridad 3", done: false },
          ];

      // Reset diario: si cambió el día, reset solo `done`
      if (lastDate !== todayStr) {
        initial = initial.map((x) => ({ ...x, done: false }));
        localStorage.setItem(DATE_KEY, todayStr);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      }

      return initial;
    } catch {
      // Si falla parseo o localStorage, regresa defaults
      return [
        { id: crypto.randomUUID(), text: "Prioridad 1", done: false },
        { id: crypto.randomUUID(), text: "Prioridad 2", done: false },
        { id: crypto.randomUUID(), text: "Prioridad 3", done: false },
      ];
    }
  });

  /**
   * Guardado automático de prioridades:
   * - Cuando items cambia, lo serializamos y guardamos.
   * OJO: Esto es efecto secundario -> se hace con useEffect (correcto).
   */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

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
    localStorage.setItem(DATE_KEY, todayStr);
  }

  return (
    <div style={styles.stack}>
      {/* Bloque de bienvenida */}
      <Block title="Hoy ✨">
        <div style={styles.p}>
          Bienvenida. Aquí vas a tener tu día clarito: prioridades, notas y cositas bonitas.
        </div>
      </Block>

      {/* Grid en 2 columnas: Prioridades + Nota rápida */}
      <div style={styles.grid2}>
        {/* ================= Top 3 Prioridades (con drag & drop) ================= */}
        <Block
          title="Top 3 prioridades"
          right={
            <button style={styles.ghostBtn} onClick={resetToday} title="Reinicia checks de hoy">
              Reiniciar hoy
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it, idx) => (
              <div
                key={it.id}
                style={styles.dragRow}
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

                  setItems((prev) => {
                    const copy = [...prev];
                    const [moved] = copy.splice(from, 1);
                    copy.splice(to, 0, moved);
                    return copy;
                  });
                }}
              >
                {/* Handle visual para indicar que se puede arrastrar */}
                <span style={styles.dragHandle} title="Arrastra para reordenar">
                  ⋮⋮
                </span>

                {/* Checkbox + input editable */}
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => toggle(it.id)}
                    style={{ width: 16, height: 16 }}
                  />
                  <input
                    value={it.text}
                    onChange={(e) => updateText(it.id, e.target.value)}
                    placeholder={`Prioridad ${idx + 1}`}
                    style={{
                      ...styles.inlineInput,
                      textDecoration: it.done ? "line-through" : "none",
                      color: it.done ? "#6b7280" : "#111827",
                    }}
                  />
                </label>
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
        <div style={styles.p}>“Un día a la vez, pero contigo todo se siente más ligero.” 🌷</div>
      </Block>
    </div>
  );
}

/* ============================================================
   COMPONENTE: QuickNote
   ------------------------------------------------------------
   Mini nota guardable en localStorage con botón Guardar:
   - text: contenido
   - saved: flag para mostrar “Guardado ✓” temporal
   ============================================================ */
function QuickNote() {
  const STORAGE_KEY = "lili_quick_note_v1";

  // Carga inicial desde localStorage (solo una vez)
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // Para UX: mensaje “Guardado ✓”
  const [saved, setSaved] = useState(false);

  // Guardar manual
  function save() {
    localStorage.setItem(STORAGE_KEY, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  return (
    <>
      <textarea
        placeholder="Escribe algo..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={styles.textarea}
        rows={6}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button style={styles.primaryBtn} onClick={save}>
          Guardar
        </button>

        {saved && <span style={{ fontSize: 12, color: "#16a34a" }}>Guardado ✓</span>}
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
  const STORAGE_KEY = "lili_tasks_v1";

  // input controlado (lo que escribes antes de “Añadir”)
  const [newTask, setNewTask] = useState("");

  // tasks: carga desde localStorage o defaults
  const [tasks, setTasks] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? JSON.parse(raw)
        : [
            { id: crypto.randomUUID(), text: "Hacer tarea", done: false },
            { id: crypto.randomUUID(), text: "Tomar agua", done: false },
            { id: crypto.randomUUID(), text: "Tiempo para mí", done: false },
          ];
    } catch {
      return [];
    }
  });

  // Persistencia: cuando tasks cambia, guarda JSON en localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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
        title="Tareas ✅"
        right={
          <button style={styles.ghostBtn} onClick={clearDone}>
            Limpiar hechas
          </button>
        }
      >
        {/* Input + botón */}
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => {
              // UX: Enter para agregar
              if (e.key === "Enter") addTask();
            }}
            placeholder="Agregar tarea..."
            style={styles.input}
          />
          <button style={styles.primaryBtnSmall} onClick={addTask}>
            + Añadir
          </button>
        </div>

        {/* Contador */}
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          Pendientes: <b style={{ color: "#111827" }}>{remaining}</b>
        </div>

        {/* Lista de tareas */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.length === 0 ? (
            <div style={styles.p}>Sin tareas por ahora ✨</div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} style={styles.taskRow}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
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

                <button onClick={() => deleteTask(t.id)} style={styles.iconBtn} title="Eliminar">
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </Block>

      {/* Placeholder: lista sugerida */}
      <Block title="Listas sugeridas">
        <ul style={styles.list}>
          <li>• Escuela</li>
          <li>• Personal</li>
          <li>• Casa</li>
          <li>• Recurrentes</li>
        </ul>
      </Block>
    </div>
  );
}

/* ============================================================
   PÁGINA: Notes (placeholder)
   ------------------------------------------------------------
   Por ahora solo muestra texto. Después puedes convertirlo
   en un CRUD de notas como en Notion.
   ============================================================ */
function Notes() {
  return (
    <div style={styles.stack}>
      <Block title="Notas 📝">
        <div style={styles.p}>Luego sera con guardado automatico.</div>
      </Block>
      <Block title="Ejemplo">
        <div style={styles.p}>Idea: “cosas que no debo olvidar esta semana…”</div>
      </Block>
    </div>
  );
}

/* ============================================================
   PÁGINA: Memories (placeholder)
   ------------------------------------------------------------
   Aquí luego puedes meter upload de fotos + texto
   (con localStorage o ya con Firebase Storage).
   ============================================================ */
function Memories() {
  return (
    <div style={styles.stack}>
      <Block title="Recuerdos 📷">
        <div style={styles.p}>Después metere para subir fotos y escribirte una mini-carta.</div>
      </Block>
    </div>
  );
}

/* ============================================================
   PÁGINA: Pinterest (embed de boards públicos)
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
      name: "my way 🎤💵💚🧑‍🧑‍🧒‍🧒🫂📈🖥️",
      url: "https://mx.pinterest.com/cosmologyp/my-way/?invite_code=f8fc181c5c89425d8678b9a160f0eaad&sender=697002617238299353",
    },
  ];

  // Board activo
  const [activeBoard, setActiveBoard] = useState(boards[0]?.url ?? "");

  /**
   * (A) Cargar el script oficial UNA SOLA VEZ:
   * - Si ya existe, no lo vuelve a meter.
   */
  useEffect(() => {
    const id = "pinterest-widget-js";
    if (document.getElementById(id)) return;

    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.defer = true;
    s.src = "https://assets.pinterest.com/js/pinit.js";
    document.body.appendChild(s);
  }, []);

  /**
   * (B) Cada vez que cambie activeBoard:
   * - Intentamos que Pinterest reconstruya el widget (PinUtils.build)
   * - setTimeout da tiempo a React a renderizar el <a> antes del build()
   */
  useEffect(() => {
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
  }, [activeBoard]);

  return (
    <div style={styles.stack}>
      <Block title="Pinterest 📌" right={<span style={{ fontSize: 12, color: "#6b7280" }}>Boards</span>}>
        <div style={styles.p}>Selecciona uno y aqui se te mostrará el contenido jiji.</div>

        {/* Tabs (botones) */}
        <div style={styles.boardTabs}>
          {boards.map((b) => {
            const isActive = b.url === activeBoard;
            return (
              <button
                key={b.url}
                onClick={() => setActiveBoard(b.url)}
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
        <div key={activeBoard}>
          <a
            data-pin-do="embedBoard"
            data-pin-board-width="900"
            data-pin-scale-height="900"
            data-pin-scale-width="115"
            href={activeBoard}
          >
            Ver en Pinterest
          </a>
        </div>

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
const styles = {
  /* Layout general */
  app: {
    minHeight: "100vh",
    background: "#E5E5EA", // iOS gray
    color: "#111827",
    display: "flex",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  },

  /* Sidebar */
  sidebar: {
    width: 270,
    padding: 16,
    borderRight: "1px solid #e7e5e4",
    background: "#E5E5EA",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #eee",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  },
  brandTitle: { fontWeight: 650, fontSize: 14 },
  brandSub: { fontSize: 12, color: "#6b7280" },

  /* Navegación */
  nav: { display: "flex", flexDirection: "column", gap: 6 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 10,
    border: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
    color: "#111827",
    textAlign: "left",
  },

  // Estilo cuando la pestaña está seleccionada
  navItemActive: {
    background: "#962626", // (si quieres iOS/notion, aquí conviene un gris/negro suave)
    border: "1px solid #eee",
    boxShadow: "4px 6px 12px rgba(0,0,0,0.08)",
  },

  /* Footer sidebar */
  sidebarFooter: {
    marginTop: "auto",
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #eee",
  },
  tipTitle: { fontSize: 12, fontWeight: 650, marginBottom: 4 },
  tipText: { fontSize: 12, color: "#6b7280", lineHeight: 1.35 },

  /* Main y header */
  main: { flex: 1, display: "flex", flexDirection: "column" },
  header: {
    padding: "22px 26px",
    borderBottom: "1px solid #e7e5e4",
    background: "#E5E5EA",
  },
  pageTitle: { fontSize: 22, fontWeight: 750 },
  pageSubtitle: { fontSize: 12, color: "#6b7280", marginTop: 4 },

  /* Contenedor de contenido */
  content: { padding: 26 },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },

  /* Bloques tipo Notion */
  block: {
    background: "#FFFFFF",
    border: "1px solid #D1D1D6",
    borderRadius: 14,
    padding: 14,
    boxShadow: "4px 6px 12px rgba(0,0,0,0.08)", // sombra direccional iOS-ish
  },
  blockTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  blockTitle: { fontSize: 13, fontWeight: 650, color: "#111827" },

  /* Texto general */
  p: { fontSize: 13, color: "#374151", lineHeight: 1.5 },
  list: { margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.65 },

  /* Textarea (QuickNote) */
  textarea: {
    width: "95%",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    outline: "none",
    resize: "vertical",
    background: "#fff",
  },

  /* Botón principal (Guardar nota rápida, etc.) */
  primaryBtn: {
    marginTop: 10,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#1c5ae0",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 650,
  },

  /* Inputs y botones de tareas */
  input: {
    flex: 1,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    background: "#fff",
  },
  primaryBtnSmall: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },
  ghostBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#111827",
  },

  /* Filas de tareas */
  taskRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #eee",
    background: "#fff",
  },

  /* Botón icono (bote de basura) */
  iconBtn: {
    border: "1px solid #eee",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: 12,
  },

  /* Drag & Drop prioridades */
  dragRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #eee",
    background: "#fff",
  },
  dragHandle: {
    width: 24,
    textAlign: "center",
    cursor: "grab",
    userSelect: "none",
    color: "#9ca3af",
    fontSize: 16,
    lineHeight: 1,
  },

  /* Input inline (texto editable en Top 3) */
  inlineInput: {
    flex: 1,
    border: "1px solid transparent",
    background: "transparent",
    outline: "none",
    fontSize: 13,
    padding: "2px 4px",
  },

  /* Tabs de Pinterest */
  boardTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tabBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#111827",
  },
  tabBtnActive: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
  },
};
