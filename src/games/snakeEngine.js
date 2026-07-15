export const SNAKE_SIZE = 20;

export const SNAKE_DIRECTIONS = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

export const SNAKE_DIFFICULTY = {
  relaxed: { baseTickMs: 205, minimumTickMs: 105 },
  normal: { baseTickMs: 145, minimumTickMs: 78 },
  intense: { baseTickMs: 98, minimumTickMs: 54 },
};

function sameCell(first, second) {
  return first.x === second.x && first.y === second.y;
}

function isOpposite(first, second) {
  const firstVector = SNAKE_DIRECTIONS[first];
  const secondVector = SNAKE_DIRECTIONS[second];
  return firstVector.x + secondVector.x === 0
    && firstVector.y + secondVector.y === 0;
}

export function createSnakeFood(snake, random = Math.random) {
  const occupied = new Set(snake.map(({ x, y }) => `${x}:${y}`));
  const empty = [];

  for (let y = 0; y < SNAKE_SIZE; y += 1) {
    for (let x = 0; x < SNAKE_SIZE; x += 1) {
      if (!occupied.has(`${x}:${y}`)) empty.push({ x, y });
    }
  }

  if (empty.length === 0) return null;
  const index = Math.min(empty.length - 1, Math.floor(random() * empty.length));
  return empty[index];
}

export function createSnakeGame(difficulty = "normal", random = Math.random) {
  const normalizedDifficulty = SNAKE_DIFFICULTY[difficulty] ? difficulty : "normal";
  const center = Math.floor(SNAKE_SIZE / 2);
  const snake = [
    { x: center + 1, y: center },
    { x: center, y: center },
    { x: center - 1, y: center },
  ];

  return {
    difficulty: normalizedDifficulty,
    direction: "right",
    effectId: 0,
    food: createSnakeFood(snake, random),
    foods: 0,
    lastEffect: null,
    level: 1,
    pendingDirection: "right",
    score: 0,
    snake,
    status: "idle",
    turnLocked: false,
  };
}

export function startSnakeGame(difficulty = "normal", random = Math.random) {
  return { ...createSnakeGame(difficulty, random), status: "running" };
}

export function changeSnakeDirection(game, direction) {
  if (
    game.status !== "running"
    || !SNAKE_DIRECTIONS[direction]
    || game.turnLocked
    || direction === game.direction
    || isOpposite(game.direction, direction)
  ) {
    return game;
  }

  return {
    ...game,
    pendingDirection: direction,
    turnLocked: true,
  };
}

export function stepSnakeGame(game, random = Math.random) {
  if (game.status !== "running") return game;

  const direction = game.pendingDirection;
  const vector = SNAKE_DIRECTIONS[direction];
  const head = game.snake[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  const hitWall = nextHead.x < 0
    || nextHead.x >= SNAKE_SIZE
    || nextHead.y < 0
    || nextHead.y >= SNAKE_SIZE;
  const eating = game.food && sameCell(nextHead, game.food);
  const bodyToCheck = eating ? game.snake : game.snake.slice(0, -1);
  const hitBody = bodyToCheck.some((cell) => sameCell(cell, nextHead));

  if (hitWall || hitBody) {
    return {
      ...game,
      direction,
      effectId: game.effectId + 1,
      lastEffect: "crash",
      status: "over",
      turnLocked: false,
    };
  }

  const snake = [nextHead, ...game.snake];
  if (!eating) snake.pop();

  if (!eating) {
    return {
      ...game,
      direction,
      lastEffect: "move",
      pendingDirection: direction,
      snake,
      turnLocked: false,
    };
  }

  const foods = game.foods + 1;
  const level = Math.floor(foods / 5) + 1;
  const food = createSnakeFood(snake, random);
  return {
    ...game,
    direction,
    effectId: game.effectId + 1,
    food,
    foods,
    lastEffect: food ? "eat" : "win",
    level,
    pendingDirection: direction,
    score: game.score + 100 * game.level,
    snake,
    status: food ? "running" : "won",
    turnLocked: false,
  };
}

export function getSnakeTickMs(game) {
  const config = SNAKE_DIFFICULTY[game.difficulty];
  return Math.max(config.minimumTickMs, config.baseTickMs - (game.level - 1) * 9);
}

export function toggleSnakePause(game) {
  if (game.status === "running") return { ...game, status: "paused" };
  if (game.status === "paused") return { ...game, status: "running" };
  return game;
}
