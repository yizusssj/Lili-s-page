import { getLocalDateKey } from "../utils/date.js";

const DATABASE_NAME = "lili-offline-v1";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const OPERATION_STORE = "operations";
const IMAGE_STORE = "images";

let databasePromise;
let lastOperationOrder = 0;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: "userId" });
      }

      if (!database.objectStoreNames.contains(OPERATION_STORE)) {
        const operations = database.createObjectStore(OPERATION_STORE, { keyPath: "id" });
        operations.createIndex("by_user", "userId", { unique: false });
      }

      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        const images = database.createObjectStore(IMAGE_STORE, { keyPath: "memoryId" });
        images.createIndex("by_workspace", "workspaceId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB quedó bloqueada por otra ventana."));
  }).catch(() => null);

  return databasePromise;
}

async function executeStore(storeName, mode, action) {
  const database = await openDatabase();
  if (!database) return null;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;

    try {
      result = action(store);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }

    if (typeof IDBRequest !== "undefined" && result instanceof IDBRequest) {
      result.onsuccess = () => {
        result = result.result;
      };
      result.onerror = () => reject(result.error);
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function stripTransientMemoryFields(memory) {
  const persisted = { ...memory };
  delete persisted.imageUrl;
  delete persisted.imageUrlExpiresAt;
  delete persisted.offlineImageUrl;
  return persisted;
}

function stripTransientTrashFields(item) {
  if (item.type === "album") {
    return {
      ...item,
      memories: (item.memories ?? []).map(stripTransientMemoryFields),
    };
  }
  if (item.type === "memory" && item.data) {
    return { ...item, data: stripTransientMemoryFields(item.data) };
  }
  return item;
}

export async function saveOfflineSnapshot(userId, workspace, data) {
  if (!userId || !workspace) return false;

  const snapshot = {
    userId,
    workspace,
    data: {
      ...data,
      memories: data.memories.map(stripTransientMemoryFields),
      trash: (data.trash ?? []).map(stripTransientTrashFields),
    },
    localDate: getLocalDateKey(),
    savedAt: new Date().toISOString(),
  };

  try {
    await executeStore(SNAPSHOT_STORE, "readwrite", (store) => store.put(snapshot));
    return true;
  } catch {
    return false;
  }
}

export async function getOfflineSnapshot(userId) {
  if (!userId) return null;
  try {
    return await executeStore(SNAPSHOT_STORE, "readonly", (store) => store.get(userId));
  } catch {
    return null;
  }
}

export async function enqueueOfflineOperation({ payload, type, userId, workspaceId }) {
  lastOperationOrder = Math.max(Date.now() * 1000, lastOperationOrder + 1);
  const operation = {
    id: crypto.randomUUID(),
    userId,
    workspaceId,
    type,
    payload,
    createdAt: new Date().toISOString(),
    order: lastOperationOrder,
  };

  const stored = await executeStore(
    OPERATION_STORE,
    "readwrite",
    (store) => store.put(operation),
  );

  if (stored === null) throw new Error("El almacenamiento offline no está disponible.");
  return operation;
}

export async function listOfflineOperations(userId, workspaceId) {
  try {
    const database = await openDatabase();
    if (!database) return [];
    const transaction = database.transaction(OPERATION_STORE, "readonly");
    const index = transaction.objectStore(OPERATION_STORE).index("by_user");
    const operations = await requestResult(index.getAll(userId));
    return operations
      .filter((operation) => !workspaceId || operation.workspaceId === workspaceId)
      .sort((first, second) => {
        if (first.order !== undefined && second.order !== undefined) {
          return first.order - second.order;
        }
        return first.createdAt.localeCompare(second.createdAt);
      });
  } catch {
    return [];
  }
}

export async function removeOfflineOperation(operationId) {
  try {
    await executeStore(OPERATION_STORE, "readwrite", (store) => store.delete(operationId));
    return true;
  } catch {
    return false;
  }
}

export async function countOfflineOperations(userId, workspaceId) {
  return (await listOfflineOperations(userId, workspaceId)).length;
}

export async function putOfflineImage({ blob, memoryId, storagePath, userId, workspaceId }) {
  if (!(blob instanceof Blob)) throw new Error("La fotografía local no es válida.");

  const image = {
    memoryId,
    workspaceId,
    userId,
    storagePath,
    blob,
    savedAt: new Date().toISOString(),
  };

  const stored = await executeStore(IMAGE_STORE, "readwrite", (store) => store.put(image));
  if (stored === null) throw new Error("No hay almacenamiento local para la fotografía.");
  return image;
}

export async function getOfflineImage(memoryId) {
  try {
    return await executeStore(IMAGE_STORE, "readonly", (store) => store.get(memoryId));
  } catch {
    return null;
  }
}

export async function removeOfflineImage(memoryId) {
  try {
    await executeStore(IMAGE_STORE, "readwrite", (store) => store.delete(memoryId));
    return true;
  } catch {
    return false;
  }
}

export async function removeOfflineImages(memoryIds) {
  await Promise.all(memoryIds.map((memoryId) => removeOfflineImage(memoryId)));
}

export async function hydrateOfflineMemories(memories) {
  return Promise.all(memories.map(async (memory) => {
    const storedImage = await getOfflineImage(memory.id);
    if (!storedImage?.blob || typeof URL.createObjectURL !== "function") return memory;

    return {
      ...memory,
      imageUrl: URL.createObjectURL(storedImage.blob),
      imageUrlExpiresAt: Number.POSITIVE_INFINITY,
      offlineImageUrl: true,
    };
  }));
}

export async function hydrateOfflineTrash(items = []) {
  return Promise.all(items.map(async (item) => {
    if (item.type === "album") {
      return {
        ...item,
        memories: await hydrateOfflineMemories(item.memories ?? []),
      };
    }
    if (item.type === "memory" && item.data) {
      const [memory] = await hydrateOfflineMemories([item.data]);
      return { ...item, data: memory };
    }
    return item;
  }));
}

export async function cacheRemoteMemoryImages(memories, userId, workspaceId) {
  for (const memory of memories) {
    if (!memory.imageUrl || await getOfflineImage(memory.id)) continue;

    try {
      const response = await fetch(memory.imageUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      await putOfflineImage({
        blob,
        memoryId: memory.id,
        storagePath: memory.storagePath,
        userId,
        workspaceId,
      });
    } catch {
      // La metadata sigue disponible aunque el dispositivo no tenga espacio para la foto.
    }
  }
}

export function revokeOfflineMemoryUrls(memories) {
  memories.forEach((memory) => {
    if (memory.offlineImageUrl && memory.imageUrl) URL.revokeObjectURL(memory.imageUrl);
  });
}

export async function requestPersistentStorage() {
  try {
    return await navigator.storage?.persist?.() ?? false;
  } catch {
    return false;
  }
}
