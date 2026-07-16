import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  FolderPlus,
  Heart,
  ImagePlus,
  Images,
  LoaderCircle,
  Pencil,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import MemoryCollage from "../components/MemoryCollage.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { formatCalendarDate, getLocalDateKey } from "../utils/date.js";
import { validateMemoryImage } from "../utils/images.js";
import {
  getMemoryUploadDiagnostic,
  getMemoryUploadErrorMessage,
  isBlockingMemoryUploadError,
} from "../utils/memoryUploadErrors.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const ALBUM_IDEAS = [
  { icon: Heart, label: "Nosotros" },
  { icon: UsersRound, label: "Amigos y familia" },
  { icon: Plane, label: "Viajes" },
  { icon: Sparkles, label: "Mis momentos" },
];

export default function Memories() {
  const {
    addAlbum,
    addMemory,
    albums,
    memories,
    removeAlbum,
    removeMemory,
    setAlbumCover,
    updateAlbum,
    updateMemory,
  } = useWorkspace();
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [albumFormOpen, setAlbumFormOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumError, setAlbumError] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [albumEditorOpen, setAlbumEditorOpen] = useState(false);
  const [editedAlbumTitle, setEditedAlbumTitle] = useState("");
  const [editedAlbumDescription, setEditedAlbumDescription] = useState("");
  const [albumEditorError, setAlbumEditorError] = useState("");
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [memoryFormOpen, setMemoryFormOpen] = useState(false);
  const [memoryDate, setMemoryDate] = useState(getLocalDateKey);
  const [files, setFiles] = useState([]);
  const [formError, setFormError] = useState("");
  const [formDiagnostic, setFormDiagnostic] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [deleting, setDeleting] = useState(false);
  const [changingCover, setChangingCover] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [editingMemoryDetails, setEditingMemoryDetails] = useState(false);
  const [editedMemoryTitle, setEditedMemoryTitle] = useState("");
  const [editedMemoryDescription, setEditedMemoryDescription] = useState("");
  const [memoryDetailsError, setMemoryDetailsError] = useState("");
  const [savingMemoryDetails, setSavingMemoryDetails] = useState(false);
  const closeButtonRef = useRef(null);
  const composerCloseRef = useRef(null);
  const albumEditorCloseRef = useRef(null);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const selectedMemory =
    memories.find((memory) => memory.id === selectedMemoryId) ?? null;
  const albumMemories = useMemo(
    () => memories
      .filter((memory) => memory.albumId === selectedAlbumId)
      .sort((first, second) => {
        const firstOrder = Number.isSafeInteger(first.sortOrder)
          ? first.sortOrder
          : Date.parse(first.createdAt ?? "") * 1000 || 0;
        const secondOrder = Number.isSafeInteger(second.sortOrder)
          ? second.sortOrder
          : Date.parse(second.createdAt ?? "") * 1000 || 0;
        return firstOrder - secondOrder
          || (first.createdAt ?? "").localeCompare(second.createdAt ?? "");
      }),
    [memories, selectedAlbumId],
  );
  const albumCards = useMemo(
    () =>
      albums.map((album) => {
        const photos = memories.filter((memory) => memory.albumId === album.id);
        const automaticCover = photos.reduce(
          (latest, photo) =>
            !latest || (photo.createdAt ?? "") > (latest.createdAt ?? "")
              ? photo
              : latest,
          null,
        );
        const selectedCover = album.coverMemoryId
          ? photos.find((photo) => photo.id === album.coverMemoryId)
          : null;
        return {
          ...album,
          cover: selectedCover ?? automaticCover,
          photoCount: photos.length,
        };
      }),
    [albums, memories],
  );
  const previewItems = useMemo(
    () => files.map((selectedFile) => ({
      file: selectedFile,
      url: URL.createObjectURL(selectedFile),
    })),
    [files],
  );

  useEffect(
    () => () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.url));
    },
    [previewItems],
  );

  useEffect(() => {
    if (!selectedMemory) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event) {
      if (
        event.key === "Escape"
        && !deleting
        && !changingCover
        && !savingMemoryDetails
      ) {
        setEditingMemoryDetails(false);
        setMemoryDetailsError("");
        setSelectedMemoryId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [changingCover, deleting, savingMemoryDetails, selectedMemory]);

  useEffect(() => {
    if (!memoryFormOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !uploading) {
        setMemoryDate(getLocalDateKey());
        setFiles([]);
        setFormError("");
        setFormDiagnostic("");
        setUploadProgress({ completed: 0, total: 0 });
        setMemoryFormOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [memoryFormOpen, uploading]);

  useEffect(() => {
    if (!memoryFormOpen) return undefined;
    const focusTimer = window.setTimeout(() => composerCloseRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [memoryFormOpen]);

  useEffect(() => {
    if (!albumEditorOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !savingAlbum && !deletingAlbum) {
        setAlbumEditorOpen(false);
        setAlbumEditorError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [albumEditorOpen, deletingAlbum, savingAlbum]);

  useEffect(() => {
    if (!albumEditorOpen) return undefined;
    const focusTimer = window.setTimeout(() => albumEditorCloseRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [albumEditorOpen]);

  function resetAlbumForm() {
    setAlbumTitle("");
    setAlbumDescription("");
    setAlbumError("");
  }

  function closeAlbumForm() {
    if (creatingAlbum) return;
    resetAlbumForm();
    setAlbumFormOpen(false);
  }

  async function submitAlbum(event) {
    event.preventDefault();
    if (!albumTitle.trim()) {
      setAlbumError("Escribe un nombre para el álbum.");
      return;
    }

    setCreatingAlbum(true);
    setAlbumError("");
    const result = await addAlbum({
      description: albumDescription,
      title: albumTitle,
    });
    setCreatingAlbum(false);

    if (result.error) {
      setAlbumError(
        result.error.code === "23505"
          ? "Ya existe un álbum con ese nombre."
          : result.error.message || "No se pudo crear el álbum.",
      );
      return;
    }

    resetAlbumForm();
    setAlbumFormOpen(false);
    setSelectedAlbumId(result.data.id);
  }

  function openAlbumEditor() {
    if (!selectedAlbum) return;
    setEditedAlbumTitle(selectedAlbum.title);
    setEditedAlbumDescription(selectedAlbum.description);
    setAlbumEditorError("");
    setAlbumEditorOpen(true);
  }

  function closeAlbumEditor() {
    if (savingAlbum || deletingAlbum) return;
    setAlbumEditorOpen(false);
    setAlbumEditorError("");
  }

  async function submitAlbumChanges(event) {
    event.preventDefault();
    if (!selectedAlbum || !editedAlbumTitle.trim()) {
      setAlbumEditorError("Escribe un nombre para el álbum.");
      return;
    }

    setSavingAlbum(true);
    setAlbumEditorError("");
    const result = await updateAlbum(selectedAlbum.id, {
      description: editedAlbumDescription,
      title: editedAlbumTitle,
    });
    setSavingAlbum(false);

    if (result.error) {
      setAlbumEditorError(
        result.error.code === "23505"
          ? "Ya existe otro álbum con ese nombre."
          : result.error.message || "No se pudo actualizar el álbum.",
      );
      return;
    }

    setAlbumEditorOpen(false);
  }

  async function deleteSelectedAlbum() {
    if (!selectedAlbum || deletingAlbum) return;
    const photoText =
      albumMemories.length === 0
        ? "El álbum está vacío."
        : albumMemories.length === 1
          ? "Su fotografía quedará guardada dentro del álbum."
          : `Sus ${albumMemories.length} fotografías quedarán guardadas dentro del álbum.`;
    const confirmed = window.confirm(
      `¿Mover el álbum “${selectedAlbum.title}” a la papelera? ${photoText} Podrás recuperarlo durante 30 días.`,
    );
    if (!confirmed) return;

    setDeletingAlbum(true);
    setAlbumEditorError("");
    const removed = await removeAlbum(selectedAlbum.id);
    setDeletingAlbum(false);

    if (!removed) {
      setAlbumEditorError("No se pudo eliminar el álbum. Inténtalo nuevamente.");
      return;
    }

    setAlbumEditorOpen(false);
    setSelectedAlbumId(null);
  }

  function resetMemoryForm() {
    setMemoryDate(getLocalDateKey());
    setFiles([]);
    setFormError("");
    setFormDiagnostic("");
    setUploadProgress({ completed: 0, total: 0 });
  }

  function closeMemoryForm() {
    if (uploading) return;
    resetMemoryForm();
    setMemoryFormOpen(false);
  }

  function openAlbum(albumId) {
    closeMemoryForm();
    setSelectedAlbumId(albumId);
  }

  function leaveAlbum() {
    closeMemoryForm();
    setSelectedAlbumId(null);
  }

  function selectFiles(nextFiles) {
    const selectedFiles = Array.from(nextFiles ?? []);
    if (selectedFiles.length === 0) {
      setFiles([]);
      setFormError("");
      setFormDiagnostic("");
      return;
    }

    try {
      selectedFiles.forEach((nextFile) => validateMemoryImage(nextFile));
      setFiles(selectedFiles);
      setFormError("");
      setFormDiagnostic("");
    } catch (error) {
      setFiles([]);
      setFormError(error instanceof Error ? error.message : "Fotografía no válida.");
      setFormDiagnostic("");
    }
  }

  async function submitMemories(event) {
    event.preventDefault();

    if (!selectedAlbum) {
      setFormError("Primero selecciona un álbum.");
      return;
    }
    if (files.length === 0) {
      setFormError("Selecciona al menos una fotografía.");
      return;
    }
    if (!memoryDate || memoryDate > getLocalDateKey()) {
      setFormError("Selecciona una fecha válida que no esté en el futuro.");
      return;
    }

    setUploading(true);
    setFormError("");
    setFormDiagnostic("");
    setUploadProgress({ completed: 0, total: files.length });
    const failedFiles = [];
    let completed = 0;
    let firstError = null;
    const lastSortOrder = albumMemories.reduce((highest, memory) => {
      const candidate = Number.isSafeInteger(memory.sortOrder)
        ? memory.sortOrder
        : Date.parse(memory.createdAt ?? "") * 1000 || 0;
      return Math.max(highest, candidate);
    }, 0);
    const firstSortOrder = Math.max(Date.now() * 1000, lastSortOrder + 1);

    for (let index = 0; index < files.length; index += 1) {
      const selectedFile = files[index];
      const result = await addMemory({
        albumId: selectedAlbum.id,
        description: "",
        file: selectedFile,
        memoryDate,
        sortOrder: firstSortOrder + index,
        title: "",
      });

      if (result.error) {
        failedFiles.push(selectedFile);
        firstError ??= result.error;

        if (isBlockingMemoryUploadError(result.error)) {
          failedFiles.push(...files.slice(index + 1));
          setUploadProgress({ completed, total: files.length });
          break;
        }
      } else {
        completed += 1;
      }
      setUploadProgress({ completed, total: files.length });
    }

    setUploading(false);

    if (failedFiles.length > 0) {
      setFiles(failedFiles);
      setUploadProgress({ completed: 0, total: failedFiles.length });
      const errorMessage = getMemoryUploadErrorMessage(firstError);
      setFormDiagnostic(getMemoryUploadDiagnostic(firstError));
      setFormError(
        completed > 0
          ? `Se guardaron ${completed} de ${files.length}. ${errorMessage}`
          : errorMessage,
      );
      return;
    }

    resetMemoryForm();
    setMemoryFormOpen(false);
  }

  function openMemory(memoryId) {
    const memory = memories.find((item) => item.id === memoryId);
    if (!memory) return;
    setEditedMemoryTitle(memory.title ?? "");
    setEditedMemoryDescription(memory.description ?? "");
    setMemoryDetailsError("");
    setEditingMemoryDetails(false);
    setSelectedMemoryId(memoryId);
  }

  function closeSelectedMemory() {
    if (deleting || changingCover || savingMemoryDetails) return;
    setEditingMemoryDetails(false);
    setMemoryDetailsError("");
    setSelectedMemoryId(null);
  }

  async function submitMemoryDetails(event) {
    event.preventDefault();
    if (!selectedMemory || savingMemoryDetails) return;

    setSavingMemoryDetails(true);
    setMemoryDetailsError("");
    const result = await updateMemory(selectedMemory.id, {
      description: editedMemoryDescription,
      title: editedMemoryTitle,
    });
    setSavingMemoryDetails(false);

    if (result.error) {
      setMemoryDetailsError(
        result.error.message || "No se pudieron guardar los detalles.",
      );
      return;
    }

    setEditingMemoryDetails(false);
  }

  async function deleteSelectedMemory() {
    if (!selectedMemory || deleting) return;
    const memoryName = selectedMemory.title || formatCalendarDate(selectedMemory.memoryDate);
    const confirmed = window.confirm(
      `¿Mover “${memoryName}” a la papelera? Podrás recuperar la fotografía durante 30 días.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    const removed = await removeMemory(selectedMemory.id);
    setDeleting(false);
    if (removed) setSelectedMemoryId(null);
  }

  async function toggleSelectedCover() {
    if (!selectedAlbum || !selectedMemory || changingCover) return;
    const nextCoverId =
      selectedAlbum.coverMemoryId === selectedMemory.id ? null : selectedMemory.id;

    setChangingCover(true);
    await setAlbumCover(selectedAlbum.id, nextCoverId);
    setChangingCover(false);
  }

  return (
    <div style={styles.stack}>
      {!selectedAlbum && albumFormOpen && (
        <Block title="Crear un álbum">
          <form className="albumForm" onSubmit={(event) => void submitAlbum(event)}>
            <div className="albumFormIntro" aria-hidden="true">
              <FolderPlus size={31} strokeWidth={1.5} />
              <strong>Una nueva colección</strong>
              <span>El tema, las personas y los momentos los eliges tú.</span>
            </div>
            <div className="memoryFields">
              <label htmlFor="album-title" style={styles.fieldLabel}>
                Nombre del álbum
              </label>
              <input
                id="album-title"
                value={albumTitle}
                onChange={(event) => setAlbumTitle(event.target.value)}
                placeholder="Viaje a la playa"
                maxLength={80}
                style={styles.input}
                disabled={creatingAlbum}
                autoFocus
              />

              <label htmlFor="album-description" style={styles.fieldLabel}>
                Descripción <span className="memoryOptional">(opcional)</span>
              </label>
              <textarea
                id="album-description"
                value={albumDescription}
                onChange={(event) => setAlbumDescription(event.target.value)}
                placeholder="Una frase corta sobre este álbum"
                maxLength={500}
                rows={3}
                style={styles.textarea}
                disabled={creatingAlbum}
              />

              {albumError && (
                <div className="memoryFormError" role="alert">
                  {albumError}
                </div>
              )}

              <div className="memoryFormActions">
                <button
                  type="button"
                  style={styles.ghostBtn}
                  onClick={closeAlbumForm}
                  disabled={creatingAlbum}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtnSmall}
                  disabled={creatingAlbum}
                >
                  {creatingAlbum ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="syncSpinner"
                      size={16}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
                  )}
                  {creatingAlbum ? "Creando..." : "Crear álbum"}
                </button>
              </div>
            </div>
          </form>
        </Block>
      )}

      {!selectedAlbum && (
        <Block
          title={
            <SectionTitle
              icon={Camera}
              label={`Álbumes (${albums.length})`}
              color="#7e22ce"
            />
          }
          right={
            <button
              type="button"
              style={styles.primaryBtnSmall}
              onClick={() => {
                if (albumFormOpen) closeAlbumForm();
                else setAlbumFormOpen(true);
              }}
              aria-expanded={albumFormOpen}
              disabled={creatingAlbum}
            >
              {albumFormOpen ? (
                <X aria-hidden="true" size={16} strokeWidth={1.9} />
              ) : (
                <FolderPlus aria-hidden="true" size={16} strokeWidth={1.9} />
              )}
              {albumFormOpen ? "Cerrar" : "Nuevo álbum"}
            </button>
          }
        >
          <p className="albumSectionLead">
            Una colección para cada persona, viaje o etapa de tu vida.
          </p>

          {albums.length === 0 ? (
            <div className="albumEmptyState">
              <div aria-hidden="true" style={styles.emptyIcon}>
                <Images size={25} strokeWidth={1.6} />
              </div>
              <div style={{ fontWeight: 650 }}>Tu historia puede empezar donde quieras</div>
              <div style={styles.p}>Estas son ideas; puedes crear cualquier tipo de álbum.</div>
              <div className="albumIdeas" aria-label="Ideas para álbumes">
                {ALBUM_IDEAS.map(({ icon: Icon, label }) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => {
                      setAlbumTitle(label);
                      setAlbumFormOpen(true);
                    }}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                style={styles.primaryBtnSmall}
                onClick={() => setAlbumFormOpen(true)}
              >
                <FolderPlus aria-hidden="true" size={16} strokeWidth={1.9} />
                Crear mi primer álbum
              </button>
            </div>
          ) : (
            <div className="albumGallery">
              {albumCards.map((album) => (
                <button
                  type="button"
                  className="albumCard"
                  key={album.id}
                  onClick={() => openAlbum(album.id)}
                  aria-label={`Abrir álbum ${album.title}`}
                >
                  <span className="albumCardCover">
                    {album.cover?.imageUrl ? (
                      <img src={album.cover.imageUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="albumCardPlaceholder" aria-hidden="true">
                        <Images size={29} strokeWidth={1.35} />
                      </span>
                    )}
                    <span className="albumCardCount">
                      {album.photoCount} {album.photoCount === 1 ? "foto" : "fotos"}
                    </span>
                  </span>
                  <span className="albumCardBody">
                    <strong>{album.title}</strong>
                    <span>{album.description || "Lista para nuevos momentos."}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Block>
      )}

      {selectedAlbum && (
        <Block
          title={
            <SectionTitle icon={Images} label={selectedAlbum.title} color="#7e22ce" />
          }
          right={
            <div className="memoryHeaderActions">
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={leaveAlbum}
                aria-label="Volver a álbumes"
              >
                <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.9} />
                <span className="memoryBackLabel">Álbumes</span>
              </button>
              <button
                type="button"
                className="memoryIconAction"
                onClick={openAlbumEditor}
                aria-label="Editar álbum"
              >
                <Pencil aria-hidden="true" size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                style={styles.primaryBtnSmall}
                onClick={() => setMemoryFormOpen(true)}
              >
                <ImagePlus aria-hidden="true" size={16} strokeWidth={1.9} />
                Añadir foto
              </button>
            </div>
          }
        >
          {selectedAlbum.description && (
            <p className="albumSectionLead">{selectedAlbum.description}</p>
          )}

          {albumMemories.length === 0 ? (
            <div className="albumEmptyState albumEmptyStateCompact">
              <div aria-hidden="true" style={styles.emptyIcon}>
                <ImagePlus size={25} strokeWidth={1.6} />
              </div>
              <div style={{ fontWeight: 650 }}>Este álbum todavía está vacío</div>
              <div style={styles.p}>Solo necesitas elegir una foto y su fecha.</div>
              <button
                type="button"
                style={styles.primaryBtnSmall}
                onClick={() => setMemoryFormOpen(true)}
              >
                <ImagePlus aria-hidden="true" size={16} strokeWidth={1.9} />
                Añadir la primera foto
              </button>
            </div>
          ) : (
            <MemoryCollage
              memories={albumMemories}
              onSelect={openMemory}
              getLabel={(memory) => (
                memory.title
                  ? `Abrir recuerdo ${memory.title}`
                  : `Abrir fotografía del ${formatCalendarDate(memory.memoryDate)}`
              )}
            />
          )}
        </Block>
      )}

      {selectedAlbum && albumEditorOpen && (
        <div
          className="memoryComposerBackdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !savingAlbum &&
              !deletingAlbum
            ) {
              closeAlbumEditor();
            }
          }}
        >
          <section
            className="albumEditor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="album-editor-title"
          >
            <header className="memoryComposerHeader">
              <div>
                <h2 id="album-editor-title">Editar álbum</h2>
                <p>Actualiza sus detalles o elimina la colección.</p>
              </div>
              <button
                ref={albumEditorCloseRef}
                type="button"
                className="memoryModalClose memoryComposerClose"
                onClick={closeAlbumEditor}
                aria-label="Cerrar editor del álbum"
                disabled={savingAlbum || deletingAlbum}
              >
                <X aria-hidden="true" size={19} strokeWidth={1.8} />
              </button>
            </header>

            <form
              className="albumEditorForm"
              onSubmit={(event) => void submitAlbumChanges(event)}
            >
              <label htmlFor="edit-album-title" style={styles.fieldLabel}>
                Nombre del álbum
              </label>
              <input
                id="edit-album-title"
                value={editedAlbumTitle}
                onChange={(event) => setEditedAlbumTitle(event.target.value)}
                maxLength={80}
                style={styles.input}
                disabled={savingAlbum || deletingAlbum}
              />

              <label htmlFor="edit-album-description" style={styles.fieldLabel}>
                Descripción <span className="memoryOptional">(opcional)</span>
              </label>
              <textarea
                id="edit-album-description"
                value={editedAlbumDescription}
                onChange={(event) => setEditedAlbumDescription(event.target.value)}
                maxLength={500}
                rows={4}
                style={styles.textarea}
                disabled={savingAlbum || deletingAlbum}
              />

              {albumEditorError && (
                <div className="memoryFormError" role="alert">
                  {albumEditorError}
                </div>
              )}

              <div className="memoryFormActions">
                <button
                  type="button"
                  style={styles.ghostBtn}
                  onClick={closeAlbumEditor}
                  disabled={savingAlbum || deletingAlbum}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtnSmall}
                  disabled={savingAlbum || deletingAlbum}
                >
                  {savingAlbum && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="syncSpinner"
                      size={16}
                      strokeWidth={1.8}
                    />
                  )}
                  {savingAlbum ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>

              <div className="albumDangerZone">
                <div>
                  <strong>Mover a la papelera</strong>
                  <span>
                    {albumMemories.length === 0
                      ? "El álbum está vacío. Podrás recuperarlo durante 30 días."
                      : albumMemories.length === 1
                        ? "Su fotografía se conservará junto al álbum."
                        : `Sus ${albumMemories.length} fotografías se conservarán junto al álbum.`}
                  </span>
                </div>
                <button
                  type="button"
                  style={styles.dangerBtn}
                  onClick={() => void deleteSelectedAlbum()}
                  disabled={savingAlbum || deletingAlbum}
                >
                  {deletingAlbum ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="syncSpinner"
                      size={15}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
                  )}
                  {deletingAlbum ? "Moviendo..." : "Mover a la papelera"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedAlbum && memoryFormOpen && (
        <div
          className="memoryComposerBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !uploading) closeMemoryForm();
          }}
        >
          <section
            className="memoryComposer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-composer-title"
          >
            <header className="memoryComposerHeader">
              <div>
                <h2 id="memory-composer-title">Añadir fotografía</h2>
                <p>{selectedAlbum.title}</p>
              </div>
              <button
                ref={composerCloseRef}
                type="button"
                className="memoryModalClose memoryComposerClose"
                onClick={closeMemoryForm}
                aria-label="Cerrar formulario"
                disabled={uploading}
              >
                <X aria-hidden="true" size={19} strokeWidth={1.8} />
              </button>
            </header>

            <form className="memoryForm" onSubmit={(event) => void submitMemories(event)}>
              <label className="memoryDropzone">
                <input
                  className="srOnly"
                  type="file"
                  accept={ACCEPTED_IMAGES}
                  multiple
                  onChange={(event) => selectFiles(event.target.files)}
                  disabled={uploading}
                />

                {previewItems.length > 0 ? (
                  <span className="memoryBatchPreview" aria-label="Fotografías seleccionadas">
                    {previewItems.map((item, index) => (
                      <img
                        key={`${item.file.name}-${item.file.lastModified}-${index}`}
                        src={item.url}
                        alt=""
                      />
                    ))}
                  </span>
                ) : (
                  <span className="memoryDropzoneEmpty">
                    <span className="memoryDropzoneIcon" aria-hidden="true">
                      <Upload size={25} strokeWidth={1.6} />
                    </span>
                    <strong>Elegir fotografías</strong>
                    <small>Puedes seleccionar varias · máximo 20 MB por foto</small>
                  </span>
                )}

                {files.length > 0 && (
                  <span className="memoryFileName">
                    {files.length} {files.length === 1 ? "foto seleccionada" : "fotos seleccionadas"}
                  </span>
                )}
              </label>

              <div className="memoryFields memoryComposerFields">
                <label htmlFor="memory-date" style={styles.fieldLabel}>
                  Fecha
                </label>
                <input
                  id="memory-date"
                  type="date"
                  value={memoryDate}
                  max={getLocalDateKey()}
                  onChange={(event) => setMemoryDate(event.target.value)}
                  style={styles.input}
                  disabled={uploading}
                />

                {formError && (
                  <div className="memoryFormError" role="alert">
                    {formError}
                    {formDiagnostic && (
                      <details className="memoryErrorDetails">
                        <summary>Ver detalle técnico</summary>
                        <code>{formDiagnostic}</code>
                      </details>
                    )}
                  </div>
                )}

                <div className="memoryFormActions">
                  <button
                    type="button"
                    style={styles.ghostBtn}
                    onClick={closeMemoryForm}
                    disabled={uploading}
                  >
                    Cancelar
                  </button>
                  <button type="submit" style={styles.primaryBtnSmall} disabled={uploading}>
                    {uploading ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="syncSpinner"
                        size={16}
                        strokeWidth={1.8}
                      />
                    ) : (
                      <Upload aria-hidden="true" size={16} strokeWidth={1.8} />
                    )}
                    {uploading
                      ? `Subiendo ${uploadProgress.completed} de ${uploadProgress.total}...`
                      : files.length > 1
                        ? `Guardar ${files.length} fotos`
                        : "Guardar foto"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedMemory && (
        <div
          className="memoryModalBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSelectedMemory();
          }}
        >
          <section
            className="memoryModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-modal-title"
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="memoryModalClose"
              onClick={closeSelectedMemory}
              aria-label="Cerrar recuerdo"
              disabled={deleting || changingCover || savingMemoryDetails}
            >
              <X aria-hidden="true" size={19} strokeWidth={1.8} />
            </button>

            <div className="memoryModalImage">
              {selectedMemory.imageUrl ? (
                <img
                  src={selectedMemory.imageUrl}
                  alt={
                    selectedMemory.title ||
                    `Fotografía del ${formatCalendarDate(selectedMemory.memoryDate)}`
                  }
                />
              ) : (
                <ImagePlus aria-hidden="true" size={36} strokeWidth={1.4} />
              )}
            </div>

            <div className="memoryModalContent">
              <div className="memoryCardDate">
                <CalendarDays aria-hidden="true" size={14} strokeWidth={1.8} />
                {formatCalendarDate(selectedMemory.memoryDate)}
              </div>
              <h2
                id="memory-modal-title"
                className={selectedMemory.title ? undefined : "srOnly"}
              >
                {selectedMemory.title ||
                  `Fotografía del ${formatCalendarDate(selectedMemory.memoryDate)}`}
              </h2>
              {selectedMemory.description && <p>{selectedMemory.description}</p>}

              {editingMemoryDetails ? (
                <form
                  className="memoryDetailsForm"
                  onSubmit={(event) => void submitMemoryDetails(event)}
                >
                  <label htmlFor="selected-memory-title" style={styles.fieldLabel}>
                    Título <span className="memoryOptional">(opcional)</span>
                  </label>
                  <input
                    id="selected-memory-title"
                    value={editedMemoryTitle}
                    onChange={(event) => setEditedMemoryTitle(event.target.value)}
                    maxLength={120}
                    style={styles.input}
                    disabled={savingMemoryDetails}
                  />

                  <label htmlFor="selected-memory-description" style={styles.fieldLabel}>
                    Descripción <span className="memoryOptional">(opcional)</span>
                  </label>
                  <textarea
                    id="selected-memory-description"
                    value={editedMemoryDescription}
                    onChange={(event) => setEditedMemoryDescription(event.target.value)}
                    maxLength={4000}
                    rows={5}
                    style={styles.textarea}
                    disabled={savingMemoryDetails}
                  />

                  {memoryDetailsError && (
                    <div className="memoryFormError" role="alert">
                      {memoryDetailsError}
                    </div>
                  )}

                  <div className="memoryDetailsActions">
                    <button
                      type="button"
                      style={styles.ghostBtn}
                      onClick={() => {
                        setEditedMemoryTitle(selectedMemory.title ?? "");
                        setEditedMemoryDescription(selectedMemory.description ?? "");
                        setMemoryDetailsError("");
                        setEditingMemoryDetails(false);
                      }}
                      disabled={savingMemoryDetails}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={styles.primaryBtnSmall}
                      disabled={savingMemoryDetails}
                    >
                      {savingMemoryDetails && (
                        <LoaderCircle
                          aria-hidden="true"
                          className="syncSpinner"
                          size={15}
                          strokeWidth={1.8}
                        />
                      )}
                      {savingMemoryDetails ? "Guardando..." : "Guardar detalles"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  style={styles.ghostBtn}
                  className="memoryDetailsButton"
                  onClick={() => setEditingMemoryDetails(true)}
                  disabled={deleting || changingCover || savingMemoryDetails}
                >
                  <Pencil aria-hidden="true" size={15} strokeWidth={1.8} />
                  {selectedMemory.title || selectedMemory.description
                    ? "Editar título o descripción"
                    : "Añadir título o descripción"}
                </button>
              )}

              <div className="memoryModalActions">
                <button
                  type="button"
                  style={styles.ghostBtn}
                  className="memoryCoverButton"
                  onClick={() => void toggleSelectedCover()}
                  disabled={changingCover || deleting || savingMemoryDetails}
                >
                  {changingCover ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="syncSpinner"
                      size={15}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Images aria-hidden="true" size={15} strokeWidth={1.8} />
                  )}
                  {changingCover
                    ? "Cambiando..."
                    : selectedAlbum?.coverMemoryId === selectedMemory.id
                      ? "Usar portada automática"
                      : "Usar como portada"}
                </button>

                <button
                  type="button"
                  style={styles.dangerBtn}
                  className="memoryDeleteButton"
                  onClick={() => void deleteSelectedMemory()}
                  disabled={deleting || changingCover || savingMemoryDetails}
                >
                  {deleting ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="syncSpinner"
                      size={15}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
                  )}
                  {deleting ? "Moviendo..." : "Mover a la papelera"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
