import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Hand,
  Keyboard,
  Pause,
  Play,
  Sparkles,
  Trophy,
} from "lucide-react";
import { readJSON, writeJSON } from "../utils/storage.js";
import { getPieceCells } from "./blockEngine.js";
import DifficultyPicker from "./DifficultyPicker.jsx";
import useBoardGestures from "./useBoardGestures.js";
import {
  advanceSandGame,
  createSandGame,
  hardDropSandPiece,
  moveSandPiece,
  rotateSandPiece,
  SAND_CELL_SIZE,
  SAND_COLUMNS,
  SAND_PALETTE,
  SAND_ROWS,
  softDropSandPiece,
  startSandGame,
  toggleSandPause,
} from "./sandEngine.js";

const BEST_SCORES_KEY = "lili_game_sand_best_v1";
const EMPTY_BEST_SCORES = { intense: 0, normal: 0, relaxed: 0 };
const PIECE_INPUT_COOLDOWN_MS = 90;
const RGB_PALETTE = [
  null,
  [97, 217, 232],
  [255, 207, 98],
  [170, 130, 245],
  [112, 220, 152],
  [255, 126, 145],
];

function readBestScores() {
  return readJSON(
    BEST_SCORES_KEY,
    EMPTY_BEST_SCORES,
    (value) => value && typeof value === "object",
  );
}

function toUi(game) {
  return {
    combo: game.combo,
    difficulty: game.difficulty,
    effectId: game.effectId,
    lastCleared: game.lastCleared,
    lastEffect: game.lastEffect,
    level: game.level,
    nextColor: game.nextColor,
    nextType: game.nextType,
    paths: game.paths,
    score: game.score,
    status: game.status,
  };
}

function sameUi(first, second) {
  return Object.keys(first).every((key) => first[key] === second[key]);
}

