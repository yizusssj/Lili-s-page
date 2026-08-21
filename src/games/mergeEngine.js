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
  return spawnMergeTileWithIndex(board, difficulty, random).board;
}

function spawnMergeTileWithIndex(board, difficulty = "normal", random = Math.random) {
  const empty = board
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);
  if (empty.length === 0) return { board, index: null };

  const next = [...board];
  const index = empty[randomIndex(empty.length, random)];
  const config = MERGE_DIFFICULTY[difficulty] ?? MERGE_DIFFICULTY.normal;
  next[index] = random() < config.fourChance ? 4 : 2;
  return { board: next, index };
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
    lastDirection: null,
    lastGain: 0,
    lastMergedIndexes: [],
    lastMotionTiles: [],
    lastMovedIndexes: [],
    lastSpawnedIndex: null,
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

function getBoardIndex(direction, index, offset) {
  if (direction === "left") return index * MERGE_SIZE + offset;
  if (direction === "right") return index * MERGE_SIZE + (MERGE_SIZE - 1 - offset);
  if (direction === "up") return offset * MERGE_SIZE + index;
  return (MERGE_SIZE - 1 - offset) * MERGE_SIZE + index;
}

function getLineEntries(board, direction, index) {
  return Array.from({ length: MERGE_SIZE }, (_, offset) => {
    const boardIndex = getBoardIndex(direction, index, offset);
    return { index: boardIndex, value: board[boardIndex] };
  });
}

function setLine(board, direction, index, line) {
  line.forEach((value, offset) => {
    board[getBoardIndex(direction, index, offset)] = value;
  });
}

function collapseLineWithMotion(entries) {
  const values = entries.filter(({ value }) => value > 0);
  const collapsed = [];
  let score = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index].value === values[index + 1]?.value) {
      const value = values[index].value * 2;
      collapsed.push({
        from: [values[index].index, values[index + 1].index],
        merged: true,
        value,
      });
      score += value;
      index += 1;
    } else {
      collapsed.push({
        from: [values[index].index],
        merged: false,
        value: values[index].value,
      });
    }
  }

  const line = Array(MERGE_SIZE).fill(0);
  const motion = [];
  collapsed.forEach((tile, offset) => {
    line[offset] = tile.value;
    motion.push({ ...tile, offset });
  });

  return { line, motion, score };
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
  const movedIndexes = new Set();
  const mergedIndexes = new Set();
  const motionTiles = [];

  for (let index = 0; index < MERGE_SIZE; index += 1) {
    const result = collapseLineWithMotion(getLineEntries(game.board, direction, index));
    setLine(board, direction, index, result.line);
    gained += result.score;

    result.motion.forEach(({ from, merged, offset, value }) => {
      const finalIndex = getBoardIndex(direction, index, offset);
      const moved = merged || from.some((originIndex) => originIndex !== finalIndex);
      if (moved) movedIndexes.add(finalIndex);
      if (merged) mergedIndexes.add(finalIndex);
      from.forEach((originIndex) => {
        if (originIndex === finalIndex) return;
        motionTiles.push({
          fromIndex: originIndex,
          merged,
          toIndex: finalIndex,
          value: merged ? value / 2 : value,
        });
      });
    });
  }

  if (board.every((value, index) => value === game.board[index])) {
    return canMergeMove(game.board)
      ? game
      : {
          ...game,
          effectId: game.effectId + 1,
          lastEffect: "over",
          lastDirection: null,
          lastMergedIndexes: [],
          lastMotionTiles: [],
          lastMovedIndexes: [],
          lastSpawnedIndex: null,
          status: "over",
        };
  }

  const { board: spawned, index: spawnedIndex } = spawnMergeTileWithIndex(board, game.difficulty, random);
  const maxTile = Math.max(...spawned);
  const won = maxTile >= 2048 && !game.wonAcknowledged;
  return {
    ...game,
    board: spawned,
    effectId: game.effectId + 1,
    lastDirection: direction,
    lastEffect: gained > 0 ? "merge" : "move",
    lastGain: gained,
    lastMergedIndexes: [...mergedIndexes],
    lastMotionTiles: motionTiles,
    lastMovedIndexes: [...movedIndexes],
    lastSpawnedIndex: spawnedIndex,
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
