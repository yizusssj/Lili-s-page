import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoryCollage from "./MemoryCollage.jsx";

const MEMORIES = [
  { id: "portrait", imageUrl: "https://example.test/portrait.jpg" },
  { id: "landscape", imageUrl: "https://example.test/landscape.jpg" },
];

describe("MemoryCollage", () => {
  it("conserva el orden y adapta cada espacio a la orientación de la foto", async () => {
    const onSelect = vi.fn();
    render(
      <MemoryCollage
        memories={MEMORIES}
        onSelect={onSelect}
        getLabel={(memory) => `Abrir ${memory.id}`}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Abrir portrait",
      "Abrir landscape",
    ]);

    const images = screen.getAllByRole("presentation");
    Object.defineProperties(images[0], {
      naturalHeight: { configurable: true, value: 1200 },
      naturalWidth: { configurable: true, value: 600 },
    });
    Object.defineProperties(images[1], {
      naturalHeight: { configurable: true, value: 800 },
      naturalWidth: { configurable: true, value: 1600 },
    });
    fireEvent.load(images[0]);
    fireEvent.load(images[1]);

    await waitFor(() => {
      expect(Number.parseFloat(buttons[0].style.width))
        .toBeLessThan(Number.parseFloat(buttons[1].style.width));
    });

    fireEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith("landscape");
  });
});
