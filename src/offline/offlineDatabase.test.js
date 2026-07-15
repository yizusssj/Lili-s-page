import "fake-indexeddb/auto";
import { Blob as NativeBlob } from "node:buffer";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  countOfflineOperations,
  enqueueOfflineOperation,
  getOfflineImage,
  getOfflineSnapshot,
  hydrateOfflineMemories,
  listOfflineOperations,
  putOfflineImage,
  removeOfflineImage,
  removeOfflineOperation,
  saveOfflineSnapshot,
} from "./offlineDatabase.js";

describe("offline database", () => {
  beforeAll(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: indexedDB,
    });
    Object.defineProperty(window, "Blob", {
      configurable: true,
      value: NativeBlob,
    });
    URL.createObjectURL = vi.fn(() => "blob:lili-offline-test");
  });

  it("persiste el workspace, las operaciones ordenadas y las fotos", async () => {
    const userId = "offline-user";
    const workspace = { id: "offline-workspace", name: "Workspace local" };
    const data = {
      albums: [],
      memories: [{
        albumId: "album-1",
        id: "memory-1",
        imageUrl: "https://signed.example.test/photo.jpg",
        imageUrlExpiresAt: Date.now() + 1000,
        memoryDate: "2026-07-15",
        storagePath: "offline-workspace/memory-1.jpg",
      }],
      notes: [],
      priorities: [
        { done: false, id: "priority-1", position: 1, text: "Uno" },
        { done: false, id: "priority-2", position: 2, text: "Dos" },
        { done: false, id: "priority-3", position: 3, text: "Tres" },
      ],
      quickNote: "Disponible sin red",
      tasks: [],
    };

    expect(await saveOfflineSnapshot(userId, workspace, data)).toBe(true);
    const snapshot = await getOfflineSnapshot(userId);
    expect(snapshot.workspace).toEqual(workspace);
    expect(snapshot.data.quickNote).toBe("Disponible sin red");
    expect(snapshot.data.memories[0]).not.toHaveProperty("imageUrl");

    const first = await enqueueOfflineOperation({
      payload: { task: { id: "task-1", text: "Primera" } },
      type: "task.insert",
      userId,
      workspaceId: workspace.id,
    });
    const second = await enqueueOfflineOperation({
      payload: { taskId: "task-1" },
      type: "task.delete",
      userId,
      workspaceId: workspace.id,
    });

    expect(await countOfflineOperations(userId, workspace.id)).toBe(2);
    expect((await listOfflineOperations(userId, workspace.id)).map(({ id }) => id))
      .toEqual([first.id, second.id]);
    await removeOfflineOperation(first.id);
    expect(await countOfflineOperations(userId, workspace.id)).toBe(1);

    const blob = new NativeBlob(["foto-local"], { type: "image/jpeg" });
    await putOfflineImage({
      blob,
      memoryId: "memory-1",
      storagePath: "offline-workspace/memory-1.jpg",
      userId,
      workspaceId: workspace.id,
    });
    expect((await getOfflineImage("memory-1")).blob.size).toBe(blob.size);

    const hydrated = await hydrateOfflineMemories(snapshot.data.memories);
    expect(hydrated[0]).toMatchObject({
      imageUrl: "blob:lili-offline-test",
      offlineImageUrl: true,
    });

    await removeOfflineImage("memory-1");
    expect(await getOfflineImage("memory-1")).toBeUndefined();
    await removeOfflineOperation(second.id);
  });
});
