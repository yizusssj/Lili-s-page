export const GAME_DIFFICULTIES = [
  {
    description: "Más tiempo para pensar",
    id: "relaxed",
    label: "Relajada",
  },
  {
    description: "Ritmo equilibrado",
    id: "normal",
    label: "Normal",
  },
  {
    description: "Rápida y exigente",
    id: "intense",
    label: "Intensa",
  },
];

export function getGameDifficulty(id) {
  return GAME_DIFFICULTIES.find((difficulty) => difficulty.id === id)
    ?? GAME_DIFFICULTIES[1];
}
