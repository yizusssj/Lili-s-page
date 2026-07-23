import { describe, expect, it, vi } from "vitest";
import { fetchClosetData, mapClothingItem, mapOutfit } from "./closetRepository.js";

function queryResult(data) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    then(resolve, reject) {
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

describe("closet repository", () => {
  it("mapea la base de datos al modelo de la interfaz", () => {
    expect(mapClothingItem({
      id: "item-1",
      name: null,
      category: "top",
      color: "Azul",
      brand: null,
      notes: "",
      status: "available",
      favorite: true,
      last_worn_on: "2026-07-22",
      wear_count: 3,
      storage_path: "workspace/item-1.jpg",
      mime_type: "image/jpeg",
      file_size: 200,
      created_at: "created",
      updated_at: "updated",
    })).toMatchObject({
      favorite: true,
      id: "item-1",
      lastWornOn: "2026-07-22",
      storagePath: "workspace/item-1.jpg",
      wearCount: 3,
    });
    expect(mapOutfit({ id: "outfit-1", notes: "" }, ["item-1"]).itemIds)
      .toEqual(["item-1"]);
  });

  it("reemplaza las URLs offline por una URL firmada vigente", async () => {
    const itemRow = {
      id: "item-1",
      name: "Top",
      category: "top",
      color: null,
      brand: null,
      notes: "",
      status: "available",
      favorite: false,
      last_worn_on: null,
      wear_count: 0,
      storage_path: "workspace/item-1.jpg",
      mime_type: "image/jpeg",
      file_size: 200,
      created_at: "created",
      updated_at: "updated",
    };
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [{
        path: itemRow.storage_path,
        signedUrl: "https://signed.example.test/item-1",
      }],
      error: null,
    });
    const tables = {
      clothing_items: queryResult([itemRow]),
      outfit_items: queryResult([]),
      outfits: queryResult([]),
    };
    const client = {
      from: vi.fn((table) => tables[table]),
      storage: {
        from: vi.fn(() => ({ createSignedUrls })),
      },
    };

    const data = await fetchClosetData(client, "workspace", [{
      id: "item-1",
      imageUrl: "blob:offline-item",
      imageUrlExpiresAt: Number.POSITIVE_INFINITY,
      offlineImageUrl: true,
      storagePath: itemRow.storage_path,
    }]);

    expect(createSignedUrls).toHaveBeenCalledWith([itemRow.storage_path], 3600);
    expect(data.items[0].imageUrl).toBe("https://signed.example.test/item-1");
  });
});
