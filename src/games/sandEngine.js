import { getPieceCells, PIECE_TYPES } from "./blockEngine.js";

export const SAND_COLUMNS = 60;
export const SAND_ROWS = 120;
export const SAND_CELL_SIZE = 6;

export const SAND_PALETTE = [
  null,
  "#61d9e8",
  "#ffcf62",
  "#aa82f5",
  "#70dc98",
  "#ff7e91",
];

export const SAND_DIFFICULTY = {
  relaxed: {
    colorCount: 4,
    dropMs: 880,
    minimumDropMs: 330,
    multiplier: 1,
    sandStepMs: 42,
  },
  normal: {
    colorCount: 4,
    dropMs: 650,
    minimumDropMs: 245,
    multiplier: 1.25,
    sandStepMs: 32,
  },
  intense: {
    colorCount: 5,
    dropMs: 440,
    minimumDropMs: 150,
    multiplier: 1.6,
    sandStepMs: 23,
  },
};

const NEIGHBORS = [
  [0, -1],
  [-1, 0], [1, 0],
  [0, 1],
];

export function createSandBoard() {
  return new Uint8Array(SAND_COLUMNS * SAND_ROWS);
}

function randomIndex(length, random) {
  return Math.min(length - 1, Math.floor(random() * length));
}

function randomPieceType(random) {
  return PIECE_TYPES[randomIndex(PIECE_TYPES.length, random)];
}

function randomColor(difficulty, random) {
  const count = SAND_DIFFICULTY[difficulty].colorCount;
  return randomIndex(count, random) + 1;
}

export function createSandPiece(type, color) {
  return {
    color,
    rotation: 0,
    type,
    x: 3,
    y: -1,
  };
}

export function createSandGame(difficulty = "normal", random = Math.random) {
  const normalizedDifficulty = SAND_DIFFICULTY[difficulty] ? difficulty : "normal";
  const active = createSandPiece(
    randomPieceType(random),
    randomColor(normalizedDifficulty, random),
  );

  return {
    active,
    board: createSandBoard(),
    combo: 0,
    comboRemaining: 0,
    difficulty: normalizedDifficulty,
    effectId: 0,
    fallAccumulator: 0,
    lastCleared: 0,
    lastEffect: null,
    level: 1,
    nextColor: randomColor(normalizedDifficulty, random),
    nextType: randomPieceType(random),
    pathEffect: null,
    paths: 0,
    physicsTick: 0,
    sandAccumulator: 0,
    score: 0,
    status: "idle",
  };
}

export function startSandGame(difficulty = "normal", random = Math.random) {
  return { ...createSandGame(difficulty, random), status: "running" };
}

function particleAreaIsFree(board, macroColumn, macroRow) {
  const startColumn = macroColumn * SAND_CELL_SIZE;
  const startRow = macroRow * SAND_CELL_SIZE;

  for (let y = 0; y < SAND_CELL_SIZE; y += 1) {
    const row = startRow + y;
    if (row < 0) continue;
    if (row >= SAND_ROWS) return false;
    for (let x = 0; x < SAND_CELL_SIZE; x += 1) {
      const column = startColumn + x;
      if (column < 0 || column >= SAND_COLUMNS) return false;
      if (board[row * SAND_COLUMNS + column] !== 0) return false;
    }
  }

  return true;
}

export function canPlaceSandPiece(board, piece) {
  return getPieceCells(piece).every(([columnOffset, rowOffset]) => (
    particleAreaIsFree(
      board,
      piece.x + columnOffset,
      piece.y + rowOffset,
    )
  ));
}

export function moveSandPiece(game, deltaX, deltaY) {
  if (game.status !== "running") return game;
  const active = {
    ...game.active,
    x: game.active.x + deltaX,
    y: game.active.y + deltaY,
  };
  return canPlaceSandPiece(game.board, active) ? { ...game, active } : game;
}

export function rotateSandPiece(game) {
  if (game.status !== "running") return game;

  for (const kick of [0, -1, 1, -2, 2]) {
    const active = {
      ...game.active,
      rotation: game.active.rotation + 1,
      x: game.active.x + kick,
    };
    if (canPlaceSandPiece(game.board, active)) return { ...game, active };
  }

  return game;
}

function pourPieceIntoBoard(board, piece) {
  let toppedOut = false;

  getPieceCells(piece).forEach(([columnOffset, rowOffset]) => {
    const macroColumn = piece.x + columnOffset;
    const macroRow = piece.y + rowOffset;
    const startColumn = macroColumn * SAND_CELL_SIZE;
    const startRow = macroRow * SAND_CELL_SIZE;

    for (let y = 0; y < SAND_CELL_SIZE; y += 1) {
      const row = startRow + y;
      if (row < 0) {
        toppedOut = true;
        continue;
      }
      for (let x = 0; x < SAND_CELL_SIZE; x += 1) {
        const column = startColumn + x;
        board[row * SAND_COLUMNS + column] = piece.color;
      }
    }
  });

  return toppedOut;
}

function lockSandPiece(game, random) {
  const board = new Uint8Array(game.board);
  const toppedOut = pourPieceIntoBoard(board, game.active);
  if (toppedOut) {
    return {
      ...game,
      active: null,
      board,
      effectId: game.effectId + 1,
      lastEffect: "over",
      status: "over",
    };
  }

  const active = createSandPiece(game.nextType, game.nextColor);
  const nextGame = {
    ...game,
    active,
    board,
    effectId: game.effectId + 1,
    fallAccumulator: 0,
    lastCleared: 0,
    lastEffect: "land",
    nextColor: randomColor(game.difficulty, random),
    nextType: randomPieceType(random),
  };

  return canPlaceSandPiece(board, active)
    ? nextGame
    : { ...nextGame, status: "over" };
}

