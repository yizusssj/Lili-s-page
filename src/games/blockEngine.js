export const BOARD_COLUMNS = 10;
export const BOARD_ROWS = 20;

export const PIECE_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

const LINE_SCORES = [0, 100, 300, 500, 800];

export function createEmptyBoard() {
  return Array.from(
    { length: BOARD_ROWS },
    () => Array(BOARD_COLUMNS).fill(null),
  );
}

export function getPieceCells(piece) {
  const rotations = SHAPES[piece.type];
  return rotations[piece.rotation % rotations.length];
}

function randomPieceType(random) {
  const index = Math.min(
    PIECE_TYPES.length - 1,
    Math.floor(random() * PIECE_TYPES.length),
  );
  return PIECE_TYPES[index];
}

export function createPiece(type) {
  return {
    rotation: 0,
    type,
    x: Math.floor((BOARD_COLUMNS - 4) / 2),
    y: -1,
  };
}

export function createGame(random = Math.random) {
  return {
    active: createPiece(randomPieceType(random)),
    board: createEmptyBoard(),
    effectId: 0,
    lastCleared: 0,
    lastClearedRows: [],
    lastEffect: null,
    level: 1,
    lines: 0,
    nextType: randomPieceType(random),
    pendingClear: null,
    score: 0,
    status: "idle",
  };
}

export function startGame(random = Math.random) {
  return { ...createGame(random), status: "running" };
}

export function canPlace(board, piece) {
  return getPieceCells(piece).every(([columnOffset, rowOffset]) => {
    const column = piece.x + columnOffset;
    const row = piece.y + rowOffset;
    if (column < 0 || column >= BOARD_COLUMNS || row >= BOARD_ROWS) return false;
    return row < 0 || board[row][column] === null;
  });
}

export function movePiece(game, deltaX, deltaY) {
  if (game.status !== "running") return game;
  const active = {
    ...game.active,
    x: game.active.x + deltaX,
    y: game.active.y + deltaY,
  };
  return canPlace(game.board, active) ? { ...game, active } : game;
}

export function rotatePiece(game) {
  if (game.status !== "running") return game;
  const rotations = SHAPES[game.active.type].length;
  const nextRotation = (game.active.rotation + 1) % rotations;

  for (const kick of [0, -1, 1, -2, 2]) {
    const active = {
      ...game.active,
      rotation: nextRotation,
      x: game.active.x + kick,
    };
    if (canPlace(game.board, active)) return { ...game, active };
  }

  return game;
}

function clearCompletedLines(board) {
  const clearedRows = [];
  const remaining = [];
  board.forEach((row, index) => {
    if (row.every((cell) => cell !== null)) clearedRows.push(index);
    else remaining.push(row);
  });
  const cleared = clearedRows.length;
  const emptyRows = Array.from(
    { length: cleared },
    () => Array(BOARD_COLUMNS).fill(null),
  );
  return { board: [...emptyRows, ...remaining], cleared, clearedRows };
}

function lockPiece(game, random) {
  const board = game.board.map((row) => [...row]);
  let toppedOut = false;

  getPieceCells(game.active).forEach(([columnOffset, rowOffset]) => {
    const column = game.active.x + columnOffset;
    const row = game.active.y + rowOffset;
    if (row < 0) toppedOut = true;
    else board[row][column] = game.active.type;
  });

  if (toppedOut) {
    return {
      ...game,
      active: null,
      board,
      effectId: (game.effectId ?? 0) + 1,
      lastEffect: "over",
      status: "over",
    };
  }

  const result = clearCompletedLines(board);
  if (result.cleared > 0) {
    return {
      ...game,
      active: null,
      board,
      effectId: (game.effectId ?? 0) + 1,
      lastCleared: result.cleared,
      lastClearedRows: result.clearedRows,
      lastEffect: "clear",
      pendingClear: { nextType: randomPieceType(random) },
      status: "clearing",
    };
  }

  const lines = game.lines + result.cleared;
  const level = Math.floor(lines / 10) + 1;
  const score = game.score + LINE_SCORES[result.cleared] * game.level;
  const active = createPiece(game.nextType);
  const nextGame = {
    ...game,
    active,
    board: result.board,
    effectId: (game.effectId ?? 0) + 1,
    lastCleared: result.cleared,
    lastClearedRows: result.clearedRows,
    lastEffect: result.cleared > 0 ? "clear" : "land",
    level,
    lines,
    nextType: randomPieceType(random),
    pendingClear: null,
    score,
  };

  return canPlace(nextGame.board, active)
    ? nextGame
    : { ...nextGame, status: "over" };
}

export function finishLineClear(game) {
  if (game.status !== "clearing") return game;
  const result = clearCompletedLines(game.board);
  const lines = game.lines + result.cleared;
  const level = Math.floor(lines / 10) + 1;
  const score = game.score + LINE_SCORES[result.cleared] * game.level;
  const active = createPiece(game.nextType);
  const nextGame = {
    ...game,
    active,
    board: result.board,
    effectId: (game.effectId ?? 0) + 1,
    lastEffect: "collapse",
    level,
    lines,
    nextType: game.pendingClear?.nextType ?? game.nextType,
    pendingClear: null,
    score,
    status: "running",
  };

  return canPlace(nextGame.board, active)
    ? nextGame
    : { ...nextGame, status: "over" };
}

export function softDrop(game, random = Math.random) {
  if (game.status !== "running") return game;
  const moved = movePiece(game, 0, 1);
  if (moved !== game) return moved;
  return lockPiece(game, random);
}

export function tickGame(game, random = Math.random) {
  if (game.status !== "running") return game;
  const moved = movePiece(game, 0, 1);
  return moved !== game ? moved : lockPiece(game, random);
}

export function hardDrop(game, random = Math.random) {
  if (game.status !== "running") return game;
  let active = game.active;

  while (canPlace(game.board, { ...active, y: active.y + 1 })) {
    active = { ...active, y: active.y + 1 };
  }

  return lockPiece({ ...game, active }, random);
}

export function togglePause(game) {
  if (game.status === "running") return { ...game, status: "paused" };
  if (game.status === "paused") return { ...game, status: "running" };
  return game;
}

export function getGhostPiece(game) {
  if (!game.active || game.status !== "running") return null;
  let ghost = game.active;
  while (canPlace(game.board, { ...ghost, y: ghost.y + 1 })) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }
  return ghost;
}

function paintPiece(board, piece, value, onlyEmpty = false) {
  if (!piece) return;
  getPieceCells(piece).forEach(([columnOffset, rowOffset]) => {
    const column = piece.x + columnOffset;
    const row = piece.y + rowOffset;
    if (
      row >= 0 &&
      row < BOARD_ROWS &&
      column >= 0 &&
      column < BOARD_COLUMNS &&
      (!onlyEmpty || board[row][column] === null)
    ) {
      board[row][column] = value;
    }
  });
}

export function getVisibleBoard(game) {
  const board = game.board.map((row) => [...row]);
  const ghost = getGhostPiece(game);
  paintPiece(board, ghost, ghost ? `ghost-${ghost.type}` : null, true);
  paintPiece(board, game.active, game.active?.type ?? null);
  return board;
}

export function getNextPieceBoard(type) {
  const board = Array.from({ length: 4 }, () => Array(4).fill(null));
  getPieceCells(createPiece(type)).forEach(([column, row]) => {
    board[row][column] = type;
  });
  return board;
}
