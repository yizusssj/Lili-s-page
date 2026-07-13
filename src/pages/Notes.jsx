import { useMemo, useState } from "react";
import {
  CircleCheckBig,
  LoaderCircle,
  NotebookPen,
  Pin,
  Plus,
  Search,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { formatNoteDate } from "../utils/date.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

export default function Notes() {
  const {
    createNote,
    notes,
    removeNote,
    saving,
    syncError,
    updateNoteDraft,
  } = useWorkspace();
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function handleCreateNote() {
    if (creating) return;
    setCreating(true);
    const note = await createNote();
    if (note) setSelectedId(note.id);
    setQuery("");
    setCreating(false);
  }

  function updateSelectedNote(fields) {
    if (!selectedNote) return;
    updateNoteDraft(selectedNote.id, fields);
  }

  async function deleteSelectedNote() {
    if (!selectedNote) return;
    const label = selectedNote.title.trim() || "Sin título";
    if (!window.confirm(`¿Eliminar la nota “${label}”? Esta acción no se puede deshacer.`)) return;

    const nextNotes = notes.filter((note) => note.id !== selectedNote.id);
    setSelectedId(nextNotes[0]?.id ?? null);
    await removeNote(selectedNote.id);
  }

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={NotebookPen} label="Notas" color="#1d4ed8" />}
        right={
          <button
            type="button"
            style={styles.primaryBtnSmall}
            onClick={() => void handleCreateNote()}
            disabled={creating}
          >
            <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
            {creating ? "Creando..." : "Nueva nota"}
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
                    style={{ ...styles.noteCard, ...(isSelected ? styles.noteCardActive : {}) }}
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
                    <span style={styles.notePreview}>{note.content.trim() || "Nota vacía"}</span>
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
                maxLength={200}
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
                maxLength={100000}
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
                <button
                  type="button"
                  style={styles.dangerBtn}
                  onClick={() => void deleteSelectedNote()}
                >
                  Eliminar
                </button>
              </div>

              <div style={styles.noteMeta}>
                <span>Modificada: {formatNoteDate(selectedNote.updatedAt)}</span>
                <span
                  aria-live="polite"
                  style={{ color: syncError ? "#b91c1c" : "#15803d" }}
                >
                  {saving && !syncError && (
                    <span style={styles.statusWithIcon}>
                      <LoaderCircle
                        aria-hidden="true"
                        className="syncSpinner"
                        size={13}
                        strokeWidth={1.8}
                      />
                      Guardando...
                    </span>
                  )}
                  {!saving && !syncError && (
                    <span style={styles.statusWithIcon}>
                      <CircleCheckBig aria-hidden="true" size={13} strokeWidth={1.8} />
                      Sincronizado
                    </span>
                  )}
                  {syncError && "Pendiente de sincronizar"}
                </span>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={{ fontWeight: 650 }}>Selecciona o crea una nota</div>
              <div style={styles.p}>El editor aparecerá aquí.</div>
              <button
                type="button"
                style={styles.primaryBtnSmall}
                onClick={() => void handleCreateNote()}
                disabled={creating}
              >
                <Plus aria-hidden="true" size={15} strokeWidth={1.9} />
                {creating ? "Creando..." : "Crear mi primera nota"}
              </button>
            </div>
          )}
        </Block>
      </div>
    </div>
  );
}
