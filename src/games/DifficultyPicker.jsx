import { Gauge } from "lucide-react";
import { GAME_DIFFICULTIES } from "./difficulties.js";

export default function DifficultyPicker({ disabled = false, onChange, value }) {
  return (
    <div className="gameDifficultyPicker" role="group" aria-label="Dificultad">
      <span className="gameDifficultyLabel">
        <Gauge aria-hidden="true" size={14} strokeWidth={1.8} />
        Dificultad
      </span>
      <div className="gameDifficultyOptions">
        {GAME_DIFFICULTIES.map((difficulty) => (
          <button
            type="button"
            key={difficulty.id}
            className={value === difficulty.id ? "gameDifficultyActive" : ""}
            aria-pressed={value === difficulty.id}
            disabled={disabled}
            onClick={() => onChange(difficulty.id)}
            title={difficulty.description}
          >
            {difficulty.label}
          </button>
        ))}
      </div>
    </div>
  );
}
