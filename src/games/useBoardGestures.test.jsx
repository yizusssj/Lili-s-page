import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useBoardGestures from "./useBoardGestures.js";

function GestureBoard({ actions }) {
  const handlers = useBoardGestures({
    enabled: true,
    onDrop: actions.drop,
    onMoveDown: actions.down,
    onMoveLeft: actions.left,
    onMoveRight: actions.right,
    onRotate: actions.rotate,
  });

  return <div data-testid="board" {...handlers} />;
}

function createActions() {
  return {
    down: vi.fn(),
    drop: vi.fn(),
    left: vi.fn(),
    right: vi.fn(),
    rotate: vi.fn(),
  };
}

describe("gestos del tablero", () => {
  it("mueve continuamente mientras el dedo sigue sobre el tablero", () => {
    const actions = createActions();
    render(<GestureBoard actions={actions} />);
    const board = screen.getByTestId("board");

    fireEvent.pointerDown(board, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 7,
      pointerType: "touch",
    });
    fireEvent.pointerMove(board, { clientX: 132, clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(board, { clientX: 164, clientY: 100, pointerId: 7 });

    expect(actions.right).toHaveBeenCalledTimes(2);
    expect(actions.rotate).not.toHaveBeenCalled();

    fireEvent.pointerMove(board, { clientX: 164, clientY: 132, pointerId: 7 });
    fireEvent.pointerMove(board, { clientX: 164, clientY: 164, pointerId: 7 });
    expect(actions.down).toHaveBeenCalledTimes(2);

    fireEvent.pointerUp(board, { clientX: 164, clientY: 164, pointerId: 7 });
    expect(actions.rotate).not.toHaveBeenCalled();
  });

  it("gira con un toque corto", () => {
    const actions = createActions();
    render(<GestureBoard actions={actions} />);
    const board = screen.getByTestId("board");

    fireEvent.pointerDown(board, {
      button: 0,
      clientX: 80,
      clientY: 120,
      pointerId: 3,
      pointerType: "touch",
    });
    fireEvent.pointerUp(board, {
      clientX: 82,
      clientY: 122,
      pointerId: 3,
    });

    expect(actions.rotate).toHaveBeenCalledOnce();
  });
});