export function softDropSandPiece(game, random = Math.random) {
  if (game.status !== "running") return game;
  const moved = moveSandPiece(game, 0, 1);
  if (moved !== game) return moved;
  return lockSandPiece(game, random);
}

export function hardDropSandPiece(game, random = Math.random) {
  if (game.status !== "running") return game;
  let active = game.active;

  while (canPlaceSandPiece(game.board, { ...active, y: active.y + 1 })) {
    active = { ...active, y: active.y + 1 };
  }

  return lockSandPiece({ ...game, active }, random);
}

function moveParticle(board, from, to) {
  board[to] = board[from];
  board[from] = 0;
}

export function simulateSand(board, physicsTick = 0, random = Math.random) {
  const next = new Uint8Array(board);
  const leftToRight = physicsTick % 2 === 0;

  for (let row = SAND_ROWS - 2; row >= 0; row -= 1) {
    for (let offset = 0; offset < SAND_COLUMNS; offset += 1) {
      const column = leftToRight ? offset : SAND_COLUMNS - 1 - offset;
      const index = row * SAND_COLUMNS + column;
      if (next[index] === 0) continue;

      const below = index + SAND_COLUMNS;
      if (next[below] === 0) {
        moveParticle(next, index, below);
        continue;
      }

      const preferLeft = random() < 0.5;
      const directions = preferLeft ? [-1, 1] : [1, -1];
      for (const direction of directions) {
        const diagonalColumn = column + direction;
        if (diagonalColumn < 0 || diagonalColumn >= SAND_COLUMNS) continue;
        const diagonal = below + direction;
        if (next[diagonal] === 0) {
          moveParticle(next, index, diagonal);
          break;
        }
      }
    }
  }

  return next;
}

export function clearConnectedSand(board) {
  const next = new Uint8Array(board);
  const visited = new Uint8Array(next.length);
  const clearedGrains = [];
  let cleared = 0;
  let paths = 0;

  for (let startRow = 0; startRow < SAND_ROWS; startRow += 1) {
    const start = startRow * SAND_COLUMNS;
    const color = next[start];
    if (color === 0 || visited[start]) continue;

    const queue = [start];
    const component = [];
    visited[start] = 1;
    let touchesRight = false;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      component.push(index);
      const row = Math.floor(index / SAND_COLUMNS);
      const column = index % SAND_COLUMNS;
      if (column === SAND_COLUMNS - 1) touchesRight = true;

      NEIGHBORS.forEach(([deltaX, deltaY]) => {
        const neighborColumn = column + deltaX;
        const neighborRow = row + deltaY;
        if (
          neighborColumn < 0 ||
          neighborColumn >= SAND_COLUMNS ||
          neighborRow < 0 ||
          neighborRow >= SAND_ROWS
        ) {
          return;
        }
        const neighbor = neighborRow * SAND_COLUMNS + neighborColumn;
        if (!visited[neighbor] && next[neighbor] === color) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      });
    }

    if (touchesRight) {
      component.forEach((index) => {
        clearedGrains.push(index * 8 + color);
        next[index] = 0;
      });
      cleared += component.length;
      paths += 1;
    }
  }

  return { board: next, cleared, clearedGrains, paths };
}

export function advanceSandGame(game, deltaMs, random = Math.random) {
  if (game.status !== "running") return game;
  const config = SAND_DIFFICULTY[game.difficulty];
  const effectRemaining = game.pathEffect
    ? game.pathEffect.remaining - deltaMs
    : 0;
  let next = {
    ...game,
    comboRemaining: Math.max(0, game.comboRemaining - deltaMs),
    fallAccumulator: game.fallAccumulator + deltaMs,
    pathEffect: effectRemaining > 0
      ? { ...game.pathEffect, remaining: effectRemaining }
      : null,
    sandAccumulator: game.sandAccumulator + deltaMs,
  };
  if (next.comboRemaining === 0) next.combo = 0;

  while (next.sandAccumulator >= config.sandStepMs && next.status === "running") {
    const settled = simulateSand(next.board, next.physicsTick, random);
    const result = clearConnectedSand(settled);
    const madePath = result.paths > 0;
    const combo = madePath ? Math.min(10, Math.max(1, next.combo + 1)) : next.combo;
    const score = madePath
      ? next.score + Math.round(result.cleared * combo * config.multiplier)
      : next.score;
    const paths = next.paths + result.paths;

    next = {
      ...next,
      board: result.board,
      combo,
      comboRemaining: madePath ? 2600 : next.comboRemaining,
      effectId: madePath ? next.effectId + 1 : next.effectId,
      lastCleared: madePath ? result.cleared : next.lastCleared,
      lastEffect: madePath ? "path" : next.lastEffect,
      level: Math.floor(paths / 4) + 1,
      pathEffect: madePath
        ? {
            duration: 680,
            grains: result.clearedGrains,
            remaining: 680,
          }
        : next.pathEffect,
      paths,
      physicsTick: next.physicsTick + 1,
      sandAccumulator: next.sandAccumulator - config.sandStepMs,
      score,
    };
  }

  const dropMs = Math.max(
    config.minimumDropMs,
    config.dropMs - (next.level - 1) * 38,
  );
  while (next.fallAccumulator >= dropMs && next.status === "running") {
    const remainingFallTime = next.fallAccumulator - dropMs;
    const moved = moveSandPiece(next, 0, 1);
    const didMove = moved !== next;
    next = didMove ? moved : lockSandPiece(next, random);
    next = {
      ...next,
      fallAccumulator: didMove ? remainingFallTime : 0,
    };
  }

  return next;
}

export function toggleSandPause(game) {
  if (game.status === "running") return { ...game, status: "paused" };
  if (game.status === "paused") return { ...game, status: "running" };
  return game;
}
