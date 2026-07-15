import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useDirectionalGesture from "./useDirectionalGesture.js";

function Harness({ continuous = false, onDirection }) {
  const handlers = useDirectionalGesture({ continuous, enabled: true, onDirection });
  return <div data-testid="surface" {...handlers} />;
}

describe("useDirectionalGesture", () => {
  it("convierte un deslizamiento en una dirección", () => {
    const onDirection = vi.fn();
    const { getByTestId } = render(<Harness onDirection={onDirection} />);
    const surface = getByTestId("surface");

    fireEvent.pointerDown(surface, { clientX: 80, clientY: 80, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 25, clientY: 84, pointerId: 1 });

    expect(onDirection).toHaveBeenCalledWith("left");
  });

  it("permite varios giros sin despegar el dedo cuando es continuo", () => {
    const onDirection = vi.fn();
    const { getByTestId } = render(
      <Harness continuous onDirection={onDirection} />,
    );
    const surface = getByTestId("surface");

    fireEvent.pointerDown(surface, { clientX: 40, clientY: 40, pointerId: 2 });
    fireEvent.pointerMove(surface, { clientX: 78, clientY: 40, pointerId: 2 });
    fireEvent.pointerMove(surface, { clientX: 78, clientY: 78, pointerId: 2 });

    expect(onDirection).toHaveBeenNthCalledWith(1, "right");
    expect(onDirection).toHaveBeenNthCalledWith(2, "down");
  });
});
