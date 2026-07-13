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
import SectionTitle from "../components/SectionTitle.jsx";
import { formatCalendarDate, getLocalDateKey } from "../utils/date.js";
import { validateMemoryImage } from "../utils/images.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const ALBUM_IDEAS = [
  { icon: Heart, label: "Nosotros" },
  { icon: UsersRound, label: "Amigos y familia" },
  { icon: Plane, label: "Viajes" },
  { icon: Sparkles, label: "Mis momentos" },
];

export default function Memories() {
  const { addAlbum, addMemory, albums, memories, removeMemory } = useWorkspace();
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [albumFormOpen, setAlbumFormOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumError, setAlbumError] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [memoryFormOpen, setMemoryFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memoryDate, setMemoryDate] = useState(getLocalDateKey);
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const closeButtonRef = useRef(null);
  const composerCloseRef = useRef(null);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const selectedMemory =
    memories.find((memory) => memory.id === selectedMemoryId) ?? null;
  const albumMemories = useMemo(
    () => memories.filter((memory) => memory.albumId === selectedAlbumId),
    [memories, selectedAlbumId],
  );
  const albumCards = useMemo(
    () =>
      albums.map((album) => {
        const photos = memories.filter((memory) => memory.albumId === album.id);
        return { ...album, cover: photos[0] ?? null, photoCount: photos.length };
      }),
    [albums, memories],
  );
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    if (!selectedMemory) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event) {
      if (event.key === "Escape" && !deleting) setSelectedMemoryId(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [deleting, selectedMemory]);

  useEffect(() => {
    if (!memoryFormOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !uploading) {
        setTitle("");
        setDescription("");
        setMemoryDate(getLocalDateKey());
        setFile(null);
        setFormError("");
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

  function resetMemoryForm() {
    setTitle("");
    setDescription("");
    setMemoryDate(getLocalDateKey());
    setFile(null);
    setFormError("");
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

  function selectFile(nextFile) {
    try {
      validateMemoryImage(nextFile);
      setFile(nextFile);
      setFormError("");
    } catch (error) {
      setFile(null);
      setFormError(error instanceof Error ? error.message : "Fotografía no válida.");
    }
  }

  async function submitMemory(event) {
    event.preventDefault();

    if (!selectedAlbum) {
      setFormError("Primero selecciona un álbum.");
      return;
    }
    if (!file) {
      setFormError("Selecciona una fotografía.");
      return;
    }
    if (!memoryDate || memoryDate > getLocalDateKey()) {
      setFormError("Selecciona una fecha válida que no esté en el futuro.");
      return;
    }

    setUploading(true);
    setFormError("");
    const result = await addMemory({
      albumId: selectedAlbum.id,
      description,
      file,
      memoryDate,
      title,
    });
    setUploading(false);

    if (result.error) {
      setFormError(result.error.message || "No se pudo guardar la fotografía.");
      return;
    }

    resetMemoryForm();
    setMemoryFormOpen(false);
    setSelectedMemoryId(result.data.id);
  }

  async function deleteSelectedMemory() {
    if (!selectedMemory || deleting) return;
    const memoryName = selectedMemory.title || formatCalendarDate(selectedMemory.memoryDate);
    const confirmed = window.confirm(
      `¿Eliminar “${memoryName}” y su fotografía? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    const removed = await removeMemory(selectedMemory.id);
    setDeleting(false);
    if (removed) setSelectedMemoryId(null);
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
              <button type="button" style={styles.ghostBtn} onClick={leaveAlbum}>
                <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.9} />
                Álbumes
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
            <div className="memoryGallery">
              {albumMemories.map((memory) => {
                const formattedDate = formatCalendarDate(memory.memoryDate);
                return (
                  <button
                    type="button"
                    className="memoryCard"
                    key={memory.id}
                    onClick={() => setSelectedMemoryId(memory.id)}
                    aria-label={
                      memory.title
                        ? `Abrir recuerdo ${memory.title}`
                        : `Abrir fotografía del ${formattedDate}`
                    }
                  >
                    <span className="memoryCardImage">
                      {memory.imageUrl ? (
                        <img src={memory.imageUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <ImagePlus aria-hidden="true" size={28} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="memoryCardBody">
                      <span className="memoryCardDate">
                        <CalendarDays aria-hidden="true" size={13} strokeWidth={1.8} />
                        {formattedDate}
                      </span>
                      {memory.title && <strong>{memory.title}</strong>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Block>
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

            <form className="memoryForm" onSubmit={(event) => void submitMemory(event)}>
              <label className="memoryDropzone">
                <input
                  className="srOnly"
                  type="file"
                  accept={ACCEPTED_IMAGES}
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                  disabled={uploading}
                />

                {previewUrl ? (
                  <img src={previewUrl} alt="Vista previa del recuerdo" />
                ) : (
                  <span className="memoryDropzoneEmpty">
                    <span className="memoryDropzoneIcon" aria-hidden="true">
                      <Upload size={25} strokeWidth={1.6} />
                    </span>
                    <strong>Elegir fotografía</strong>
                    <small>JPG, PNG, WebP o HEIC · máximo 20 MB</small>
                  </span>
                )}

                {file && <span className="memoryFileName">{file.name}</span>}
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

                <details className="memoryOptionalDetails">
                  <summary>
                    <Plus aria-hidden="true" size={15} strokeWidth={1.8} />
                    Añadir título o minicarta
                  </summary>
                  <div className="memoryOptionalFields">
                    <label htmlFor="memory-title" style={styles.fieldLabel}>
                      Título <span className="memoryOptional">(opcional)</span>
                    </label>
                    <input
                      id="memory-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Un día para recordar"
                      maxLength={120}
                      style={styles.input}
                      disabled={uploading}
                    />

                    <label htmlFor="memory-description" style={styles.fieldLabel}>
                      Minicarta <span className="memoryOptional">(opcional)</span>
                    </label>
                    <textarea
                      id="memory-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Escribe algo sobre este momento..."
                      maxLength={4000}
                      rows={4}
                      style={styles.textarea}
                      disabled={uploading}
                    />
                  </div>
                </details>

                {formError && (
                  <div className="memoryFormError" role="alert">
                    {formError}
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
                    {uploading ? "Preparando y subiendo..." : "Guardar foto"}
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
            if (event.target === event.currentTarget && !deleting) {
              setSelectedMemoryId(null);
            }
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
              onClick={() => setSelectedMemoryId(null)}
              aria-label="Cerrar recuerdo"
              disabled={deleting}
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

              <button
                type="button"
                style={styles.dangerBtn}
                className="memoryDeleteButton"
                onClick={() => void deleteSelectedMemory()}
                disabled={deleting}
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
                {deleting ? "Eliminando..." : "Eliminar fotografía"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
