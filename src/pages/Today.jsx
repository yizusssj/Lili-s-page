import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleCheckBig,
  Flower2,
  GripVertical,
  Sun,
} from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { useWorkspace } from "../workspace/workspaceContext.js";

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

export default function Today() {
  const {
    movePriority,
    priorities: items,
    resetPriorities,
    togglePriority,
    updatePriorityText,
  } = useWorkspace();

  useEffect(() => {
    let timeoutId;

    function scheduleNextDay() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const delay = nextMidnight.getTime() - now.getTime() + 100;

      timeoutId = window.setTimeout(() => {
        resetPriorities();
        scheduleNextDay();
      }, delay);
    }

    scheduleNextDay();
    return () => window.clearTimeout(timeoutId);
  }, [resetPriorities]);

  return (
    <div style={styles.stack}>
      <Block title={<SectionTitle icon={Sun} label="Hoy" color="#b45309" />}>
        <div style={styles.p}>
          Bienvenida. Aquí vas a tener tu día clarito: prioridades, notas y cositas bonitas.
        </div>
      </Block>

      <div style={styles.grid2} className="grid2">
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
            Tip: arrastra con los puntitos para reordenar.
          </div>
        </Block>

        <Block title="Nota rápida">
          <QuickNote />
        </Block>
      </div>

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
