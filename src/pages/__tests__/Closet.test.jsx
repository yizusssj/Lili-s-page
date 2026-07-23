import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const closet = vi.hoisted(() => ({
  addClothingItems: vi.fn(),
  clearError: vi.fn(),
  clearNotice: vi.fn(),
  error: null,
  items: [],
  loading: false,
  markAllClean: vi.fn(),
  markOutfitWorn: vi.fn(),
  notice: "",
  outfits: [],
  refresh: vi.fn(),
  removeClothingItem: vi.fn(),
  removeOutfit: vi.fn(),
  saveOutfit: vi.fn(),
  saving: false,
  updateClothingItem: vi.fn(),
}));

vi.mock("../../closet/useCloset.js", () => ({
  default: () => closet,
}));

import Closet from "../Closet.jsx";

const CLOTHES = [
  {
    id: "top-1",
    name: "Top azul",
    category: "top",
    color: "Azul",
    brand: null,
    notes: "",
    status: "available",
    favorite: true,
    lastWornOn: null,
    wearCount: 0,
    imageUrl: "https://example.test/top.jpg",
  },
  {
    id: "bottom-1",
    name: "Falda negra",
    category: "bottom",
    color: "Negro",
    brand: null,
    notes: "",
    status: "laundry",
    favorite: false,
    lastWornOn: "2026-07-21",
    wearCount: 2,
    imageUrl: "https://example.test/falda.jpg",
  },
];

describe("Clóset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(closet, {
      error: null,
      items: [...CLOTHES],
      loading: false,
      notice: "",
      outfits: [],
      saving: false,
    });
  });

  it("crea un outfit eligiendo prendas limpias", async () => {
    const user = userEvent.setup();
    closet.saveOutfit.mockImplementation(async (input) => ({
      ...input,
      id: "outfit-1",
    }));
    render(<Closet />);

    await user.click(screen.getByRole("button", { name: "Crear outfit" }));
    await user.click(screen.getByRole("button", { name: "Elegir Top azul" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Salida bonita");
    await user.click(screen.getByRole("button", { name: "Guardar outfit" }));

    expect(closet.saveOutfit).toHaveBeenCalledWith(expect.objectContaining({
      itemIds: ["top-1"],
      name: "Salida bonita",
    }));
  });

  it("resuelve la ropa por lavar con una sola acción", async () => {
    const user = userEvent.setup();
    closet.updateClothingItem.mockResolvedValue(true);
    render(<Closet />);

    await user.click(screen.getByRole("tab", { name: /Por lavar/ }));
    expect(screen.getByText("Falda negra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ya está limpia" }));

    expect(closet.updateClothingItem).toHaveBeenCalledWith(
      "bottom-1",
      { status: "available" },
    );
  });

  it("explica cómo activar Supabase si falta la migración", () => {
    closet.items = [];
    closet.error = {
      code: "42P01",
      message: "relation public.clothing_items does not exist",
    };
    render(<Closet />);

    expect(screen.getByRole("heading", { name: "El clóset está listo para activarse" }))
      .toBeInTheDocument();
    expect(screen.getByText(/20260723010000_digital_closet\.sql/))
      .toBeInTheDocument();
  });
});
