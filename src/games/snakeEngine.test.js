import { describe, expect, it } from "vitest";
import {
  changeSnakeDirection,
  createSnakeGame,
  getSnakeTickMs,
  SNAKE_SIZE,
  startSnakeGame,
  stepSnakeGame,
  toggleSnakePause,
} from "./snakeEngine.js";

describe("snakeEngine", () => {
  it("crea una partida reproducible y cambia de dirección sin giros imposibles", () => {
    const game = startSnakeGame("normal", () => 0);
    const left = changeSnakeDirection(game, "left");
    const up = changeSnakeDirection(game, "up");

    expect(game.snake).toHaveLength(3);
    expect(game.status).toBe("running");
    expect(left).toBe(game);
    expect(up.pendingDirection).toBe("up");
    expect(changeSnakeDirection(up, "left")).toBe(up);
  });

  it("sólo suma puntos al comer y sube de nivel cada cinco frutas", () => {
    const game = startSnakeGame("normal", () => 0);
    const head = game.snake[0];
    const moved = stepSnakeGame(game, () => 0);
    const eating = {
      ...game,
      food: { x: head.x + 1, y: head.y },
      foods: 4,
      level: 1,
    };
    const ate = stepSnakeGame(eating, () => 0);

    expect(moved.score).toBe(0);
    expect(ate.score).toBe(100);
    expect(ate.foods).toBe(5);
    expect(ate.level).toBe(2);
    expect(ate.snake).toHaveLength(4);
  });

  it("termina al golpear una pared y permite pausar", () => {
    const game = {
      ...createSnakeGame("intense", () => 0),
      direction: "right",
      pendingDirection: "right",
      snake: [{ x: SNAKE_SIZE - 1, y: 4 }, { x: SNAKE_SIZE - 2, y: 4 }],
      status: "running",
    };

    expect(stepSnakeGame(game, () => 0).status).toBe("over");
    expect(toggleSnakePause(game).status).toBe("paused");
    expect(toggleSnakePause(toggleSnakePause(game)).status).toBe("running");
    expect(getSnakeTickMs(game)).toBeLessThan(getSnakeTickMs({ ...game, difficulty: "relaxed" }));
  });

  it("termina al tocar su propio cuerpo", () => {
    const game = {
      ...startSnakeGame("normal", () => 0),
      direction: "down",
      pendingDirection: "down",
      snake: [
        { x: 4, y: 4 },
        { x: 4, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 4 },
      ],
    };

    expect(stepSnakeGame(game, () => 0)).toMatchObject({
      lastEffect: "crash",
      status: "over",
    });
  });
});
