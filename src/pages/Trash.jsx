import { useMemo, useState } from "react";
import {
  Camera,
  FolderOpen,
  ListTodo,
  NotebookPen,
  RefreshCcw,
  Trash2,
  WifiOff,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { useWorkspace } from "../workspace/workspaceContext.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;

const FILTERS = [
  { id: "all", label: "Todo" },
  { id: "memories", label: "Recuerdos" },
  { id: "notes", label: "Notas" },
  { id: "tasks", label: "Tareas" },
];

function getItemIcon(type) {
  if (type === "album") return FolderOpen;
  if (type === "memory") return Camera;
  if (type === "note") return NotebookPen;
  return ListTodo;
}

function getItemTitle(item) {
  if (item.type === "album") return item.data.title || "Álbum sin nombre";
  if (item.type === "memory") return item.data.title || "Fotografía";
  if (item.type === "note") return item.data.title || "Nota sin título";
  return item.data.text || "Tarea sin nombre";
}

function getItemSubtitle(item, allItems) {
  if (item.type === "album") {
    const deletedPhotos = allItems.filter(
      (candidate) => candidate.type === "memory" && candidate.data?.albumId === item.id,
    ).length;
    const count = (item.memories?.length ?? 0) + deletedPhotos;
    return `${count} ${count === 1 ? "foto" : "fotos"}`;
  }
  if (item.type === "memory") {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${item.data.memoryDate}T12:00:00`));
  }
  if (item.type === "note") {
    return item.data.content?.trim() || "Nota vacía";
  }
  return item.data.dueDate
    ? `Programada para ${item.data.dueDate.split("-").reverse().join("/")}`
    : "Sin fecha";
}

function getPreview(item) {
  if (item.type === "memory") return item.data.imageUrl;
  if (item.type !== "album") return null;
  const memories = item.memories ?? [];
  return memories.find((memory) => memory.id === item.data.coverMemoryId)?.imageUrl
    ?? memories.at(-1)?.imageUrl
    ?? null;
}

function getRemainingCopy(deletedAt) {
  const remaining = Math.max(
    0,
    Math.ceil((new Date(deletedAt).getTime() + RETENTION_MS - Date.now()) / DAY_MS),
  );
  if (remaining === 0) return "Se eliminará pronto";
  if (remaining === 1) return "Queda 1 día";
  return `Quedan ${remaining} días`;
}

export default function Trash() {
  const {
    emptyTrash,
    offlineMode,
    permanentlyDeleteTrashItem,
    restoreTrashItem,
    trash,
  } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [actionKey, setActionKey] = useState("");
  const [error, setError] = useState("");

  const visibleItems = useMemo(() => {
    const trashedAlbumIds = new Set(
      trash.filter((item) => item.type === "album").map((item) => item.id),
    );
    return trash.filter((item) => {
      if (item.type === "memory" && trashedAlbumIds.has(item.data.albumId)) return false;
      if (filter === "memories") return item.type === "album" || item.type === "memory";
      if (filter === "notes") return item.type === "note";
      if (filter === "tasks") return item.type === "task";
      return true;
    });
  }, [filter, trash]);

  async function restore(item) {
    const key = `restore-${item.type}-${item.id}`;
    setActionKey(key);
    setError("");
    const restored = await restoreTrashItem(item.type, item.id);
    if (!restored) setError("No pudimos restaurar ese elemento. Inténtalo otra vez.");
    setActionKey("");
  }

  async function removeForever(item) {
    const title = getItemTitle(item);
    const confirmed = window.confirm(
      `¿Eliminar “${title}” para siempre? Esta acción ya no se puede deshacer.`,
    );
    if (!confirmed) return;

    const key = `delete-${item.type}-${item.id}`;
    setActionKey(key);
    setError("");
    const removed = await permanentlyDeleteTrashItem(item.type, item.id);
    if (!removed) setError("No pudimos eliminar ese elemento para siempre.");
    setActionKey("");
  }

  async function removeEverything() {
    if (!trash.length) return;
    if (!window.confirm("¿Vaciar toda la papelera? Esta acción no se puede deshacer.")) return;
    setActionKey("empty");
    setError("");
    const removed = await emptyTrash();
    if (!removed) setError("No pudimos vaciar toda la papelera.");
    setActionKey("");
  }

  return (
    <div style={styles.stack} className="trashPage">
      <Block
        title={<SectionTitle icon={Trash2} label="Papelera" color="#64748b" />}
        right={trash.length > 0 ? (
          <button
            type="button"
            className="trashEmptyButton"
            onClick={() => void removeEverything()}
            disabled={Boolean(actionKey) || offlineMode}
            title={offlineMode ? "Necesitas internet para vaciarla" : undefined}
          >
            <Trash2 aria-hidden="true" size={15} />
            {actionKey === "empty" ? "Vaciando..." : "Vaciar"}
          </button>
        ) : null}
      >
        <div className="trashIntro">
          <p>Lo que elimines se guarda aquí durante 30 días por si cambias de opinión.</p>
          {offlineMode && (
            <span><WifiOff aria-hidden="true" size={14} /> Restaurar funciona sin internet.</span>
          )}
        </div>
      </Block>

      <div className="trashFilters" role="tablist" aria-label="Filtrar papelera">
        {FILTERS.map((option) => (
          <button
            type="button"
            role="tab"
            aria-selected={filter === option.id}
            key={option.id}
            className={filter === option.id ? "trashFilterActive" : ""}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <div className="trashError" role="alert">{error}</div>}

      {visibleItems.length === 0 ? (
        <Block>
          <div className="trashEmptyState">
            <span><Trash2 aria-hidden="true" size={27} strokeWidth={1.5} /></span>
            <strong>{trash.length === 0 ? "La papelera está vacía" : "Nada por aquí"}</strong>
            <p>
              {trash.length === 0
                ? "Los elementos que elimines aparecerán aquí."
                : "No hay elementos de este tipo."}
            </p>
          </div>
        </Block>
      ) : (
        <div className="trashList">
          {visibleItems.map((item) => {
            const Icon = getItemIcon(item.type);
            const preview = getPreview(item);
            const restoring = actionKey === `restore-${item.type}-${item.id}`;
            const deleting = actionKey === `delete-${item.type}-${item.id}`;
            return (
              <article className="trashCard" key={`${item.type}-${item.id}`}>
                <div className={`trashPreview${preview ? " trashPreviewPhoto" : ""}`}>
                  {preview ? (
                    <img src={preview} alt="" />
                  ) : (
                    <Icon aria-hidden="true" size={22} strokeWidth={1.6} />
                  )}
                </div>
                <div className="trashCardBody">
                  <div className="trashCardCopy">
                    <strong>{getItemTitle(item)}</strong>
                    <span>{getItemSubtitle(item, trash)}</span>
                    <small>{getRemainingCopy(item.deletedAt)}</small>
                  </div>
                  <div className="trashCardActions">
                    <button
                      type="button"
                      className="trashRestoreButton"
                      onClick={() => void restore(item)}
                      disabled={Boolean(actionKey)}
                    >
                      <RefreshCcw aria-hidden="true" size={15} />
                      {restoring ? "Restaurando..." : "Restaurar"}
                    </button>
                    <button
                      type="button"
                      className="trashDeleteButton"
                      onClick={() => void removeForever(item)}
                      disabled={Boolean(actionKey) || offlineMode}
                      aria-label={`Eliminar ${getItemTitle(item)} para siempre`}
                      title={offlineMode ? "Necesitas internet para eliminar para siempre" : undefined}
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      <span>{deleting ? "Eliminando..." : "Para siempre"}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
