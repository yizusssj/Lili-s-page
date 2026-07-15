import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleDot,
  Hand,
  Keyboard,
  Pause,
  Play,
  Trophy,
} from "lucide-react";
import { readJSON, writeJSON } from "../utils/storage.js";
import DifficultyPicker from "./DifficultyPicker.jsx";
import useDirectionalGesture from "./useDirectionalGesture.js";
import {
  changeSnakeDirection,
  createSnakeGame,
  getSnakeTickMs,
  SNAKE_SIZE,
  startSnakeGame,
  stepSnakeGame,
  toggleSnakePause,
} from "./snakeEngine.js";

const BEST_SCORES_KEY = "lili_game_snake_best_v1";
const EMPTY_BEST_SCORES = { intense: 0, normal: 0, relaxed: 0 };

function readBestScores() {
  return readJSON(
    BEST_SCORES_KEY,
    EMPTY_BEST_SCORES,
    (value) => value && typeof value === "object",
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

export default function SnakeGame({ onBack }) {
  const [difficulty, setDifficulty] = useState("normal");
  const [game, setGame] = useState(() => createSnakeGame("normal"));
  const [bestScores, setBestScores] = useState(readBestScores);
  const playing = game.status === "running" || game.status === "paused";
  const displayedBest = Math.max(bestScores[difficulty] ?? 0, game.score);
  const tickMs = getSnakeTickMs(game);

  const turn = useCallback((direction) => {
    setGame((current) => changeSnakeDirection(current, direction));
  }, []);

  const pause = useCallback(() => {
    setGame((current) => toggleSnakePause(current));
  }, []);

  const begin = useCallback(() => {
    setBestScores((current) => {
      if (game.score <= (current[difficulty] ?? 0)) return current;
      const next = { ...current, [difficulty]: game.score };
      writeJSON(BEST_SCORES_KEY, next);
      return next;
    });
    setGame(startSnakeGame(difficulty));
  }, [difficulty, game.score]);

  const changeDifficulty = useCallback((nextDifficulty) => {
    setDifficulty(nextDifficulty);
    setGame(createSnakeGame(nextDifficulty));
  }, []);

  useEffect(() => {
    if (game.status !== "running") return undefined;
    const timerId = window.setInterval(() => {
      setGame((current) => stepSnakeGame(current));
    }, tickMs);
    return () => window.clearInterval(timerId);
  }, [game.status, tickMs]);

  useEffect(() => {
    if (!["over", "won"].includes(game.status)) return;
    if (game.score > (bestScores[difficulty] ?? 0)) {
      writeJSON(BEST_SCORES_KEY, { ...bestScores, [difficulty]: game.score });
    }
  }, [bestScores, difficulty, game.score, game.status]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) {
        return;
      }
      const direction = {
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        a: "left",
        A: "left",
        d: "right",
        D: "right",
        s: "down",
        S: "down",
        w: "up",
        W: "up",
      }[event.key];
      if (direction) {
        event.preventDefault();
        turn(direction);
        return;
      }
      if (["p", "P", " "].includes(event.key)) {
        event.preventDefault();
        pause();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pause, turn]);

  useEffect(() => {
    function pauseWhenHidden() {
      if (document.visibilityState === "hidden") {
        setGame((current) => (
          current.status === "running" ? toggleSnakePause(current) : current
        ));
      }
    }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const gestureHandlers = useDirectionalGesture({
    continuous: true,
    enabled: game.status === "running",
    onDirection: turn,
    threshold: 22,
  });
  const snakeCells = useMemo(
    () => new Map(game.snake.map((cell, index) => [`${cell.x}:${cell.y}`, index])),
    [game.snake],
  );

  return (
    <section className={`blockGameShell snakeGameShell${playing ? " blockGameShellPlaying" : ""}`}>
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

      <div className="blockGameHeading snakeGameHeading">
        <span>Clásico renovado</span>
        <h2>Snake</h2>
        <p>Come, crece y cuida cada giro para superar tu récord.</p>
      </div>

      <DifficultyPicker disabled={playing} onChange={changeDifficulty} value={difficulty} />

      <div className="blockGameLayout squareGameLayout">
        <div className="blockGameStage">
          <div
            className={`snakeGameBoard${game.lastEffect === "crash" ? " snakeGameBoardCrash" : ""}`}
            role="img"
            aria-label={`Tablero de Snake. Puntuación ${game.score}. Frutas ${game.foods}.`}
            {...gestureHandlers}
          >
            <div className="snakeGameGrid" aria-hidden="true">
              {Array.from({ length: SNAKE_SIZE * SNAKE_SIZE }, (_, index) => {
                const x = index % SNAKE_SIZE;
                const y = Math.floor(index / SNAKE_SIZE);
                const snakeIndex = snakeCells.get(`${x}:${y}`);
                const food = game.food?.x === x && game.food?.y === y;
                const className = food
                  ? "snakeCell snakeFood"
                  : snakeIndex === 0
                    ? `snakeCell snakeHead snakeHead${game.direction}`
                    : snakeIndex !== undefined
                      ? "snakeCell snakeBody"
                      : "snakeCell";
                return <span key={index} className={className} />;
              })}
            </div>

            {game.effectId > 0 && game.lastEffect === "eat" && (
              <span key={`eat-${game.effectId}`} className="snakeEatBurst" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
                <strong>+{100 * Math.max(1, game.level - (game.foods % 5 === 0 ? 1 : 0))}</strong>
              </span>
            )}

            {game.status !== "running" && (
              <div className="blockGameOverlay snakeGameOverlay">
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
                    <CircleDot aria-hidden="true" size={30} strokeWidth={1.6} />
                    <strong>
                      {game.status === "over"
                        ? "La serpiente chocó"
                        : game.status === "won"
                          ? "¡Tablero completado!"
                          : "¿Lista para jugar?"}
                    </strong>
                    {["over", "won"].includes(game.status) && (
                      <span>Lograste {game.score.toLocaleString("es-MX")} puntos</span>
                    )}
                    <button type="button" onClick={begin}>
                      <Play aria-hidden="true" size={16} fill="currentColor" />
                      {["over", "won"].includes(game.status) ? "Jugar otra vez" : "Comenzar"}
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
            <Metric label="Frutas" value={game.foods} />
            <Metric label="Nivel" value={game.level} />
            <div className="blockGameMetric blockGameBestMetric">
              <span><Trophy aria-hidden="true" size={14} /> Récord</span>
              <strong>{displayedBest.toLocaleString("es-MX")}</strong>
            </div>
          </div>
          <div className="blockGameHelp">
            <span><Hand aria-hidden="true" size={16} /> Gestos</span>
            <p>Desliza en cualquier dirección. Puedes cambiar de rumbo sin despegar el dedo.</p>
          </div>
          <div className="blockGameHelp blockGameKeyboardHelp">
            <span><Keyboard aria-hidden="true" size={16} /> Teclado</span>
            <p>Usa flechas o WASD para girar y P o espacio para pausar.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
