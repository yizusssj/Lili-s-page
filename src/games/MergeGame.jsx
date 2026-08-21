import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Hand,
  Keyboard,
  Pause,
  Play,
  Sparkles,
  Trophy,
} from "lucide-react";
import { readJSON, writeJSON } from "../utils/storage.js";
import DifficultyPicker from "./DifficultyPicker.jsx";
import {
  continueMergeGame,
  createMergeGame,
  moveMergeGame,
  startMergeGame,
  toggleMergePause,
} from "./mergeEngine.js";
import useDirectionalGesture from "./useDirectionalGesture.js";

const BEST_SCORES_KEY = "lili_game_2048_best_v1";
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

export default function MergeGame({ onBack }) {
  const [difficulty, setDifficulty] = useState("normal");
  const [game, setGame] = useState(() => createMergeGame("normal"));
  const [bestScores, setBestScores] = useState(readBestScores);
  const playing = ["paused", "running", "won"].includes(game.status);
  const displayedBest = Math.max(bestScores[difficulty] ?? 0, game.score);
  const moveDirection = ["merge", "move"].includes(game.lastEffect) ? game.lastDirection : null;

  const move = useCallback((direction) => {
    setGame((current) => moveMergeGame(current, direction));
  }, []);
  const pause = useCallback(() => {
    setGame((current) => toggleMergePause(current));
  }, []);
  const begin = useCallback(() => {
    setBestScores((current) => {
      if (game.score <= (current[difficulty] ?? 0)) return current;
      const next = { ...current, [difficulty]: game.score };
      writeJSON(BEST_SCORES_KEY, next);
      return next;
    });
    setGame(startMergeGame(difficulty));
  }, [difficulty, game.score]);
  const changeDifficulty = useCallback((nextDifficulty) => {
    setDifficulty(nextDifficulty);
    setGame(createMergeGame(nextDifficulty));
  }, []);

  useEffect(() => {
    if (game.score <= (bestScores[difficulty] ?? 0)) return;
    writeJSON(BEST_SCORES_KEY, { ...bestScores, [difficulty]: game.score });
  }, [bestScores, difficulty, game.score]);

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
        move(direction);
        return;
      }
      if (["p", "P", " "].includes(event.key)) {
        event.preventDefault();
        pause();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move, pause]);

  useEffect(() => {
    function pauseWhenHidden() {
      if (document.visibilityState === "hidden") {
        setGame((current) => (
          current.status === "running" ? toggleMergePause(current) : current
        ));
      }
    }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const gestureHandlers = useDirectionalGesture({
    enabled: game.status === "running",
    onDirection: move,
    threshold: 26,
  });

  return (
    <section className={`blockGameShell mergeGameShell${playing ? " blockGameShellPlaying" : ""}`}>
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
            disabled={!game.status || !["paused", "running"].includes(game.status)}
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

      <div className="blockGameHeading mergeGameHeading">
        <span>Estrategia tranquila</span>
        <h2>2048</h2>
        <p>Desliza, combina números iguales y construye la ficha más alta.</p>
      </div>

      <DifficultyPicker disabled={playing} onChange={changeDifficulty} value={difficulty} />

      <div className="blockGameLayout squareGameLayout">
        <div className="blockGameStage">
          <div
            className={`mergeGameBoard${game.lastEffect === "merge" ? " mergeGameBoardMerged" : ""}${game.lastDirection ? ` mergeGameBoardMove mergeGameBoardMove-${game.lastDirection}` : ""}`}
            role="img"
            aria-label={`Tablero de 2048. Puntuación ${game.score}. Ficha máxima ${game.maxTile}.`}
            {...gestureHandlers}
          >
            <div className="mergeGameGrid" aria-hidden="true">
              {game.board.map((value, index) => (
                <span key={index} className="mergeGameCell">
                  {value > 0 && (
                    <strong
                      key={`${game.effectId}-${index}-${value}`}
                      className="mergeGameTile"
                      data-value={Math.min(value, 8192)}
                      data-move-direction={moveDirection}
                    >
                      {value}
                    </strong>
                  )}
                </span>
              ))}
            </div>

            {game.effectId > 0 && game.lastEffect === "merge" && game.lastGain > 0 && (
              <span key={`gain-${game.effectId}`} className="mergeGameGain" aria-hidden="true">
                +{game.lastGain.toLocaleString("es-MX")}
              </span>
            )}

            {game.status !== "running" && (
              <div className="blockGameOverlay mergeGameOverlay">
                {game.status === "paused" ? (
                  <>
                    <Pause aria-hidden="true" size={28} strokeWidth={1.7} />
                    <strong>Partida en pausa</strong>
                    <button type="button" onClick={pause}>
                      <Play aria-hidden="true" size={16} fill="currentColor" />
                      Continuar
                    </button>
                  </>
                ) : game.status === "won" ? (
                  <>
                    <Sparkles aria-hidden="true" size={30} strokeWidth={1.6} />
                    <strong>¡Llegaste a 2048!</strong>
                    <span>Puedes seguir construyendo fichas más grandes.</span>
                    <button type="button" onClick={() => setGame((current) => continueMergeGame(current))}>
                      <Play aria-hidden="true" size={16} fill="currentColor" />
                      Seguir jugando
                    </button>
                  </>
                ) : (
                  <>
                    <Brain aria-hidden="true" size={30} strokeWidth={1.6} />
                    <strong>{game.status === "over" ? "No quedan movimientos" : "¿Lista para combinar?"}</strong>
                    {game.status === "over" && (
                      <span>Lograste {game.score.toLocaleString("es-MX")} puntos</span>
                    )}
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
            <Metric label="Movidas" value={game.moves} />
            <Metric label="Ficha" value={game.maxTile} />
            <div className="blockGameMetric blockGameBestMetric">
              <span><Trophy aria-hidden="true" size={14} /> Récord</span>
              <strong>{displayedBest.toLocaleString("es-MX")}</strong>
            </div>
          </div>
          <div className="blockGameHelp">
            <span><Hand aria-hidden="true" size={16} /> Gestos</span>
            <p>Desliza el tablero hacia donde quieras mover todas las fichas.</p>
          </div>
          <div className="blockGameHelp blockGameKeyboardHelp">
            <span><Keyboard aria-hidden="true" size={16} /> Teclado</span>
            <p>Usa flechas o WASD para combinar y P o espacio para pausar.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
