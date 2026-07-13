import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";

const BOARDS = [
  {
    name: "My way",
    url: "https://mx.pinterest.com/cosmologyp/my-way/",
  },
];

export default function Pinterest() {
  const [activeBoard, setActiveBoard] = useState(BOARDS[0]?.url ?? "");
  const [widgetStatus, setWidgetStatus] = useState("loading");

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

  useEffect(() => {
    if (widgetStatus !== "ready") return undefined;

    const timeout = setTimeout(() => {
      try {
        window.PinUtils?.build?.();
      } catch (error) {
        console.warn("Pinterest build error:", error);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [activeBoard, widgetStatus]);

  return (
    <div style={styles.stack}>
      <Block
        title={<SectionTitle icon={Pin} label="Pinterest" color="#be123c" />}
        right={<span style={{ fontSize: 12, color: "#6b7280" }}>Boards</span>}
      >
        <div style={styles.p}>Selecciona uno y aqui se te mostrará el contenido jiji.</div>

        <div style={styles.boardTabs}>
          {BOARDS.map((board) => {
            const isActive = board.url === activeBoard;

            return (
              <button
                type="button"
                key={board.url}
                onClick={() => setActiveBoard(board.url)}
                aria-pressed={isActive}
                className={`boardTab${isActive ? " boardTabActive" : ""}`}
                style={{ ...styles.tabBtn, ...(isActive ? styles.tabBtnActive : {}) }}
              >
                {board.name}
              </button>
            );
          })}
        </div>
      </Block>

      <Block title="Vista del board">
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
