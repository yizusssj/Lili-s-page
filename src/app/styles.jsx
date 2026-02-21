
export const styles = {
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
}