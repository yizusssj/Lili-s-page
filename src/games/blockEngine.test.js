import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  createEmptyBoard,
  finishLineClear,
  getGhostPiece,
  hardDrop,
  movePiece,
  startGame,
  togglePause,
} from "./blockEngine.js";

describe("block game engine", () => {
  it("crea una partida reproducible y respeta los límites del tablero", () => {
    const game = startGame(() => 0);
    expect(game).toMatchObject({
      level: 1,
      lines: 0,
      nextType: "I",
      score: 0,
      status: "running",
    });
    expect(game.board).toHaveLength(BOARD_ROWS);
    expect(game.board[0]).toHaveLength(BOARD_COLUMNS);

    const atLeftEdge = { ...game, active: { ...game.active, x: 0, y: 0 } };
    expect(movePiece(atLeftEdge, -1, 0)).toBe(atLeftEdge);
    expect(movePiece(atLeftEdge, 1, 0).active.x).toBe(1);
  });

  it("proyecta la posición de caída sin modificar la pieza activa", () => {
    const game = startGame(() => 0);
    const ghost = getGhostPiece(game);
    expect(ghost.y).toBeGreaterThan(game.active.y);
    expect(game.active.y).toBe(-1);
  });

  it("elimina líneas completas y suma puntos al soltar una pieza", () => {
    const board = createEmptyBoard();
    board[BOARD_ROWS - 1] = Array(BOARD_COLUMNS).fill("J");
    board[BOARD_ROWS - 1][4] = null;
    board[BOARD_ROWS - 1][5] = null;

    const game = {
      active: { rotation: 0, type: "O", x: 3, y: 0 },
      board,
      level: 1,
      lines: 0,
      nextType: "I",
      score: 0,
      status: "running",
    };
    const clearing = hardDrop(game, () => 0);

    expect(clearing.status).toBe("clearing");
    expect(clearing.lastEffect).toBe("clear");
    expect(clearing.lastCleared).toBe(1);
    expect(clearing.lastClearedRows).toEqual([BOARD_ROWS - 1]);

    const result = finishLineClear(clearing);

    expect(result.lines).toBe(1);
    expect(result.score).toBeGreaterThanOrEqual(100);
    expect(result.lastEffect).toBe("collapse");
    expect(result.status).toBe("running");
  });

  it("pausa y continúa una partida activa", () => {
    const game = startGame(() => 0.5);
    const paused = togglePause(game);
    expect(paused.status).toBe("paused");
    expect(togglePause(paused).status).toBe("running");
  });
});
