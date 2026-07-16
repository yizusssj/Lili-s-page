import {
  getOfflineImage,
  listOfflineOperations,
  removeOfflineImage,
  removeOfflineImages,
  removeOfflineOperation,
} from "./offlineDatabase.js";
import {
  deleteAlbum,
  deleteCompletedTasks,
  deleteMemory,
  deleteNote,
  deleteTask,
  insertAlbum,
  insertMemory,
  insertNote,
  insertTask,
  restoreAlbum,
  restoreMemory,
  restoreNote,
  restoreTask,
  savePriorities,
  trashAlbum,
  trashCompletedTasks,
  trashMemory,
  trashNote,
  trashTask,
  updateAlbum,
  updateAlbumCover,
  updateNote,
  updateQuickNote,
  updateMemory,
  updateTask,
} from "../workspace/workspaceRepository.js";

export function isNetworkError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;

  const message = String(error?.message ?? "").toLowerCase();
  return [
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "network request failed",
    "load failed",
  ].some((fragment) => message.includes(fragment));
}

async function executeOperation(client, operation) {
  const { payload, type, userId, workspaceId } = operation;

  switch (type) {
    case "task.insert":
      return insertTask(client, workspaceId, userId, payload.task);
    case "task.update":
      return updateTask(client, workspaceId, payload.taskId, payload.fields);
    case "task.delete":
      return deleteTask(client, workspaceId, payload.taskId);
    case "task.trash":
      return trashTask(client, workspaceId, payload.taskId);
    case "task.restore":
      return restoreTask(client, workspaceId, payload.taskId);
    case "task.trashCompleted":
      return trashCompletedTasks(client, workspaceId, payload.taskIds);
    case "task.clearCompleted":
      return deleteCompletedTasks(client, workspaceId);
    case "note.insert":
      return insertNote(client, workspaceId, userId, payload.note);
    case "note.update":
      return updateNote(client, workspaceId, payload.noteId, payload.fields);
    case "note.delete":
      return deleteNote(client, workspaceId, payload.noteId);
    case "note.trash":
      return trashNote(client, workspaceId, payload.noteId, payload.fields);
    case "note.restore":
      return restoreNote(client, workspaceId, payload.noteId);
    case "album.insert":
      return insertAlbum(client, workspaceId, userId, payload.album);
    case "album.update":
      return updateAlbum(client, workspaceId, payload.albumId, payload.fields);
    case "album.cover":
      return updateAlbumCover(client, workspaceId, payload.albumId, payload.memoryId);
    case "album.delete":
      await deleteAlbum(client, workspaceId, payload.albumId, payload.storagePaths);
      await removeOfflineImages(payload.memoryIds);
      return null;
    case "album.trash":
      return trashAlbum(client, workspaceId, payload.albumId);
    case "album.restore":
      return restoreAlbum(client, workspaceId, payload.albumId);
    case "memory.insert": {
      const storedImage = await getOfflineImage(payload.memory.id);
      if (!storedImage?.blob) throw new Error("Falta la fotografía guardada en el dispositivo.");
      return insertMemory(client, workspaceId, userId, payload.memory, {
        blob: storedImage.blob,
        mimeType: storedImage.blob.type || "image/jpeg",
      });
    }
    case "memory.delete":
      await deleteMemory(
        client,
        workspaceId,
        payload.memoryId,
        payload.storagePath,
      );
      await removeOfflineImage(payload.memoryId);
      return null;
    case "memory.trash":
      return trashMemory(client, workspaceId, payload.memoryId);
    case "memory.restore":
      return restoreMemory(client, workspaceId, payload.memoryId);
    case "memory.update":
      return updateMemory(client, workspaceId, payload.memoryId, payload.fields);
    case "priorities.save":
      return savePriorities(client, workspaceId, payload.priorities, payload.localDate);
    case "quickNote.update":
      return updateQuickNote(client, workspaceId, payload.content);
    default:
      throw new Error(`Operación offline desconocida: ${type}`);
  }
}

export async function flushOfflineOperations(client, userId, workspaceId, onProgress) {
  const operations = await listOfflineOperations(userId, workspaceId);
  let completed = 0;

  for (const operation of operations) {
    await executeOperation(client, operation);
    await removeOfflineOperation(operation.id);
    completed += 1;
    onProgress?.(operations.length - completed);
  }

  return completed;
}
