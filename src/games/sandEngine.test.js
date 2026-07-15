import { describe, expect, it } from "vitest";
import {
  clearConnectedSand,
  createSandBoard,
  createSandGame,
  hardDropSandPiece,
  SAND_COLUMNS,
  simulateSand,
  startSandGame,
  toggleSandPause,
} from "./sandEngine.js";

describe("sandEngine", () => {
  it("hace caer cada grano y forma pendientes cuando encuentra un obstáculo", () => {
    const board = createSandBoard();
    board[0] = 1;

    const fallen = simulateSand(board, 0, () => 0);
    expect(fallen[0]).toBe(0);
    expect(fallen[SAND_COLUMNS]).toBe(1);

    const blocked = createSandBoard();
    const penultimateRow = 118;
    blocked[penultimateRow * SAND_COLUMNS] = 2;
    blocked[(penultimateRow + 1) * SAND_COLUMNS] = 4;
    const sloped = simulateSand(blocked, 0, () => 0);
    expect(sloped[(penultimateRow + 1) * SAND_COLUMNS + 1]).toBe(2);
  });

  it("elimina únicamente colores conectados de izquierda a derecha", () => {
    const board = createSandBoard();
    const connectedRow = 70;
    const isolatedRow = 74;

    for (let column = 0; column < SAND_COLUMNS; column += 1) {
      board[connectedRow * SAND_COLUMNS + column] = 3;
    }
    for (let column = 0; column < 12; column += 1) {
      board[isolatedRow * SAND_COLUMNS + column] = 2;
    }

    const result = clearConnectedSand(board);
    expect(result.paths).toBe(1);
    expect(result.cleared).toBe(SAND_COLUMNS);
    expect(result.clearedGrains).toHaveLength(SAND_COLUMNS);
    expect(result.board[connectedRow * SAND_COLUMNS]).toBe(0);
    expect(result.board[isolatedRow * SAND_COLUMNS]).toBe(2);
  });

  it("convierte la pieza rígida en 144 granos al aterrizar", () => {
    const game = startSandGame("normal", () => 0);
    const dropped = hardDropSandPiece(game, () => 0);
    const grains = dropped.board.reduce(
      (total, value) => total + Number(value !== 0),
      0,
    );

    expect(grains).toBe(144);
    expect(dropped.active).not.toBeNull();
    expect(dropped.effectId).toBe(1);
    expect(dropped.lastEffect).toBe("land");
    expect(dropped.score).toBeGreaterThan(0);
  });

  it("respeta la dificultad elegida y permite pausar", () => {
    const game = createSandGame("intense", () => 0);
    expect(game.difficulty).toBe("intense");

    const running = { ...game, status: "running" };
    expect(toggleSandPause(running).status).toBe("paused");
    expect(toggleSandPause(toggleSandPause(running)).status).toBe("running");
  });
});
