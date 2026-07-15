export const MERGE_SIZE = 4;

export const MERGE_DIFFICULTY = {
  relaxed: { fourChance: 0.04 },
  normal: { fourChance: 0.1 },
  intense: { fourChance: 0.22 },
};

function randomIndex(length, random) {
  return Math.min(length - 1, Math.floor(random() * length));
}

export function spawnMergeTile(board, difficulty = "normal", random = Math.random) {
  const empty = board
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);
  if (empty.length === 0) return board;

  const next = [...board];
  const index = empty[randomIndex(empty.length, random)];
  const config = MERGE_DIFFICULTY[difficulty] ?? MERGE_DIFFICULTY.normal;
  next[index] = random() < config.fourChance ? 4 : 2;
  return next;
}

export function createMergeGame(difficulty = "normal", random = Math.random) {
  const normalizedDifficulty = MERGE_DIFFICULTY[difficulty] ? difficulty : "normal";
  let board = Array(MERGE_SIZE * MERGE_SIZE).fill(0);
  board = spawnMergeTile(board, normalizedDifficulty, random);
  board = spawnMergeTile(board, normalizedDifficulty, random);

  return {
    board,
    difficulty: normalizedDifficulty,
    effectId: 0,
    lastEffect: null,
    lastGain: 0,
    maxTile: Math.max(...board),
    moves: 0,
    score: 0,
    status: "idle",
    wonAcknowledged: false,
  };
}

export function startMergeGame(difficulty = "normal", random = Math.random) {
  return { ...createMergeGame(difficulty, random), status: "running" };
}

function collapseLine(line) {
  const values = line.filter(Boolean);
  const merged = [];
  let score = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const value = values[index] * 2;
      merged.push(value);
      score += value;
      index += 1;
    } else {
      merged.push(values[index]);
    }
  }

  while (merged.length < MERGE_SIZE) merged.push(0);
  return { line: merged, score };
}

function getLine(board, direction, index) {
  if (direction === "left") {
    return Array.from({ length: MERGE_SIZE }, (_, column) => board[index * MERGE_SIZE + column]);
  }
  if (direction === "right") {
    return Array.from({ length: MERGE_SIZE }, (_, column) => board[index * MERGE_SIZE + (MERGE_SIZE - 1 - column)]);
  }
  if (direction === "up") {
    return Array.from({ length: MERGE_SIZE }, (_, row) => board[row * MERGE_SIZE + index]);
  }
  return Array.from({ length: MERGE_SIZE }, (_, row) => board[(MERGE_SIZE - 1 - row) * MERGE_SIZE + index]);
}

function setLine(board, direction, index, line) {
  line.forEach((value, offset) => {
    if (direction === "left") board[index * MERGE_SIZE + offset] = value;
    else if (direction === "right") board[index * MERGE_SIZE + (MERGE_SIZE - 1 - offset)] = value;
    else if (direction === "up") board[offset * MERGE_SIZE + index] = value;
    else board[(MERGE_SIZE - 1 - offset) * MERGE_SIZE + index] = value;
  });
}

export function canMergeMove(board) {
  if (board.some((value) => value === 0)) return true;
  for (let row = 0; row < MERGE_SIZE; row += 1) {
    for (let column = 0; column < MERGE_SIZE; column += 1) {
      const value = board[row * MERGE_SIZE + column];
      if (column + 1 < MERGE_SIZE && value === board[row * MERGE_SIZE + column + 1]) {
        return true;
      }
      if (row + 1 < MERGE_SIZE && value === board[(row + 1) * MERGE_SIZE + column]) {
        return true;
      }
    }
  }
  return false;
}

export function moveMergeGame(game, direction, random = Math.random) {
  if (game.status !== "running" || !["down", "left", "right", "up"].includes(direction)) {
    return game;
  }

  const board = [...game.board];
  let gained = 0;
  for (let index = 0; index < MERGE_SIZE; index += 1) {
    const result = collapseLine(getLine(game.board, direction, index));
    setLine(board, direction, index, result.line);
    gained += result.score;
  }

  if (board.every((value, index) => value === game.board[index])) {
    return canMergeMove(game.board)
      ? game
      : {
          ...game,
          effectId: game.effectId + 1,
          lastEffect: "over",
          status: "over",
        };
  }

  const spawned = spawnMergeTile(board, game.difficulty, random);
  const maxTile = Math.max(...spawned);
  const won = maxTile >= 2048 && !game.wonAcknowledged;
  return {
    ...game,
    board: spawned,
    effectId: game.effectId + 1,
    lastEffect: gained > 0 ? "merge" : "move",
    lastGain: gained,
    maxTile,
    moves: game.moves + 1,
    score: game.score + gained,
    status: won ? "won" : canMergeMove(spawned) ? "running" : "over",
  };
}

export function continueMergeGame(game) {
  if (game.status !== "won") return game;
  return { ...game, status: "running", wonAcknowledged: true };
}

export function toggleMergePause(game) {
  if (game.status === "running") return { ...game, status: "paused" };
  if (game.status === "paused") return { ...game, status: "running" };
  return game;
}
