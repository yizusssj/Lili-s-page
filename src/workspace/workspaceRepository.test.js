import { describe, expect, it, vi } from "vitest";
import { insertMemory } from "./workspaceRepository.js";

const memory = {
  albumId: "album-1",
  description: "",
  id: "memory-1",
  memoryDate: "2026-07-15",
  sortOrder: 1,
  storagePath: "workspace-1/memory-1.jpg",
  title: null,
};
const image = {
  blob: new Blob(["foto"], { type: "image/jpeg" }),
  mimeType: "image/jpeg",
};

function createClient({ storageError = null } = {}) {
  const upload = vi.fn().mockResolvedValue({ data: null, error: storageError });
  const remove = vi.fn().mockResolvedValue({ data: null, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.test/photo.jpg" },
    error: null,
  });
  const single = vi.fn().mockResolvedValue({
    data: {
      album_id: memory.albumId,
      created_at: "2026-07-15T12:00:00.000Z",
      description: "",
      file_size: image.blob.size,
      id: memory.id,
      memory_date: memory.memoryDate,
      mime_type: image.mimeType,
      sort_order: memory.sortOrder,
      storage_path: memory.storagePath,
      title: null,
      updated_at: "2026-07-15T12:00:00.000Z",
    },
    error: null,
  });
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const bucket = { createSignedUrl, remove, upload };

  return {
    bucket,
    client: {
      from: vi.fn(() => ({ upsert })),
      storage: { from: vi.fn(() => bucket) },
    },
    upsert,
  };
}

describe("insertMemory", () => {
  it("crea un archivo nuevo sin pedir permiso de sobrescritura", async () => {
    const { bucket, client } = createClient();

    const result = await insertMemory(
      client,
      "workspace-1",
      "user-1",
      memory,
      image,
    );

    expect(bucket.upload).toHaveBeenCalledWith(
      memory.storagePath,
      image.blob,
      expect.objectContaining({ contentType: "image/jpeg", upsert: false }),
    );
    expect(result).toMatchObject({ id: memory.id, sortOrder: 1 });
  });

  it("identifica los errores propios de Supabase Storage", async () => {
    const { client, upsert } = createClient({
      storageError: { message: "Unauthorized", status: 403, statusCode: "403" },
    });

    await expect(insertMemory(
      client,
      "workspace-1",
      "user-1",
      memory,
      image,
    )).rejects.toMatchObject({
      memoryStage: "storage",
      message: "Unauthorized",
      status: 403,
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
