import { describe, expect, it } from "vitest";
import {
  canMergeMove,
  continueMergeGame,
  createMergeGame,
  moveMergeGame,
  startMergeGame,
  toggleMergePause,
} from "./mergeEngine.js";

describe("mergeEngine", () => {
  it("crea dos fichas y respeta la dificultad", () => {
    const game = createMergeGame("intense", () => 0);

    expect(game.board.filter(Boolean)).toHaveLength(2);
    expect(game.difficulty).toBe("intense");
    expect(game.status).toBe("idle");
  });

  it("fusiona una sola vez por movimiento y suma el valor creado", () => {
    const game = {
      ...startMergeGame("normal", () => 0.5),
      board: [
        2, 2, 2, 2,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ],
    };
    const moved = moveMergeGame(game, "left", () => 0.5);

    expect(moved.board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(moved.score).toBe(8);
    expect(moved.lastDirection).toBe("left");
    expect(moved.lastGain).toBe(8);
    expect(moved.lastMergedIndexes).toEqual([0, 1]);
    expect(moved.lastMotionTiles).toEqual([
      { fromIndex: 1, merged: true, toIndex: 0, value: 2 },
      { fromIndex: 2, merged: true, toIndex: 1, value: 2 },
      { fromIndex: 3, merged: true, toIndex: 1, value: 2 },
    ]);
    expect(moved.lastMovedIndexes).toEqual([0, 1]);
    expect(moved.moves).toBe(1);
  });

  it("no suma puntos cuando sólo desplaza fichas", () => {
    const game = {
      ...startMergeGame("normal", () => 0.5),
      board: [
        2, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ],
    };

    const moved = moveMergeGame(game, "right", () => 0.5);
    expect(moved.score).toBe(0);
    expect(moved.lastDirection).toBe("right");
    expect(moved.lastMergedIndexes).toEqual([]);
    expect(moved.lastMotionTiles).toEqual([
      { fromIndex: 0, merged: false, toIndex: 3, value: 2 },
    ]);
    expect(moved.lastMovedIndexes).toEqual([3]);
    expect(moved.lastSpawnedIndex).not.toBe(3);
    expect(moved.moves).toBe(1);
  });

  it("ignora movimientos sin cambio y detecta tableros terminados", () => {
    const game = {
      ...startMergeGame("normal", () => 0),
      board: [
        2, 4, 8, 16,
        32, 64, 128, 256,
        4, 8, 16, 32,
        64, 128, 256, 512,
      ],
    };

    expect(canMergeMove(game.board)).toBe(false);
    expect(moveMergeGame(game, "left", () => 0).status).toBe("over");
    expect(toggleMergePause(game).status).toBe("paused");
  });

  it("celebra 2048 y permite continuar la partida", () => {
    const game = {
      ...startMergeGame("relaxed", () => 0.5),
      board: [
        1024, 1024, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ],
    };
    const won = moveMergeGame(game, "left", () => 0.5);

    expect(won.maxTile).toBe(2048);
    expect(won.score).toBe(2048);
    expect(won.status).toBe("won");
    expect(continueMergeGame(won)).toMatchObject({
      status: "running",
      wonAcknowledged: true,
    });
  });
});
