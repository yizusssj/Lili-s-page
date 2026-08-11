import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Keyboard,
  Pause,
  Play,
  Smartphone,
  Trophy,
} from "lucide-react";
import { readText, writeText } from "../utils/storage.js";
import DifficultyPicker from "./DifficultyPicker.jsx";
import useBoardGestures from "./useBoardGestures.js";
import {
  BOARD_COLUMNS,
  createGame,
  finishLineClear,
  getNextPieceBoard,
  getVisibleBoard,
  hardDrop,
  movePiece,
  rotatePiece,
  softDrop,
  startGame,
  tickGame,
  togglePause,
} from "./blockEngine.js";

const BEST_SCORE_KEY = "lili_game_blocks_best_v1";
const LINE_CLEAR_DELAY = 240;
const PIECE_INPUT_COOLDOWN_MS = 90;
const BLOCK_SPEEDS = {
  intense: { base: 500, minimum: 90 },
  normal: { base: 720, minimum: 110 },
  relaxed: { base: 920, minimum: 150 },
};

function readBestScore() {
  const value = Number(readText(BEST_SCORE_KEY, "0"));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function Cell({ clearing = false, delay = 0, value }) {
  const ghost = value?.startsWith("ghost-");
  const type = ghost ? value.slice(6) : value;
  return (
    <span
      className={`blockGameCell${type ? ` blockGameCell${type}` : ""}${ghost ? " blockGameCellGhost" : ""}${clearing ? " blockGameCellClearing" : ""}`}
      style={clearing ? { "--cell-clear-delay": `${delay}ms` } : undefined}
    />
  );
}

function Metric({ label, value }) {
  return (
    <div className="blockGameMetric">
      <span>{label}</span>
      <strong key={value} className="blockGameMetricValue">{value}</strong>
    </div>
  );
}

function didLockPiece(previous, next) {
  return next !== previous
    && previous.active
    && next.effectId !== previous.effectId
    && ["clear", "land", "over"].includes(next.lastEffect);
}

export default function FallingBlocks({ onBack }) {
  const [game, setGame] = useState(() => createGame());
  const [difficulty, setDifficulty] = useState("normal");
  const [bestScore, setBestScore] = useState(readBestScore);
  const inputCooldownUntilRef = useRef(0);
  const board = useMemo(() => getVisibleBoard(game), [game]);
  const nextBoard = useMemo(
    () => getNextPieceBoard(game.nextType),
    [game.nextType],
  );
  const displayedBestScore = Math.max(bestScore, game.score);

  const releaseInputCooldown = useCallback(() => {
    inputCooldownUntilRef.current = 0;
  }, []);

  const holdInputAfterLock = useCallback(() => {
    inputCooldownUntilRef.current = performance.now() + PIECE_INPUT_COOLDOWN_MS;
  }, []);

  const applyPieceAction = useCallback((transform) => {
    setGame((current) => {
      if (
        current.status === "running"
        && performance.now() < inputCooldownUntilRef.current
      ) {
        return current;
      }
      const next = transform(current);
      if (didLockPiece(current, next)) holdInputAfterLock();
      return next;
    });
  }, [holdInputAfterLock]);

  const moveLeft = useCallback(() => {
    applyPieceAction((current) => movePiece(current, -1, 0));
  }, [applyPieceAction]);
  const moveRight = useCallback(() => {
    applyPieceAction((current) => movePiece(current, 1, 0));
  }, [applyPieceAction]);
  const moveDown = useCallback(() => {
    applyPieceAction((current) => softDrop(current));
  }, [applyPieceAction]);
  const rotate = useCallback(() => {
    applyPieceAction((current) => rotatePiece(current));
  }, [applyPieceAction]);
  const drop = useCallback(() => {
    applyPieceAction((current) => hardDrop(current));
  }, [applyPieceAction]);
  const pause = useCallback(() => {
    setGame((current) => togglePause(current));
  }, []);
  const begin = useCallback(() => {
    releaseInputCooldown();
    setBestScore((current) => Math.max(current, game.score));
    setGame(startGame());
  }, [game.score, releaseInputCooldown]);

  const changeDifficulty = useCallback((nextDifficulty) => {
    releaseInputCooldown();
    setDifficulty(nextDifficulty);
    setGame(createGame());
  }, [releaseInputCooldown]);

  useEffect(() => {
    if (game.status !== "running") return undefined;
    const config = BLOCK_SPEEDS[difficulty];
    const speed = Math.max(config.minimum, config.base - (game.level - 1) * 55);
    const timerId = window.setInterval(() => {
      setGame((current) => tickGame(current));
    }, speed);
    return () => window.clearInterval(timerId);
  }, [difficulty, game.level, game.status]);

  useEffect(() => {
    if (game.status !== "clearing") return undefined;
    const timerId = window.setTimeout(() => {
      setGame((current) => finishLineClear(current));
    }, LINE_CLEAR_DELAY);
    return () => window.clearTimeout(timerId);
  }, [game.status]);

  useEffect(() => {
    if (game.status !== "over" || game.score <= bestScore) return;
    writeText(BEST_SCORE_KEY, String(game.score));
  }, [bestScore, game.score, game.status]);

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
        p: pause,
        P: pause,
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
      if (document.visibilityState !== "hidden") return;
      setGame((current) => (
        current.status === "running" ? togglePause(current) : current
      ));
    }

    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const playing = ["running", "paused", "clearing"].includes(game.status);
  const boardGestureHandlers = useBoardGestures({
    enabled: game.status === "running",
    onDrop: drop,
    onMoveDown: moveDown,
    onMoveLeft: moveLeft,
    onMoveRight: moveRight,
    onRotate: rotate,
  });

  return (
    <section className={`blockGameShell${playing ? " blockGameShellPlaying" : ""}`}>
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
            disabled={!['running', 'paused'].includes(game.status)}
            aria-label={game.status === "paused" ? "Continuar partida" : "Pausar partida"}
          >
            {game.status === "paused" ? (
              <Play aria-hidden="true" size={16} fill="currentColor" />
            ) : (
              <Pause aria-hidden="true" size={16} fill="currentColor" />
            )}
          </button>
        </div>
      </div>

      <div className="blockGameHeading">
        <span>Arcade lunar</span>
        <h2>Tetris</h2>
        <p>Acomoda las piezas, completa líneas y supera tu mejor puntuación.</p>
      </div>

      <DifficultyPicker
        disabled={playing}
        onChange={changeDifficulty}
        value={difficulty}
      />

      <div className="blockGameLayout">
        <div className="blockGameStage">
          <div
            className={`blockGameBoard${game.status === "clearing" ? " blockGameBoardClearing" : ""}`}
            role="img"
            aria-label={`Tablero de Tetris. Puntuación ${game.score}. Nivel ${game.level}.`}
            {...boardGestureHandlers}
          >
            {board.flat().map((cell, index) => {
              const row = Math.floor(index / BOARD_COLUMNS);
              const column = index % BOARD_COLUMNS;
              const clearing = game.status === "clearing"
                && game.lastClearedRows.includes(row);
              return (
                <Cell
                  key={index}
                  clearing={clearing}
                  delay={Math.abs(column - ((BOARD_COLUMNS - 1) / 2)) * 4}
                  value={cell}
                />
              );
            })}

            {game.effectId > 0 && game.lastEffect === "land" && (
              <span
                key={`land-${game.effectId}`}
                className="blockGameBoardEffect blockGameLandEffect"
                aria-hidden="true"
              />
            )}

            {game.effectId > 0 && game.lastEffect === "clear" && (
              <span
                key={`clear-${game.effectId}`}
                className="blockGameBoardEffect blockGameClearEffect"
                aria-hidden="true"
              >
                {(game.lastClearedRows ?? []).map((row, index) => (
                  <i
                    key={`row-${row}`}
                    className="blockGameClearRow"
                    style={{
                      "--clear-delay": `${index * 8}ms`,
                      "--clear-row": row,
                    }}
                  />
                ))}
                {Array.from({ length: 14 }, (_, index) => {
                  const rows = game.lastClearedRows?.length
                    ? game.lastClearedRows
                    : [18];
                  const row = rows[index % rows.length];
                  return (
                    <i
                      key={`spark-${index}`}
                      className="blockGameClearSpark"
                      style={{
                        "--spark-delay": `${(index % 5) * 6}ms`,
                        "--spark-drift-x": `${((index % 5) - 2) * 17}px`,
                        "--spark-drift-y": `${-12 - (index % 4) * 7}px`,
                        "--spark-x": `${8 + ((index * 7) % 84)}%`,
                        "--spark-y": `${row * 5 + 2.5}%`,
                      }}
                    />
                  );
                })}
                <span>
                  +{game.lastCleared} {game.lastCleared === 1 ? "línea" : "líneas"}
                </span>
              </span>
            )}

            {game.effectId > 0 && game.lastEffect === "collapse" && (
              <span
                key={`collapse-${game.effectId}`}
                className="blockGameBoardEffect blockGameCollapseEffect"
                aria-hidden="true"
              />
            )}

            {!(["running", "clearing"].includes(game.status)) && (
              <div className="blockGameOverlay">
                {game.status === "paused" ? (
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
                    <Trophy aria-hidden="true" size={30} strokeWidth={1.6} />
                    <strong>{game.status === "over" ? "Fin de la partida" : "¿Lista para jugar?"}</strong>
                    {game.status === "over" && <span>Lograste {game.score} puntos</span>}
                    <button type="button" onClick={begin}>
                      <Play aria-hidden="true" size={16} fill="currentColor" />
                      {game.status === "over" ? "Jugar otra vez" : "Comenzar"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

        </div>

        <aside className="blockGamePanel">
          <div className="blockGameMetrics">
            <Metric label="Puntos" value={game.score.toLocaleString("es-MX")} />
            <Metric label="Líneas" value={game.lines} />
            <Metric label="Nivel" value={game.level} />
            <div className="blockGameMetric blockGameBestMetric">
              <span><Trophy aria-hidden="true" size={14} /> Récord</span>
              <strong>{displayedBestScore.toLocaleString("es-MX")}</strong>
            </div>
          </div>

          <div className="blockGameNext">
            <span>Siguiente pieza</span>
            <div className="blockGamePreview" aria-hidden="true">
              {nextBoard.flat().map((cell, index) => (
                <Cell key={index} value={cell} />
              ))}
            </div>
          </div>

          <div className="blockGameHelp">
            <span><Smartphone aria-hidden="true" size={16} /> En celular</span>
            <p>Usa los controles bajo el tablero. Mantén presionadas las flechas para moverte rápido.</p>
          </div>
          <div className="blockGameHelp blockGameKeyboardHelp">
            <span><Keyboard aria-hidden="true" size={16} /> En computadora</span>
            <p>Flechas para mover, ↑ para girar, espacio para soltar y P para pausar.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
