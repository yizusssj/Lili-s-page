import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Heart,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Shirt,
  Sparkles,
  Star,
  Trash2,
  WashingMachine,
  X,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import {
  CLOSET_CATEGORIES,
  CLOSET_CATEGORY_LABELS,
  CLOSET_COLORS,
  getClothingLabel,
} from "../closet/closetConfig.js";
import useCloset from "../closet/useCloset.js";
import { getLocalDateKey } from "../utils/date.js";
import { validateMemoryImage } from "../utils/images.js";
import "../closet/closet.css";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const EDITABLE_CATEGORIES = CLOSET_CATEGORIES.filter(({ id }) => id !== "all");
const MISSING_CLOSET_CODES = new Set(["42P01", "PGRST202", "PGRST205"]);

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isMissingMigration(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return MISSING_CLOSET_CODES.has(error?.code)
    || message.includes("clothing_items")
    || message.includes("save_outfit");
}

function useModal(open, onClose, busy = false) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onClose, open]);
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="closetEmpty">
      <span className="closetEmptyIcon" aria-hidden="true">
        <Icon size={27} strokeWidth={1.6} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

function ClothingCard({ item, onOpen, selectable = false, selected = false }) {
  return (
    <button
      type="button"
      className={`clothingCard${selected ? " clothingCardSelected" : ""}`}
      onClick={() => onOpen(item)}
      aria-pressed={selectable ? selected : undefined}
      aria-label={`${selectable ? (selected ? "Quitar" : "Elegir") : "Abrir"} ${getClothingLabel(item)}`}
    >
      <span className="clothingCardImage">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" />
        ) : (
          <Shirt size={34} strokeWidth={1.4} aria-hidden="true" />
        )}
        {selectable && (
          <span className="clothingSelectMark" aria-hidden="true">
            {selected ? <Check size={15} strokeWidth={3} /> : <Plus size={15} />}
          </span>
        )}
        {item.favorite && (
          <span className="clothingFavorite" aria-label="Favorita">
            <Heart size={13} fill="currentColor" />
          </span>
        )}
        {item.status === "laundry" && (
          <span className="clothingLaundryBadge">
            <WashingMachine size={12} />
            Por lavar
          </span>
        )}
      </span>
      <span className="clothingCardBody">
        <strong>{getClothingLabel(item)}</strong>
        <span>
          {item.color || item.brand || CLOSET_CATEGORY_LABELS[item.category]}
        </span>
      </span>
    </button>
  );
}

