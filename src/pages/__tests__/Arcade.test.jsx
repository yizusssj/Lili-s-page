import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Arcade from "../Arcade.jsx";

describe("Arcade", () => {
  it("muestra los cuatro juegos disponibles y las dificultades", async () => {
    const user = userEvent.setup();
    render(<Arcade />);

    expect(screen.getByText("4 disponibles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sandris/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Tetris/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Snake/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /2048/ })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Tetris/ }));
    expect(screen.getByRole("group", { name: "Dificultad" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Relajada" }));
    expect(screen.getByRole("button", { name: "Relajada" })).toHaveAttribute("aria-pressed", "true");
  });

  it("abre Snake y 2048 como juegos completos", async () => {
    const user = userEvent.setup();
    render(<Arcade />);

    await user.click(screen.getByRole("button", { name: /Snake/ }));
    expect(screen.getByRole("heading", { name: "Snake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Todos los juegos" }));

    await user.click(screen.getByRole("button", { name: /2048/ }));
    expect(screen.getByRole("heading", { name: "2048" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeEnabled();
  });

  it("abre Tetris, inicia la partida y regresa a la biblioteca", async () => {
    const user = userEvent.setup();
    render(<Arcade />);

    expect(screen.getByRole("heading", { name: "Elige un juego" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tetris/ }));

    expect(document.documentElement).toHaveClass("arcadeGameActive");
    expect(document.querySelector(".arcadeGameScreen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tetris" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Comenzar" }));
    expect(screen.getByRole("img", { name: /Tablero de Tetris/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar partida" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Todos los juegos" }));
    expect(screen.getByRole("heading", { name: "Elige un juego" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("arcadeGameActive");
  });
});
