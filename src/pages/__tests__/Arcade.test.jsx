import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Arcade from "../Arcade.jsx";

describe("Arcade", () => {
  it("muestra los dos juegos disponibles y las dificultades", async () => {
    const user = userEvent.setup();
    render(<Arcade />);

    expect(screen.getByText(/2 disponibles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sandris/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Tetris/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Snake/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Tetris/ }));
    expect(screen.getByRole("group", { name: "Dificultad" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Relajada" }));
    expect(screen.getByRole("button", { name: "Relajada" })).toHaveAttribute("aria-pressed", "true");
  });

  it("abre Tetris, inicia la partida y regresa a la biblioteca", async () => {
    const user = userEvent.setup();
    render(<Arcade />);

    expect(screen.getByRole("heading", { name: "Elige un juego" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tetris/ }));

    expect(screen.getByRole("heading", { name: "Tetris" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Comenzar" }));
    expect(screen.getByRole("img", { name: /Tablero de Tetris/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar partida" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Todos los juegos" }));
    expect(screen.getByRole("heading", { name: "Elige un juego" })).toBeInTheDocument();
  });
});
