import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  deleteAlbum: vi.fn(),
  deleteCompletedTasks: vi.fn(),
  deleteMemory: vi.fn(),
  deleteNote: vi.fn(),
  deleteTask: vi.fn(),
  insertAlbum: vi.fn(),
  insertMemory: vi.fn(),
  insertNote: vi.fn(),
  insertTask: vi.fn(async (_client, _workspaceId, _userId, task) => task),
  restoreAlbum: vi.fn(),
  restoreMemory: vi.fn(),
  restoreNote: vi.fn(),
  restoreTask: vi.fn(),
  savePriorities: vi.fn(),
  trashAlbum: vi.fn(),
  trashCompletedTasks: vi.fn(),
  trashMemory: vi.fn(),
  trashNote: vi.fn(),
  trashTask: vi.fn(),
  updateAlbum: vi.fn(),
  updateAlbumCover: vi.fn(),
  updateMemory: vi.fn(),
  updateNote: vi.fn(),
  updateQuickNote: vi.fn(),
  updateTask: vi.fn(async (_client, _workspaceId, taskId, fields) => ({
    ...fields,
    id: taskId,
  })),
}));

vi.mock("../workspace/workspaceRepository.js", () => repository);

import {
  countOfflineOperations,
  enqueueOfflineOperation,
} from "./offlineDatabase.js";
import { flushOfflineOperations } from "./offlineSync.js";

describe("offline synchronization", () => {
  beforeAll(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: indexedDB,
    });
  });

  it("reproduce la cola en orden y solo elimina cambios confirmados", async () => {
    const userId = "sync-user";
    const workspaceId = "sync-workspace";
    const task = { done: false, id: "sync-task", text: "Offline" };
    const progress = [];

    await enqueueOfflineOperation({
      payload: { task },
      type: "task.insert",
      userId,
      workspaceId,
    });
    await enqueueOfflineOperation({
      payload: { fields: { done: true }, taskId: task.id },
      type: "task.update",
      userId,
      workspaceId,
    });

    expect(await flushOfflineOperations(
      { name: "supabase-client" },
      userId,
      workspaceId,
      (remaining) => progress.push(remaining),
    )).toBe(2);

    expect(repository.insertTask).toHaveBeenCalledWith(
      expect.anything(),
      workspaceId,
      userId,
      task,
    );
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.anything(),
      workspaceId,
      task.id,
      { done: true },
    );
    expect(repository.insertTask.mock.invocationCallOrder[0])
      .toBeLessThan(repository.updateTask.mock.invocationCallOrder[0]);
    expect(progress).toEqual([1, 0]);
    expect(await countOfflineOperations(userId, workspaceId)).toBe(0);
  });

  it("sincroniza los detalles editados de una fotografía", async () => {
    const userId = "memory-sync-user";
    const workspaceId = "memory-sync-workspace";
    await enqueueOfflineOperation({
      payload: {
        fields: { description: "Un día bonito", title: "Paseo" },
        memoryId: "memory-1",
      },
      type: "memory.update",
      userId,
      workspaceId,
    });

    await flushOfflineOperations({ name: "supabase-client" }, userId, workspaceId);

    expect(repository.updateMemory).toHaveBeenCalledWith(
      expect.anything(),
      workspaceId,
      "memory-1",
      { description: "Un día bonito", title: "Paseo" },
    );
    expect(await countOfflineOperations(userId, workspaceId)).toBe(0);
  });

  it("sincroniza papelera y restauracion en el mismo orden", async () => {
    const userId = "trash-sync-user";
    const workspaceId = "trash-sync-workspace";
    await enqueueOfflineOperation({
      payload: { taskId: "task-trash" },
      type: "task.trash",
      userId,
      workspaceId,
    });
    await enqueueOfflineOperation({
      payload: { taskId: "task-trash" },
      type: "task.restore",
      userId,
      workspaceId,
    });

    await flushOfflineOperations({ name: "supabase-client" }, userId, workspaceId);

    expect(repository.trashTask).toHaveBeenCalledWith(
      expect.anything(),
      workspaceId,
      "task-trash",
    );
    expect(repository.restoreTask).toHaveBeenCalledWith(
      expect.anything(),
      workspaceId,
      "task-trash",
    );
    expect(repository.trashTask.mock.invocationCallOrder[0])
      .toBeLessThan(repository.restoreTask.mock.invocationCallOrder[0]);
    expect(await countOfflineOperations(userId, workspaceId)).toBe(0);
  });
});