function OutfitCollage({ items }) {
  const visibleItems = items.slice(0, 4);
  return (
    <div className={`outfitCollage outfitCollage${visibleItems.length}`}>
      {visibleItems.map((item) => (
        <div key={item.id}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" loading="lazy" />
          ) : (
            <Shirt size={24} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

function AddClothesSheet({ open, saving, onClose, onSave }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState("other");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [formError, setFormError] = useState("");
  const inputRef = useRef(null);
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(
    () => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)),
    [previews],
  );

  function close() {
    if (saving) return;
    setFiles([]);
    setCategory("other");
    setColor("");
    setBrand("");
    setFormError("");
    onClose();
  }

  useModal(open, close, saving);

  function selectFiles(fileList) {
    const selected = Array.from(fileList ?? []);
    try {
      selected.forEach(validateMemoryImage);
      setFiles(selected);
      setFormError("");
    } catch (error) {
      setFiles([]);
      setFormError(error instanceof Error ? error.message : "No pudimos leer esas fotos.");
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (files.length === 0) {
      setFormError("Elige al menos una foto.");
      return;
    }

    const result = await onSave(files, { brand, category, color });
    if (result.errors.length > 0) {
      setFormError(
        result.added > 0
          ? `Se guardaron ${result.added} fotos. ${result.errors[0].message}`
          : result.errors[0].message,
      );
      if (result.added === 0) return;
    }
    close();
  }

  if (!open) return null;

  return (
    <div className="closetSheetBackdrop" role="presentation">
      <section className="closetSheet" role="dialog" aria-modal="true" aria-labelledby="add-clothes-title">
        <header className="closetSheetHeader">
          <div>
            <span>Nuevas prendas</span>
            <h2 id="add-clothes-title">Añadir al clóset</h2>
          </div>
          <button type="button" className="closetCloseButton" onClick={close} disabled={saving} aria-label="Cerrar">
            <X size={21} />
          </button>
        </header>

        <form className="closetSheetBody" onSubmit={(event) => void submit(event)}>
          <button
            type="button"
            className={`closetPhotoPicker${previews.length ? " closetPhotoPickerFilled" : ""}`}
            onClick={() => inputRef.current?.click()}
          >
            {previews.length > 0 ? (
              <>
                <span className="closetPhotoPreview">
                  {previews.slice(0, 6).map(({ file, url }) => (
                    <img key={`${file.name}-${file.lastModified}`} src={url} alt="" />
                  ))}
                </span>
                <strong>{previews.length} {previews.length === 1 ? "foto elegida" : "fotos elegidas"}</strong>
                <small>Toca para cambiar la selección</small>
              </>
            ) : (
              <>
                <span><ImagePlus size={30} strokeWidth={1.6} /></span>
                <strong>Elegir fotos</strong>
                <small>Puedes añadir varias prendas de una vez.</small>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            className="visuallyHidden"
            type="file"
            accept={ACCEPTED_IMAGES}
            multiple
            onChange={(event) => selectFiles(event.target.files)}
          />

          <div className="closetOptionalTitle">
            <strong>Detalles opcionales</strong>
            <span>Úsalos solo si te ayudan a encontrarla después.</span>
          </div>

          <label className="closetField">
            <span>Tipo de prenda</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {EDITABLE_CATEGORIES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <fieldset className="closetColorField">
            <legend>Color</legend>
            <div className="closetColorChoices">
              {CLOSET_COLORS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={color === option.id ? "closetColorActive" : ""}
                  onClick={() => setColor(color === option.id ? "" : option.id)}
                  title={option.id}
                  aria-label={option.id}
                  aria-pressed={color === option.id}
                >
                  <span style={{ background: option.value }} />
                </button>
              ))}
            </div>
          </fieldset>

          <label className="closetField">
            <span>Marca</span>
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              maxLength={80}
              placeholder="Zara, Bershka, SHEIN..."
            />
          </label>

          {formError && <div className="closetFormError" role="alert">{formError}</div>}

          <div className="closetSheetActions">
            <button type="button" className="closetSecondaryButton" onClick={close} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="closetPrimaryButton" disabled={saving || files.length === 0}>
              {saving ? <LoaderCircle className="closetSpinner" size={18} /> : <Plus size={18} />}
              {saving
                ? "Guardando..."
                : `Guardar ${files.length || ""} ${files.length === 1 ? "prenda" : "prendas"}`.trim()}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ClothingDetailSheet({ item, saving, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({
    brand: item.brand ?? "",
    category: item.category,
    color: item.color ?? "",
    favorite: item.favorite,
    name: item.name ?? "",
    notes: item.notes ?? "",
    status: item.status,
  });
  const [deleting, setDeleting] = useState(false);

  function close() {
    if (!saving && !deleting) onClose();
  }

  useModal(Boolean(item), close, saving || deleting);

  async function submit(event) {
    event.preventDefault();
    const saved = await onSave(item.id, draft);
    if (saved) onClose();
  }

  async function remove() {
    if (!window.confirm("¿Eliminar esta prenda del clóset? También desaparecerá de sus outfits.")) return;
    setDeleting(true);
    const removed = await onDelete(item.id);
    setDeleting(false);
    if (removed) onClose();
  }

  return (
    <div className="closetSheetBackdrop" role="presentation">
      <section className="closetSheet closetDetailSheet" role="dialog" aria-modal="true" aria-labelledby="clothing-detail-title">
        <header className="closetSheetHeader">
          <div>
            <span>Tu prenda</span>
            <h2 id="clothing-detail-title">{getClothingLabel(item)}</h2>
          </div>
          <button type="button" className="closetCloseButton" onClick={close} aria-label="Cerrar">
            <X size={21} />
          </button>
        </header>

        <form className="closetSheetBody" onSubmit={(event) => void submit(event)}>
          <div className="closetDetailPhoto">
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Shirt size={44} />}
          </div>

          <div className="closetDetailQuickActions">
            <button
              type="button"
              className={draft.favorite ? "closetQuickActive" : ""}
              onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}
            >
              <Heart size={17} fill={draft.favorite ? "currentColor" : "none"} />
              {draft.favorite ? "Favorita" : "Favorito"}
            </button>
            <button
              type="button"
              className={draft.status === "laundry" ? "closetLaundryActive" : ""}
              onClick={() => setDraft({
                ...draft,
                status: draft.status === "laundry" ? "available" : "laundry",
              })}
            >
              <WashingMachine size={17} />
              {draft.status === "laundry" ? "Por lavar" : "Está limpia"}
            </button>
          </div>

          <label className="closetField">
            <span>Nombre opcional</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              maxLength={100}
              placeholder="Mi chamarra favorita"
            />
          </label>

          <div className="closetTwoFields">
            <label className="closetField">
              <span>Tipo</span>
              <select
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                {EDITABLE_CATEGORIES.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="closetField">
              <span>Marca</span>
              <input
                value={draft.brand}
                onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
                maxLength={80}
                placeholder="Opcional"
              />
            </label>
          </div>

          <fieldset className="closetColorField">
            <legend>Color</legend>
            <div className="closetColorChoices">
              {CLOSET_COLORS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={draft.color === option.id ? "closetColorActive" : ""}
                  onClick={() => setDraft({
                    ...draft,
                    color: draft.color === option.id ? "" : option.id,
                  })}
                  title={option.id}
                  aria-label={option.id}
                  aria-pressed={draft.color === option.id}
                >
                  <span style={{ background: option.value }} />
                </button>
              ))}
            </div>
          </fieldset>

          <label className="closetField">
            <span>Nota</span>
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              maxLength={1000}
              rows={3}
              placeholder="Con qué combina, cómo queda..."
            />
          </label>

          {item.lastWornOn && (
            <p className="closetWearNote">
              Último uso: {formatShortDate(item.lastWornOn)}
              {item.wearCount > 1 ? ` · ${item.wearCount} usos registrados` : ""}
            </p>
          )}

          <div className="closetSheetActions">
            <button
              type="button"
              className="closetDeleteButton"
              onClick={() => void remove()}
              disabled={saving || deleting}
            >
              <Trash2 size={17} />
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
            <button type="submit" className="closetPrimaryButton" disabled={saving || deleting}>
              {saving ? <LoaderCircle className="closetSpinner" size={18} /> : <Check size={18} />}
              Guardar cambios
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function OutfitBuilderSheet({ open, items, saving, onClose, onSave }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [category, setCategory] = useState("all");
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [plannedFor, setPlannedFor] = useState("");
  const [formError, setFormError] = useState("");
  const availableItems = useMemo(
    () => items.filter((item) =>
      item.status === "available"
      && (category === "all" || item.category === category)),
    [category, items],
  );

  function resetAndClose() {
    if (saving) return;
    setSelectedIds([]);
    setCategory("all");
    setName("");
    setOccasion("");
    setPlannedFor("");
    setFormError("");
    onClose();
  }

  useModal(open, resetAndClose, saving);

  function toggleItem(item) {
    setFormError("");
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= 8) {
        setFormError("Puedes combinar hasta 8 prendas.");
        return current;
      }
      return [...current, item.id];
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (selectedIds.length === 0) {
      setFormError("Elige al menos una prenda.");
      return;
    }
    const outfit = await onSave({
      itemIds: selectedIds,
      name,
      occasion,
      plannedFor,
    });
    if (outfit) resetAndClose();
  }

  if (!open) return null;

  return (
    <div className="closetSheetBackdrop" role="presentation">
      <section className="closetSheet closetBuilderSheet" role="dialog" aria-modal="true" aria-labelledby="outfit-builder-title">
        <header className="closetSheetHeader">
          <div>
            <span>Combina sin sacar todo</span>
            <h2 id="outfit-builder-title">Crear outfit</h2>
          </div>
          <button type="button" className="closetCloseButton" onClick={resetAndClose} aria-label="Cerrar">
            <X size={21} />
          </button>
        </header>

        <form className="closetSheetBody" onSubmit={(event) => void submit(event)}>
          <div className="outfitSelectionSummary">
            <div>
              <strong>{selectedIds.length}</strong>
              <span>{selectedIds.length === 1 ? "prenda elegida" : "prendas elegidas"}</span>
            </div>
            <small>Elige entre 1 y 8</small>
          </div>

          <div className="closetFilters" role="list" aria-label="Filtrar prendas">
            {CLOSET_CATEGORIES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={category === option.id ? "closetFilterActive" : ""}
                onClick={() => setCategory(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {availableItems.length > 0 ? (
            <div className="outfitPickerGrid">
              {availableItems.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  selectable
                  selected={selectedIds.includes(item.id)}
                  onOpen={toggleItem}
                />
              ))}
            </div>
          ) : (
            <p className="closetInlineEmpty">No hay prendas limpias en esta categoría.</p>
          )}

          <div className="closetOptionalTitle closetBuilderDetails">
            <strong>Dale contexto si quieres</strong>
            <span>Todo esto es opcional.</span>
          </div>
          <div className="closetTwoFields">
            <label className="closetField">
              <span>Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Cena bonita"
              />
            </label>
            <label className="closetField">
              <span>Ocasión</span>
              <input
                value={occasion}
                onChange={(event) => setOccasion(event.target.value)}
                maxLength={80}
                placeholder="Cita, escuela, viaje..."
              />
            </label>
          </div>
          <label className="closetField">
            <span>¿Para qué día?</span>
            <input
              type="date"
              value={plannedFor}
              min={getLocalDateKey()}
              onChange={(event) => setPlannedFor(event.target.value)}
            />
          </label>

          {formError && <div className="closetFormError" role="alert">{formError}</div>}

          <div className="closetSheetActions">
            <button type="button" className="closetSecondaryButton" onClick={resetAndClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="closetPrimaryButton" disabled={saving || selectedIds.length === 0}>
              {saving ? <LoaderCircle className="closetSpinner" size={18} /> : <Sparkles size={18} />}
              Guardar outfit
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Closet() {
  const {
    addClothingItems,
    clearError,
    clearNotice,
    error,
    items,
    loading,
    markAllClean,
    markOutfitWorn,
    notice,
    outfits,
    refresh,
    removeClothingItem,
    removeOutfit,
    saveOutfit,
    saving,
    updateClothingItem,
  } = useCloset();
  const [activeTab, setActiveTab] = useState("closet");
  const [category, setCategory] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const laundryItems = items.filter((item) => item.status === "laundry");
  const visibleItems = useMemo(
    () => items.filter((item) =>
      (category === "all" || item.category === category)
      && (!showFavorites || item.favorite)),
    [category, items, showFavorites],
  );
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  if (loading) {
    return (
      <div className="closetLoading">
        <LoaderCircle className="closetSpinner" size={25} />
        <span>Abriendo tu clóset...</span>
      </div>
    );
  }

  if (error && isMissingMigration(error)) {
    return (
      <section className="closetSetupCard">
        <span><Shirt size={31} strokeWidth={1.5} /></span>
        <h2>El clóset está listo para activarse</h2>
        <p>
          Ejecuta la migración <code>20260723010000_digital_closet.sql</code> en
          Supabase. Las demás secciones seguirán funcionando mientras tanto.
        </p>
        <button type="button" className="closetPrimaryButton" onClick={() => void refresh()}>
          <RefreshCw size={17} />
          Volver a comprobar
        </button>
      </section>
    );
  }

  return (
    <div style={styles.stack} className="closetPage">
      <section className="closetHero">
        <div className="closetHeroCopy">
          <span className="closetHeroIcon"><Shirt size={24} /></span>
          <div>
            <span>Tu ropa, sin sacar todo</span>
            <h2>Clóset digital</h2>
            <p>Guarda lo que tienes y arma combinaciones desde el teléfono.</p>
          </div>
        </div>
        <div className="closetHeroActions">
          <button type="button" className="closetSecondaryButton" onClick={() => setBuilderOpen(true)} disabled={items.length === 0}>
            <Sparkles size={17} />
            Crear outfit
          </button>
          <button type="button" className="closetPrimaryButton" onClick={() => setAddOpen(true)}>
            <Plus size={18} />
            Añadir ropa
          </button>
        </div>
      </section>

      {(notice || error) && (
        <div className={`closetNotice${error ? " closetNoticeError" : ""}`} role={error ? "alert" : "status"}>
          <span>{error?.message || notice}</span>
          <button type="button" onClick={error ? clearError : clearNotice} aria-label="Cerrar aviso">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="closetTabs" role="tablist" aria-label="Secciones del clóset">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "closet"}
          className={activeTab === "closet" ? "closetTabActive" : ""}
          onClick={() => setActiveTab("closet")}
        >
          <Shirt size={17} />
          Ropa
          <span>{items.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "outfits"}
          className={activeTab === "outfits" ? "closetTabActive" : ""}
          onClick={() => setActiveTab("outfits")}
        >
          <Sparkles size={17} />
          Outfits
          <span>{outfits.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "laundry"}
          className={activeTab === "laundry" ? "closetTabActive" : ""}
          onClick={() => setActiveTab("laundry")}
        >
          <WashingMachine size={17} />
          Por lavar
          <span>{laundryItems.length}</span>
        </button>
      </div>

      {activeTab === "closet" && (
        <section className="closetSection" role="tabpanel">
          <header className="closetSectionHeader">
            <div>
              <h3>Mis prendas</h3>
              <p>Toca una foto para editarla o marcarla por lavar.</p>
            </div>
            <button
              type="button"
              className={`closetFavoriteFilter${showFavorites ? " closetFavoriteFilterActive" : ""}`}
              onClick={() => setShowFavorites((current) => !current)}
              aria-pressed={showFavorites}
            >
              <Star size={16} fill={showFavorites ? "currentColor" : "none"} />
              Favoritas
            </button>
          </header>

          {items.length > 0 && (
            <div className="closetFilters" aria-label="Filtrar por categoría">
              {CLOSET_CATEGORIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={category === option.id ? "closetFilterActive" : ""}
                  onClick={() => setCategory(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {visibleItems.length > 0 ? (
            <div className="closetGrid">
              {visibleItems.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  onOpen={(openedItem) => setSelectedItemId(openedItem.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={items.length ? Star : ImagePlus}
              title={items.length ? "No hay prendas con este filtro" : "Tu clóset empieza con una foto"}
              description={items.length
                ? "Prueba otra categoría o muestra todas tus prendas."
                : "No necesitas escribir nada: añade una o varias fotos y listo."}
              action={items.length ? (
                <button type="button" className="closetSecondaryButton" onClick={() => { setCategory("all"); setShowFavorites(false); }}>
                  Ver todo
                </button>
              ) : (
                <button type="button" className="closetPrimaryButton" onClick={() => setAddOpen(true)}>
                  <ImagePlus size={17} />
                  Añadir mis primeras prendas
                </button>
              )}
            />
          )}
        </section>
      )}

      {activeTab === "outfits" && (
        <section className="closetSection" role="tabpanel">
          <header className="closetSectionHeader">
            <div>
              <h3>Mis outfits</h3>
              <p>Combinaciones listas para decidir más rápido.</p>
            </div>
            <button type="button" className="closetPrimaryButton closetCompactButton" onClick={() => setBuilderOpen(true)} disabled={items.length === 0}>
              <Plus size={17} />
              Nuevo
            </button>
          </header>

          {outfits.length > 0 ? (
            <div className="outfitGrid">
              {outfits.map((outfit) => {
                const outfitItems = outfit.itemIds.map((id) => itemById.get(id)).filter(Boolean);
                return (
                  <article key={outfit.id} className="outfitCard">
                    <OutfitCollage items={outfitItems} />
                    <div className="outfitCardBody">
                      <div className="outfitCardHeading">
                        <div>
                          <strong>{outfit.name || outfit.occasion || "Mi outfit"}</strong>
                          <span>
                            {outfit.plannedFor
                              ? `Planeado para ${formatShortDate(outfit.plannedFor)}`
                              : `${outfitItems.length} ${outfitItems.length === 1 ? "prenda" : "prendas"}`}
                          </span>
                        </div>
                        {outfit.favorite && <Heart size={16} fill="currentColor" aria-label="Favorito" />}
                      </div>
                      {outfit.occasion && outfit.name && <p>{outfit.occasion}</p>}
                      <div className="outfitCardActions">
                        <button type="button" onClick={() => void markOutfitWorn(outfit.id)} disabled={saving}>
                          <Check size={15} />
                          {outfit.wornOn === getLocalDateKey() ? "Usado hoy" : "Lo usé hoy"}
                        </button>
                        <button
                          type="button"
                          className="outfitDeleteAction"
                          onClick={() => {
                            if (window.confirm("¿Eliminar este outfit? Las prendas seguirán en tu clóset.")) {
                              void removeOutfit(outfit.id);
                            }
                          }}
                          disabled={saving}
                          aria-label="Eliminar outfit"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Arma tu primer outfit"
              description="Elige las prendas que combinan. Puedes ponerle nombre o simplemente guardarlo."
              action={(
                <button type="button" className="closetPrimaryButton" onClick={() => setBuilderOpen(true)} disabled={items.length === 0}>
                  <Sparkles size={17} />
                  {items.length ? "Crear outfit" : "Primero añade ropa"}
                </button>
              )}
            />
          )}
        </section>
      )}

      {activeTab === "laundry" && (
        <section className="closetSection" role="tabpanel">
          <header className="closetSectionHeader">
            <div>
              <h3>Por lavar</h3>
              <p>Una lista ligera, sin convertir el lavado en otra tarea.</p>
            </div>
            {laundryItems.length > 0 && (
              <button type="button" className="closetSecondaryButton closetCompactButton" onClick={() => void markAllClean()} disabled={saving}>
                <Check size={17} />
                Todo limpio
              </button>
            )}
          </header>

          {laundryItems.length > 0 ? (
            <div className="closetGrid">
              {laundryItems.map((item) => (
                <div key={item.id} className="laundryItemWrap">
                  <ClothingCard
                    item={item}
                    onOpen={(openedItem) => setSelectedItemId(openedItem.id)}
                  />
                  <button
                    type="button"
                    className="laundryCleanButton"
                    onClick={() => void updateClothingItem(item.id, { status: "available" })}
                    disabled={saving}
                  >
                    <Check size={15} />
                    Ya está limpia
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={WashingMachine}
              title="Todo está limpio"
              description="Cuando una prenda vaya al cesto, márcala desde su foto."
            />
          )}
        </section>
      )}

      <AddClothesSheet
        open={addOpen}
        saving={saving}
        onClose={() => setAddOpen(false)}
        onSave={addClothingItems}
      />
      {selectedItem && (
        <ClothingDetailSheet
          key={selectedItem.id}
          item={selectedItem}
          saving={saving}
          onClose={() => setSelectedItemId(null)}
          onSave={updateClothingItem}
          onDelete={removeClothingItem}
        />
      )}
      <OutfitBuilderSheet
        open={builderOpen}
        items={items}
        saving={saving}
        onClose={() => setBuilderOpen(false)}
        onSave={saveOutfit}
      />
    </div>
  );
}