function drawSand(canvas, game) {
  if (!canvas) return;
  if (canvas.width !== SAND_COLUMNS || canvas.height !== SAND_ROWS) {
    canvas.width = SAND_COLUMNS;
    canvas.height = SAND_ROWS;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.createImageData(SAND_COLUMNS, SAND_ROWS);

  for (let index = 0; index < game.board.length; index += 1) {
    const color = game.board[index];
    if (color === 0) continue;
    const [red, green, blue] = RGB_PALETTE[color];
    const variation = ((index * 17) % 13) - 6;
    const pixel = index * 4;
    image.data[pixel] = Math.max(0, Math.min(255, red + variation));
    image.data[pixel + 1] = Math.max(0, Math.min(255, green + variation));
    image.data[pixel + 2] = Math.max(0, Math.min(255, blue + variation));
    image.data[pixel + 3] = 255;
  }

  const activeCells = [];
  if (game.active) {
    const [baseRed, baseGreen, baseBlue] = RGB_PALETTE[game.active.color];
    getPieceCells(game.active).forEach(([columnOffset, rowOffset]) => {
      const x = (game.active.x + columnOffset) * SAND_CELL_SIZE;
      const y = (game.active.y + rowOffset) * SAND_CELL_SIZE;
      if (y + SAND_CELL_SIZE <= 0) return;
      activeCells.push({ x, y });

      for (let grainY = 0; grainY < SAND_CELL_SIZE; grainY += 1) {
        const row = y + grainY;
        if (row < 0 || row >= SAND_ROWS) continue;
        for (let grainX = 0; grainX < SAND_CELL_SIZE; grainX += 1) {
          const column = x + grainX;
          const grainHash = (
            column * 31
            + row * 17
            + game.active.color * 13
          ) % 29;
          const grit = grainHash === 0
            ? 24
            : grainHash % 7 === 0
              ? -19
              : (grainHash % 13) - 6;
          const pixel = (row * SAND_COLUMNS + column) * 4;
          image.data[pixel] = Math.max(0, Math.min(255, baseRed + grit));
          image.data[pixel + 1] = Math.max(0, Math.min(255, baseGreen + grit));
          image.data[pixel + 2] = Math.max(0, Math.min(255, baseBlue + grit));
          image.data[pixel + 3] = grainHash % 17 === 0 ? 205 : 255;
        }
      }
    });
  }

  context.clearRect(0, 0, SAND_COLUMNS, SAND_ROWS);
  context.putImageData(image, 0, 0);

  if (game.active) {
    activeCells.forEach(({ x, y }) => {
      context.globalAlpha = 0.62;
      context.strokeStyle = "#ffffff";
      context.lineWidth = 0.35;
      context.strokeRect(x + 0.25, y + 0.25, SAND_CELL_SIZE - 0.5, SAND_CELL_SIZE - 0.5);
      context.globalAlpha = 0.18;
      context.strokeRect(x + 2, y + 2, SAND_CELL_SIZE - 4, SAND_CELL_SIZE - 4);
    });
  }

  if (game.pathEffect) {
    const progress = 1 - (game.pathEffect.remaining / game.pathEffect.duration);
    const opacity = Math.max(0, 1 - progress);
    const step = game.pathEffect.grains.length > 3600 ? 2 : 1;
    let currentColor = null;

    context.globalCompositeOperation = "lighter";
    context.globalAlpha = opacity * 0.95;
    for (let grain = 0; grain < game.pathEffect.grains.length; grain += step) {
      const packed = game.pathEffect.grains[grain];
      const index = Math.floor(packed / 8);
      const color = packed % 8;
      const column = index % SAND_COLUMNS;
      const row = Math.floor(index / SAND_COLUMNS);
      const drift = (((index * 7) % 9) - 4) * progress * 0.7;
      const lift = (1 + ((index * 11) % 8)) * progress;

      if (color !== currentColor) {
        const [red, green, blue] = RGB_PALETTE[color];
        context.fillStyle = `rgb(${Math.min(255, red + 24)} ${Math.min(255, green + 24)} ${Math.min(255, blue + 24)})`;
        currentColor = color;
      }
      context.fillRect(
        Math.round(column + drift),
        Math.round(row - lift),
        index % 23 === 0 ? 1.4 : 1,
        index % 23 === 0 ? 1.4 : 1,
      );
    }

    const waveX = Math.round(progress * (SAND_COLUMNS - 1));
    context.globalAlpha = Math.sin(progress * Math.PI) * 0.28;
    context.fillStyle = "#ffffff";
    context.fillRect(waveX, 0, 1.2, SAND_ROWS);
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}

function Metric({ label, value }) {
  return (
    <div className="blockGameMetric">
      <span>{label}</span>
      <strong key={value} className="blockGameMetricValue">{value}</strong>
    </div>
  );
}

function didLockSandPiece(previous, next) {
  return next !== previous
    && previous.active
    && next.effectId !== previous.effectId
    && ["land", "over"].includes(next.lastEffect);
}

export default function SandGame({ onBack }) {
  const [difficulty, setDifficulty] = useState("normal");
  const [bestScores, setBestScores] = useState(readBestScores);
  const [initialGame] = useState(() => createSandGame("normal"));
  const engineRef = useRef(initialGame);
  const [ui, setUi] = useState(() => toUi(initialGame));
  const canvasRef = useRef(null);
  const inputCooldownUntilRef = useRef(0);

  const syncUi = useCallback((game) => {
    const nextUi = toUi(game);
    setUi((current) => (sameUi(current, nextUi) ? current : nextUi));

    if (game.status === "over") {
      setBestScores((current) => {
        if (game.score <= (current[game.difficulty] ?? 0)) return current;
        const next = { ...current, [game.difficulty]: game.score };
        writeJSON(BEST_SCORES_KEY, next);
        return next;
      });
    }
  }, []);

  const apply = useCallback((transform) => {
    engineRef.current = transform(engineRef.current);
    syncUi(engineRef.current);
    drawSand(canvasRef.current, engineRef.current);
  }, [syncUi]);

  const releaseInputCooldown = useCallback(() => {
    inputCooldownUntilRef.current = 0;
  }, []);

  const holdInputAfterLock = useCallback(() => {
    inputCooldownUntilRef.current = performance.now() + PIECE_INPUT_COOLDOWN_MS;
  }, []);

  const applyPieceAction = useCallback((transform) => {
    if (
      engineRef.current.status === "running"
      && performance.now() < inputCooldownUntilRef.current
    ) {
      return;
    }
    const previous = engineRef.current;
    const next = transform(previous);
    if (didLockSandPiece(previous, next)) holdInputAfterLock();
    engineRef.current = next;
    syncUi(engineRef.current);
    drawSand(canvasRef.current, engineRef.current);
  }, [holdInputAfterLock, syncUi]);

  const moveLeft = useCallback(() => {
    applyPieceAction((game) => moveSandPiece(game, -1, 0));
  }, [applyPieceAction]);
  const moveRight = useCallback(() => {
    applyPieceAction((game) => moveSandPiece(game, 1, 0));
  }, [applyPieceAction]);
  const moveDown = useCallback(() => {
    applyPieceAction((game) => softDropSandPiece(game));
  }, [applyPieceAction]);
  const rotate = useCallback(() => {
    applyPieceAction((game) => rotateSandPiece(game));
  }, [applyPieceAction]);
  const drop = useCallback(() => {
    applyPieceAction((game) => hardDropSandPiece(game));
  }, [applyPieceAction]);
  const pause = useCallback(() => {
    apply((game) => toggleSandPause(game));
  }, [apply]);

  const begin = useCallback(() => {
    releaseInputCooldown();
    engineRef.current = startSandGame(difficulty);
    syncUi(engineRef.current);
    drawSand(canvasRef.current, engineRef.current);
  }, [difficulty, releaseInputCooldown, syncUi]);

  const changeDifficulty = useCallback((nextDifficulty) => {
    releaseInputCooldown();
    setDifficulty(nextDifficulty);
    engineRef.current = createSandGame(nextDifficulty);
    syncUi(engineRef.current);
    drawSand(canvasRef.current, engineRef.current);
  }, [releaseInputCooldown, syncUi]);

  useEffect(() => {
    let animationFrame;
    let previousTime = performance.now();
    let lastUiUpdate = previousTime;

    function animate(currentTime) {
      const delta = Math.min(50, Math.max(0, currentTime - previousTime));
      previousTime = currentTime;
      if (engineRef.current.status === "running") {
        engineRef.current = advanceSandGame(engineRef.current, delta);
        drawSand(canvasRef.current, engineRef.current);
        if (engineRef.current.status !== "running" || currentTime - lastUiUpdate >= 90) {
          syncUi(engineRef.current);
          lastUiUpdate = currentTime;
        }
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    drawSand(canvasRef.current, engineRef.current);
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [syncUi]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) {
        return;
      }
      const action = {
        ArrowDown: moveDown,
        ArrowLeft: moveLeft,
        ArrowRight: moveRight,
        ArrowUp: rotate,
        " ": drop,
        a: moveLeft,
        A: moveLeft,
        d: moveRight,
        D: moveRight,
        p: pause,
        P: pause,
        s: moveDown,
        S: moveDown,
        w: rotate,
        W: rotate,
      }[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drop, moveDown, moveLeft, moveRight, pause, rotate]);

  useEffect(() => {
    function pauseWhenHidden() {
      if (document.visibilityState === "hidden" && engineRef.current.status === "running") {
        engineRef.current = toggleSandPause(engineRef.current);
        syncUi(engineRef.current);
      }
    }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, [syncUi]);

  const nextCells = useMemo(() => {
    const occupied = new Set(
      getPieceCells({ rotation: 0, type: ui.nextType })
        .map(([column, row]) => `${column}:${row}`),
    );
    return Array.from({ length: 16 }, (_, index) => ({
      active: occupied.has(`${index % 4}:${Math.floor(index / 4)}`),
      id: index,
    }));
  }, [ui.nextType]);

  const displayedBest = Math.max(bestScores[difficulty] ?? 0, ui.score);
  const playing = ui.status === "running" || ui.status === "paused";
  const boardGestureHandlers = useBoardGestures({
    enabled: ui.status === "running",
    onDrop: drop,
    onMoveDown: moveDown,
    onMoveLeft: moveLeft,
    onMoveRight: moveRight,
    onRotate: rotate,
  });

  return (
    <section className={`blockGameShell sandGameShell${playing ? " blockGameShellPlaying" : ""}`}>
      <div className="blockGameToolbar">
        <button type="button" className="arcadeBackButton" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          Todos los juegos
        </button>
        <div className="blockGameToolbarActions">
          <span className="blockGameOfflineBadge">Disponible offline</span>
          <button
            type="button"
            className="blockGamePauseButton"
            onClick={pause}
            disabled={!playing}
            aria-label={ui.status === "paused" ? "Continuar partida" : "Pausar partida"}
          >
            {ui.status === "paused" ? (
              <Play aria-hidden="true" size={16} fill="currentColor" />
            ) : (
              <Pause aria-hidden="true" size={16} fill="currentColor" />
            )}
          </button>
        </div>
      </div>

      <div className="blockGameHeading sandGameHeading">
        <span>Física de arena</span>
        <h2>Sandris</h2>
        <p>Une arena del mismo color desde un borde hasta el otro para hacerla desaparecer.</p>
      </div>

      <DifficultyPicker
        disabled={playing}
        onChange={changeDifficulty}
        value={difficulty}
      />

      <div className="blockGameLayout sandGameLayout">
        <div className="blockGameStage">
          <div className="sandGameCanvasFrame">
            <canvas
              ref={canvasRef}
              className="sandGameCanvas"
              role="img"
              aria-label={`Tablero de Sandris. Puntuación ${ui.score}. Dificultad ${difficulty}.`}
              {...boardGestureHandlers}
            />

            {ui.combo > 1 && ui.status === "running" && (
              <span key={`${ui.combo}-${ui.paths}`} className="sandGameCombo">
                Combo ×{ui.combo}
              </span>
            )}

            {ui.effectId > 0 && ui.lastEffect === "path" && (
              <span
                key={`path-${ui.effectId}`}
                className="sandGamePathBurst"
                aria-hidden="true"
              >
                {Array.from({ length: 16 }, (_, index) => (
                  <i
                    key={index}
                    style={{
                      "--burst-angle": `${index * 22.5}deg`,
                      "--burst-delay": `${(index % 4) * 24}ms`,
                      "--burst-distance": `${26 + (index % 5) * 8}px`,
                    }}
                  />
                ))}
                <span>¡Camino completo!</span>
              </span>
            )}

            {ui.effectId > 0 && ui.lastEffect === "land" && (
              <span
                key={`land-${ui.effectId}`}
                className="sandGameLandPulse"
                aria-hidden="true"
              />
            )}

            {ui.status !== "running" && (
              <div className="blockGameOverlay sandGameOverlay">
                {ui.status === "paused" ? (
                  <>
                    <Pause aria-hidden="true" size={28} strokeWidth={1.7} />
                    <strong>Partida en pausa</strong>
                    <button type="button" onClick={pause}>
                      <Play aria-hidden="true" size={16} fill="currentColor" />
                      Continuar
                    </button>
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden="true" size={30} strokeWidth={1.6} />
                    <strong>{ui.status === "over" ? "La arena llegó arriba" : "¿Lista para jugar?"}</strong>
                    {ui.status === "over" && <span>Lograste {ui.score} puntos</span>}
                    <button type="button" onClick={begin}>
                      <Play aria-hidden="true" size={16} fill="currentColor" />
                      {ui.status === "over" ? "Jugar otra vez" : "Comenzar"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

        </div>

        <aside className="blockGamePanel">
          <div className="blockGameMetrics">
            <Metric label="Puntos" value={ui.score.toLocaleString("es-MX")} />
            <Metric label="Caminos" value={ui.paths} />
            <Metric label="Nivel" value={ui.level} />
            <div className="blockGameMetric blockGameBestMetric">
              <span><Trophy aria-hidden="true" size={14} /> Récord</span>
              <strong>{displayedBest.toLocaleString("es-MX")}</strong>
            </div>
          </div>

          <div className="blockGameNext sandGameNext">
            <span>Siguiente pieza</span>
            <div className="sandGamePreview" aria-hidden="true">
              {nextCells.map((cell) => (
                <span
                  key={cell.id}
                  className={cell.active ? "sandGamePreviewActive" : ""}
                  style={cell.active ? { backgroundColor: SAND_PALETTE[ui.nextColor] } : undefined}
                />
              ))}
            </div>
          </div>

          <div className="blockGameHelp">
            <span><Hand aria-hidden="true" size={16} /> Gestos</span>
            <p>Toca el tablero para girar, desliza a los lados para mover y hacia abajo para soltar.</p>
          </div>
          <div className="blockGameHelp blockGameKeyboardHelp">
            <span><Keyboard aria-hidden="true" size={16} /> Teclado</span>
            <p>Flechas o WASD para controlar, espacio para soltar y P para pausar.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
