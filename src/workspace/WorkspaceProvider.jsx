import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../app/config.js";
import { useAuth } from "../auth/authContext.js";
import { supabase } from "../lib/supabase.js";
import {
  cacheRemoteMemoryImages,
  countOfflineOperations,
  enqueueOfflineOperation,
  getOfflineSnapshot,
  hydrateOfflineMemories,
  putOfflineImage,
  removeOfflineImage,
  removeOfflineImages,
  requestPersistentStorage,
  revokeOfflineMemoryUrls,
  saveOfflineSnapshot,
} from "../offline/offlineDatabase.js";
import {
  flushOfflineOperations,
  isNetworkError,
} from "../offline/offlineSync.js";
import { getLocalDateKey } from "../utils/date.js";
import { prepareMemoryImage } from "../utils/images.js";
import { normalizeReminderMinutes } from "../utils/reminders.js";
import { writeJSON, writeText } from "../utils/storage.js";
import { WorkspaceContext } from "./workspaceContext.js";
import {
  deleteAlbum as deleteAlbumRemote,
  deleteCompletedTasks as deleteCompletedTasksRemote,
  deleteMemory as deleteMemoryRemote,
  deleteNote as deleteNoteRemote,
  deleteTask as deleteTaskRemote,
  fetchWorkspaceData,
  findUserWorkspace,
  initializeWorkspace,
  insertAlbum,
  insertMemory,
  insertNote,
  insertTask,
  savePriorities as savePrioritiesRemote,
  updateAlbumCover as updateAlbumCoverRemote,
  updateAlbum as updateAlbumRemote,
  updateNote as updateNoteRemote,
  updateQuickNote,
  updateTask as updateTaskRemote,
} from "./workspaceRepository.js";
import { readLocalWorkspaceSeed } from "./workspaceSeed.js";

function normalizeError(error, fallback) {
  if (error instanceof Error) return error;

  const normalized = new Error(
    typeof error?.message === "string" ? error.message : fallback,
  );

  if (error && typeof error === "object") {
    normalized.code = error.code;
    normalized.details = error.details;
    normalized.hint = error.hint;
  }

  return normalized;
}

function applyPendingNoteFields(note, fields) {
  return {
    ...note,
    ...(Object.hasOwn(fields, "title") ? { title: fields.title } : {}),
    ...(Object.hasOwn(fields, "content") ? { content: fields.content } : {}),
    ...(Object.hasOwn(fields, "pinned") ? { pinned: fields.pinned } : {}),
  };
}

const TASK_PRIORITIES = new Set(["low", "medium", "high"]);

function normalizeTaskInput(value) {
  const input = typeof value === "string" ? { text: value } : value ?? {};
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 500) : "";
  const dueDate = typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
    ? input.dueDate
    : null;
  const dueTime = dueDate
    && typeof input.dueTime === "string"
    && /^\d{2}:\d{2}$/.test(input.dueTime)
    ? input.dueTime
    : null;
  const priority = TASK_PRIORITIES.has(input.priority) ? input.priority : "medium";
  const reminderMinutesBefore = dueTime
    ? normalizeReminderMinutes(input.reminderMinutesBefore)
    : null;

  return { dueDate, dueTime, priority, reminderMinutesBefore, text };
}

export default function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [workspace, setWorkspace] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [memories, setMemories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [quickNote, setQuickNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [bufferedWrites, setBufferedWrites] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const workspaceRef = useRef(null);
  const albumsRef = useRef([]);
  const tasksRef = useRef([]);
  const notesRef = useRef([]);
  const memoriesRef = useRef([]);
  const prioritiesRef = useRef([]);
  const pendingWritesRef = useRef(0);
  const noteBuffersRef = useRef(new Map());
  const noteTimersRef = useRef(new Map());
  const priorityTimerRef = useRef(null);
  const priorityNeedsRetryRef = useRef(false);
  const syncingOfflineRef = useRef(false);

  const updateBufferedWriteCount = useCallback(() => {
    setBufferedWrites(
      noteTimersRef.current.size + (priorityTimerRef.current ? 1 : 0),
    );
  }, []);

  const commitTasks = useCallback((nextTasks) => {
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    writeJSON(STORAGE_KEYS.tasks, nextTasks);
  }, []);

  const commitAlbums = useCallback((nextAlbums) => {
    albumsRef.current = nextAlbums;
    setAlbums(nextAlbums);
  }, []);

  const commitNotes = useCallback((nextNotes) => {
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    writeJSON(STORAGE_KEYS.notes, nextNotes);
  }, []);

  const commitMemories = useCallback((nextMemories) => {
    memoriesRef.current = nextMemories;
    setMemories(nextMemories);
  }, []);

  const commitPriorities = useCallback((nextPriorities) => {
    prioritiesRef.current = nextPriorities;
    setPriorities(nextPriorities);
    writeJSON(STORAGE_KEYS.todayPriorities, nextPriorities);
    writeText(STORAGE_KEYS.todayDate, getLocalDateKey());
  }, []);

  const commitQuickNote = useCallback((content) => {
    setQuickNote(content);
    writeText(STORAGE_KEYS.quickNote, content);
  }, []);

  const commitWorkspaceData = useCallback(
    (data) => {
      commitAlbums(data.albums);
      commitTasks(data.tasks);
      commitNotes(data.notes);
      commitMemories(data.memories);
      commitPriorities(data.priorities);
      commitQuickNote(data.quickNote);
    },
    [
      commitAlbums,
      commitMemories,
      commitNotes,
      commitPriorities,
      commitQuickNote,
      commitTasks,
    ],
  );

  const queueOperation = useCallback(async (offlineOperation, fallbackData) => {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace || !userId) {
      throw new Error("No hay un workspace disponible para guardar el cambio.");
    }

    await enqueueOfflineOperation({
      ...offlineOperation,
      userId,
      workspaceId: currentWorkspace.id,
    });
    const remaining = await countOfflineOperations(userId, currentWorkspace.id);
    setPendingSync(remaining);
    setOfflineMode(true);
    return { data: fallbackData, error: null, queued: true };
  }, [userId]);

  const performWrite = useCallback(async (
    operation,
    message,
    { fallbackData = null, offlineOperation = null } = {},
  ) => {
    pendingWritesRef.current += 1;
    setPendingWrites(pendingWritesRef.current);
    setSyncError(null);

    try {
      if (
        offlineOperation &&
        typeof navigator !== "undefined" &&
        navigator.onLine === false
      ) {
        return await queueOperation(offlineOperation, fallbackData);
      }

      return { data: await operation(), error: null };
    } catch (error) {
      if (offlineOperation && isNetworkError(error)) {
        try {
          return await queueOperation(offlineOperation, fallbackData);
        } catch (storageError) {
          const storageMessage = "No se pudo guardar el cambio en este dispositivo.";
          setSyncError(storageMessage);
          return {
            data: null,
            error: normalizeError(storageError, storageMessage),
          };
        }
      }

      setSyncError(message);
      return { data: null, error: normalizeError(error, message) };
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      setPendingWrites(pendingWritesRef.current);
    }
  }, [queueOperation]);

  const flushPendingChanges = useCallback(async (workspaceOverride) => {
    const currentWorkspace = workspaceOverride ?? workspaceRef.current;
    if (!supabase || !userId || !currentWorkspace) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOfflineMode(true);
      return false;
    }
    if (syncingOfflineRef.current) return false;

    const queued = await countOfflineOperations(userId, currentWorkspace.id);
    setPendingSync(queued);
    if (queued === 0) {
      setOfflineMode(false);
      return true;
    }

    syncingOfflineRef.current = true;
    setSyncingOffline(true);
    setSyncError(null);

    try {
      await flushOfflineOperations(
        supabase,
        userId,
        currentWorkspace.id,
        setPendingSync,
      );
      setPendingSync(0);
      setOfflineMode(false);
      return true;
    } catch (error) {
      const remaining = await countOfflineOperations(userId, currentWorkspace.id);
      setPendingSync(remaining);
      if (isNetworkError(error)) {
        setOfflineMode(true);
      } else {
        setSyncError("Hay cambios pendientes que necesitan reintentarse.");
      }
      return false;
    } finally {
      syncingOfflineRef.current = false;
      setSyncingOffline(false);
    }
  }, [userId]);

  const loadWorkspace = useCallback(async () => {
    if (!supabase || !userId) return;

    setLoading(true);
    setInitializationError(null);
    let cachedSnapshot = null;

    try {
      cachedSnapshot = await getOfflineSnapshot(userId);
      if (cachedSnapshot?.workspace && cachedSnapshot?.data) {
        const cachedPriorities = cachedSnapshot.data.priorities ?? [];
        const cachedData = {
          ...cachedSnapshot.data,
          memories: await hydrateOfflineMemories(cachedSnapshot.data.memories ?? []),
          priorities: cachedSnapshot.localDate === getLocalDateKey()
            ? cachedPriorities
            : cachedPriorities.map((priority) => ({ ...priority, done: false })),
        };
        workspaceRef.current = cachedSnapshot.workspace;
        setWorkspace(cachedSnapshot.workspace);
        commitWorkspaceData(cachedData);
        setPendingSync(
          await countOfflineOperations(userId, cachedSnapshot.workspace.id),
        );
      }
    } catch {
      // Si la caché local falla, todavía podemos abrir desde Supabase.
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOfflineMode(true);
      if (!cachedSnapshot) {
        const error = new Error(
          "Necesitas abrir este workspace una vez con internet antes de usarlo sin conexion.",
        );
        error.code = "OFFLINE_CACHE_MISSING";
        setInitializationError(error);
      }
      setLoading(false);
      return;
    }

    try {
      let nextWorkspace = await findUserWorkspace(supabase, userId);

      if (!nextWorkspace.initializedAt) {
        await initializeWorkspace(
          supabase,
          nextWorkspace.id,
          readLocalWorkspaceSeed(),
        );
        nextWorkspace = await findUserWorkspace(supabase, userId);
      }

      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      const queueFlushed = await flushPendingChanges(nextWorkspace);
      if (!queueFlushed) {
        const remaining = await countOfflineOperations(userId, nextWorkspace.id);
        if (remaining > 0) return;
      }

      const data = await fetchWorkspaceData(
        supabase,
        nextWorkspace.id,
        getLocalDateKey(),
        memoriesRef.current,
      );

      if (data.priorities.length !== 3) {
        const error = new Error("El workspace no contiene sus tres prioridades.");
        error.code = "WORKSPACE_DATA_INCOMPLETE";
        throw error;
      }

      const hydratedData = {
        ...data,
        memories: await hydrateOfflineMemories(data.memories),
      };
      revokeOfflineMemoryUrls(memoriesRef.current);
      commitWorkspaceData(hydratedData);
      void cacheRemoteMemoryImages(data.memories, userId, nextWorkspace.id);
      setOfflineMode(false);
      setSyncError(null);
    } catch (error) {
      if (cachedSnapshot) {
        setOfflineMode(true);
        if (!isNetworkError(error)) {
          setSyncError("No se pudo actualizar el workspace; seguimos usando la copia local.");
        }
      } else {
        setInitializationError(normalizeError(error, "No se pudo abrir el workspace."));
      }
    } finally {
      setLoading(false);
    }
  }, [commitWorkspaceData, flushPendingChanges, userId]);

  const refresh = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    if (!supabase || !currentWorkspace) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOfflineMode(true);
      return false;
    }

    try {
      if (!await flushPendingChanges(currentWorkspace)) return false;
      const data = await fetchWorkspaceData(
        supabase,
        currentWorkspace.id,
        getLocalDateKey(),
        memoriesRef.current,
      );
      const hydratedData = {
        ...data,
        memories: await hydrateOfflineMemories(data.memories),
      };
      revokeOfflineMemoryUrls(memoriesRef.current);
      commitWorkspaceData(hydratedData);
      void cacheRemoteMemoryImages(data.memories, userId, currentWorkspace.id);
      setOfflineMode(false);
      setSyncError(null);
      return true;
    } catch (error) {
      if (isNetworkError(error)) {
        setOfflineMode(true);
        setSyncError(null);
      } else {
        setSyncError("No pudimos actualizar los datos compartidos.");
      }
      return false;
    }
  }, [commitWorkspaceData, flushPendingChanges, userId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timerId);
  }, [loadWorkspace]);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState !== "visible") return;
      if (
        pendingWritesRef.current > 0 ||
        priorityTimerRef.current ||
        priorityNeedsRetryRef.current ||
        noteTimersRef.current.size > 0 ||
        noteBuffersRef.current.size > 0
      ) {
        return;
      }

      void refresh();
    }

    const refreshWhenOnline = () => void refresh();
    const markOffline = () => setOfflineMode(true);

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenOnline);
    window.addEventListener("offline", markOffline);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const intervalId = window.setInterval(refreshWhenVisible, 30000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenOnline);
      window.removeEventListener("offline", markOffline);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId || !workspace || priorities.length !== 3) return undefined;
    const timerId = window.setTimeout(() => {
      void saveOfflineSnapshot(userId, workspace, {
        albums,
        memories,
        notes,
        priorities,
        quickNote,
        tasks,
      });
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [albums, memories, notes, priorities, quickNote, tasks, userId, workspace]);

  useEffect(() => {
    if (userId) void requestPersistentStorage();
  }, [userId]);

  useEffect(
    () => () => {
      if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current);
      noteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      noteTimersRef.current.clear();
      revokeOfflineMemoryUrls(memoriesRef.current);
    },
    [],
  );

  const addTask = useCallback(
    async (value) => {
      const currentWorkspace = workspaceRef.current;
      const {
        dueDate,
        dueTime,
        priority,
        reminderMinutesBefore,
        text,
      } = normalizeTaskInput(value);
      if (!currentWorkspace || !userId || !text) return false;

      const now = new Date().toISOString();
      const task = {
        id: crypto.randomUUID(),
        text,
        done: false,
        dueDate,
        dueTime,
        priority,
        reminderAcknowledgedAt: null,
        reminderMinutesBefore,
        createdAt: now,
        updatedAt: now,
      };
      commitTasks([task, ...tasksRef.current]);

      const result = await performWrite(
        () => insertTask(supabase, currentWorkspace.id, userId, task),
        "No se pudo crear la tarea. Inténtalo nuevamente.",
        {
          fallbackData: task,
          offlineOperation: { payload: { task }, type: "task.insert" },
        },
      );

      if (result.error) {
        commitTasks(tasksRef.current.filter((item) => item.id !== task.id));
        return false;
      }

      commitTasks(
        tasksRef.current.map((item) => (item.id === task.id ? result.data : item)),
      );
      return true;
    },
    [commitTasks, performWrite, userId],
  );

  const updateTask = useCallback(
    async (taskId, fields) => {
      const currentWorkspace = workspaceRef.current;
      const previousTasks = tasksRef.current;
      const previous = previousTasks.find((task) => task.id === taskId);
      if (!currentWorkspace || !previous) return false;

      const nextFields = {};
      const databaseFields = {};

      if (Object.hasOwn(fields, "text")) {
        const text = typeof fields.text === "string" ? fields.text.trim().slice(0, 500) : "";
        if (!text) return false;
        nextFields.text = text;
        databaseFields.text = text;
      }

      if (Object.hasOwn(fields, "priority")) {
        if (!TASK_PRIORITIES.has(fields.priority)) return false;
        nextFields.priority = fields.priority;
        databaseFields.priority = fields.priority;
      }

      const scheduleChanged = Object.hasOwn(fields, "dueDate")
        || Object.hasOwn(fields, "dueTime")
        || Object.hasOwn(fields, "reminderMinutesBefore");

      if (scheduleChanged) {
        const dueDateInput = Object.hasOwn(fields, "dueDate")
          ? fields.dueDate
          : previous.dueDate;
        const dueDate = typeof dueDateInput === "string"
          && /^\d{4}-\d{2}-\d{2}$/.test(dueDateInput)
          ? dueDateInput
          : null;
        const dueTimeInput = Object.hasOwn(fields, "dueTime")
          ? fields.dueTime
          : previous.dueTime;
        const dueTime = dueDate
          && typeof dueTimeInput === "string"
          && /^\d{2}:\d{2}$/.test(dueTimeInput)
          ? dueTimeInput
          : null;
        const reminderInput = Object.hasOwn(fields, "reminderMinutesBefore")
          ? fields.reminderMinutesBefore
          : previous.reminderMinutesBefore;
        const reminderMinutesBefore = dueTime
          ? normalizeReminderMinutes(reminderInput)
          : null;

        Object.assign(nextFields, {
          dueDate,
          dueTime,
          reminderAcknowledgedAt: null,
          reminderMinutesBefore,
        });
        Object.assign(databaseFields, {
          due_date: dueDate,
          due_time: dueTime,
          reminder_acknowledged_at: null,
          reminder_minutes_before: reminderMinutesBefore,
        });
      } else if (Object.hasOwn(fields, "reminderAcknowledgedAt")) {
        const acknowledgedAt = typeof fields.reminderAcknowledgedAt === "string"
          && !Number.isNaN(new Date(fields.reminderAcknowledgedAt).getTime())
          ? fields.reminderAcknowledgedAt
          : null;
        nextFields.reminderAcknowledgedAt = acknowledgedAt;
        databaseFields.reminder_acknowledged_at = acknowledgedAt;
      }

      if (Object.keys(databaseFields).length === 0) return true;

      const updatedTask = {
        ...previous,
        ...nextFields,
        updatedAt: new Date().toISOString(),
      };
      commitTasks(
        previousTasks.map((task) => (task.id === taskId ? updatedTask : task)),
      );

      const result = await performWrite(
        () => updateTaskRemote(supabase, currentWorkspace.id, taskId, databaseFields),
        "No se pudo actualizar la tarea.",
        {
          fallbackData: updatedTask,
          offlineOperation: {
            payload: { fields: databaseFields, taskId },
            type: "task.update",
          },
        },
      );

      if (result.error) {
        commitTasks(previousTasks);
        return false;
      }

      commitTasks(
        tasksRef.current.map((task) => (task.id === taskId ? result.data : task)),
      );
      return true;
    },
    [commitTasks, performWrite],
  );

  const toggleTask = useCallback(
    async (taskId) => {
      const currentWorkspace = workspaceRef.current;
      const previous = tasksRef.current.find((task) => task.id === taskId);
      if (!currentWorkspace || !previous) return false;

      const nextDone = !previous.done;
      const updatedTask = {
        ...previous,
        done: nextDone,
        updatedAt: new Date().toISOString(),
      };
      commitTasks(
        tasksRef.current.map((task) =>
          task.id === taskId ? updatedTask : task,
        ),
      );

      const result = await performWrite(
        () => updateTaskRemote(supabase, currentWorkspace.id, taskId, { done: nextDone }),
        "No se pudo actualizar la tarea.",
        {
          fallbackData: updatedTask,
          offlineOperation: {
            payload: { fields: { done: nextDone }, taskId },
            type: "task.update",
          },
        },
      );

      if (result.error) {
        commitTasks(
          tasksRef.current.map((task) =>
            task.id === taskId && task.done === nextDone
              ? { ...task, done: previous.done }
              : task,
          ),
        );
        return false;
      }

      commitTasks(
        tasksRef.current.map((task) => (task.id === taskId ? result.data : task)),
      );
      return true;
    },
    [commitTasks, performWrite],
  );

  const removeTask = useCallback(
    async (taskId) => {
      const currentWorkspace = workspaceRef.current;
      const previousTasks = tasksRef.current;
      if (!currentWorkspace || !previousTasks.some((task) => task.id === taskId)) return false;

      commitTasks(previousTasks.filter((task) => task.id !== taskId));
      const result = await performWrite(
        () => deleteTaskRemote(supabase, currentWorkspace.id, taskId),
        "No se pudo eliminar la tarea.",
        {
          offlineOperation: { payload: { taskId }, type: "task.delete" },
        },
      );

      if (result.error) {
        commitTasks(previousTasks);
        return false;
      }

      return true;
    },
    [commitTasks, performWrite],
  );

  const clearCompletedTasks = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    const previousTasks = tasksRef.current;
    if (!currentWorkspace || !previousTasks.some((task) => task.done)) return true;

    commitTasks(previousTasks.filter((task) => !task.done));
    const result = await performWrite(
      () => deleteCompletedTasksRemote(supabase, currentWorkspace.id),
      "No se pudieron limpiar las tareas terminadas.",
      {
        offlineOperation: { payload: {}, type: "task.clearCompleted" },
      },
    );

    if (result.error) {
      commitTasks(previousTasks);
      return false;
    }

    return true;
  }, [commitTasks, performWrite]);

  const createNote = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace || !userId) return null;

    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      title: "Nueva nota",
      content: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await performWrite(
      () => insertNote(supabase, currentWorkspace.id, userId, note),
      "No se pudo crear la nota.",
      {
        fallbackData: note,
        offlineOperation: { payload: { note }, type: "note.insert" },
      },
    );

    if (result.error) return null;
    commitNotes([result.data, ...notesRef.current]);
    return result.data;
  }, [commitNotes, performWrite, userId]);

  const addAlbum = useCallback(
    async ({ description, title }) => {
      const currentWorkspace = workspaceRef.current;
      const normalizedTitle = title.trim().slice(0, 80);
      if (!currentWorkspace || !userId || !normalizedTitle) {
        return { data: null, error: new Error("Escribe un nombre para el álbum.") };
      }

      const now = new Date().toISOString();
      const album = {
        coverMemoryId: null,
        createdAt: now,
        description: description.trim().slice(0, 500),
        id: crypto.randomUUID(),
        title: normalizedTitle,
        updatedAt: now,
      };
      const result = await performWrite(
        () => insertAlbum(supabase, currentWorkspace.id, userId, album),
        "No se pudo crear el álbum.",
        {
          fallbackData: album,
          offlineOperation: { payload: { album }, type: "album.insert" },
        },
      );

      if (result.error) return result;
      commitAlbums([result.data, ...albumsRef.current]);
      return result;
    },
    [commitAlbums, performWrite, userId],
  );

  const addMemory = useCallback(
    async ({ albumId, description, file, memoryDate, title }) => {
      const currentWorkspace = workspaceRef.current;
      const normalizedTitle = title.trim().slice(0, 120);
      const validMemoryDate = /^\d{4}-\d{2}-\d{2}$/.test(memoryDate)
        && memoryDate <= getLocalDateKey();
      if (
        !currentWorkspace ||
        !userId ||
        !albumsRef.current.some((album) => album.id === albumId) ||
        !file ||
        !validMemoryDate
      ) {
        return { data: null, error: new Error("Completa los datos del recuerdo.") };
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const memory = {
        albumId,
        description: description.trim().slice(0, 4000),
        id,
        memoryDate,
        storagePath: `${currentWorkspace.id}/${id}.jpg`,
        title: normalizedTitle || null,
      };

      let image;
      try {
        image = await prepareMemoryImage(file);
        await putOfflineImage({
          blob: image.blob,
          memoryId: id,
          storagePath: memory.storagePath,
          userId,
          workspaceId: currentWorkspace.id,
        });
      } catch (error) {
        return { data: null, error: normalizeError(error, "No se pudo preparar la foto.") };
      }

      const localMemory = {
        ...memory,
        createdAt: now,
        fileSize: image.blob.size,
        imageUrl: URL.createObjectURL(image.blob),
        imageUrlExpiresAt: Number.POSITIVE_INFINITY,
        mimeType: image.mimeType,
        offlineImageUrl: true,
        updatedAt: now,
      };
      commitMemories(
        [localMemory, ...memoriesRef.current].sort((a, b) =>
          b.memoryDate.localeCompare(a.memoryDate),
        ),
      );

      const result = await performWrite(
        () => insertMemory(
          supabase,
          currentWorkspace.id,
          userId,
          memory,
          image,
        ),
        "No se pudo guardar el recuerdo. Revisa la fotografía e inténtalo otra vez.",
        {
          fallbackData: localMemory,
          offlineOperation: {
            payload: { memory },
            type: "memory.insert",
          },
        },
      );

      if (result.error) {
        commitMemories(memoriesRef.current.filter((item) => item.id !== id));
        URL.revokeObjectURL(localMemory.imageUrl);
        await removeOfflineImage(id);
        return result;
      }
      if (!result.queued) URL.revokeObjectURL(localMemory.imageUrl);
      commitMemories(
        memoriesRef.current.map((item) => (item.id === id ? result.data : item)).sort((a, b) =>
          b.memoryDate.localeCompare(a.memoryDate),
        ),
      );
      return result;
    },
    [commitMemories, performWrite, userId],
  );

  const removeMemory = useCallback(
    async (memoryId) => {
      const currentWorkspace = workspaceRef.current;
      const memory = memoriesRef.current.find((item) => item.id === memoryId);
      if (!currentWorkspace || !memory) return false;
      const previousMemories = memoriesRef.current;
      const previousAlbums = albumsRef.current;

      commitMemories(previousMemories.filter((item) => item.id !== memoryId));
      commitAlbums(
        previousAlbums.map((album) =>
          album.coverMemoryId === memoryId
            ? { ...album, coverMemoryId: null }
            : album,
        ),
      );

      const result = await performWrite(
        () =>
          deleteMemoryRemote(
            supabase,
            currentWorkspace.id,
            memory.id,
            memory.storagePath,
          ),
        "No se pudo eliminar el recuerdo.",
        {
          offlineOperation: {
            payload: {
              memoryId: memory.id,
              storagePath: memory.storagePath,
            },
            type: "memory.delete",
          },
        },
      );

      if (result.error) {
        commitMemories(previousMemories);
        commitAlbums(previousAlbums);
        return false;
      }
      if (!result.queued) await removeOfflineImage(memoryId);
      if (memory.offlineImageUrl && memory.imageUrl) URL.revokeObjectURL(memory.imageUrl);
      return true;
    },
    [commitAlbums, commitMemories, performWrite],
  );

  const setAlbumCover = useCallback(
    async (albumId, memoryId) => {
      const currentWorkspace = workspaceRef.current;
      const album = albumsRef.current.find((item) => item.id === albumId);
      const memory = memoryId
        ? memoriesRef.current.find((item) => item.id === memoryId)
        : null;

      if (
        !currentWorkspace ||
        !album ||
        (memoryId && (!memory || memory.albumId !== albumId))
      ) {
        return false;
      }

      const updatedAlbum = {
        ...album,
        coverMemoryId: memoryId,
        updatedAt: new Date().toISOString(),
      };
      commitAlbums(
        albumsRef.current.map((item) =>
          item.id === albumId ? updatedAlbum : item,
        ),
      );

      const result = await performWrite(
        () =>
          updateAlbumCoverRemote(
            supabase,
            currentWorkspace.id,
            albumId,
            memoryId,
          ),
        "No se pudo cambiar la portada del álbum.",
        {
          fallbackData: updatedAlbum,
          offlineOperation: {
            payload: { albumId, memoryId },
            type: "album.cover",
          },
        },
      );

      if (result.error) {
        commitAlbums(
          albumsRef.current.map((item) => (item.id === albumId ? album : item)),
        );
        return false;
      }
      commitAlbums(
        albumsRef.current.map((item) =>
          item.id === albumId ? result.data : item,
        ),
      );
      return true;
    },
    [commitAlbums, performWrite],
  );

  const updateAlbum = useCallback(
    async (albumId, { description, title }) => {
      const currentWorkspace = workspaceRef.current;
      const album = albumsRef.current.find((item) => item.id === albumId);
      const normalizedTitle = title.trim().slice(0, 80);
      if (!currentWorkspace || !album || !normalizedTitle) {
        return { data: null, error: new Error("Escribe un nombre para el álbum.") };
      }

      const fields = {
        description: description.trim().slice(0, 500),
        title: normalizedTitle,
      };
      const updatedAlbum = {
        ...album,
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      commitAlbums(
        albumsRef.current.map((item) =>
          item.id === albumId ? updatedAlbum : item,
        ),
      );

      const result = await performWrite(
        () =>
          updateAlbumRemote(supabase, currentWorkspace.id, albumId, {
            ...fields,
          }),
        "No se pudo actualizar el álbum.",
        {
          fallbackData: updatedAlbum,
          offlineOperation: {
            payload: { albumId, fields },
            type: "album.update",
          },
        },
      );

      if (result.error) {
        commitAlbums(
          albumsRef.current.map((item) => (item.id === albumId ? album : item)),
        );
        return result;
      }
      commitAlbums(
        albumsRef.current.map((item) =>
          item.id === albumId ? result.data : item,
        ),
      );
      return result;
    },
    [commitAlbums, performWrite],
  );

  const removeAlbum = useCallback(
    async (albumId) => {
      const currentWorkspace = workspaceRef.current;
      const album = albumsRef.current.find((item) => item.id === albumId);
      if (!currentWorkspace || !album) return false;

      const albumMemories = memoriesRef.current.filter(
        (memory) => memory.albumId === albumId,
      );
      const previousAlbums = albumsRef.current;
      const previousMemories = memoriesRef.current;
      commitMemories(previousMemories.filter((memory) => memory.albumId !== albumId));
      commitAlbums(previousAlbums.filter((item) => item.id !== albumId));

      const result = await performWrite(
        () =>
          deleteAlbumRemote(
            supabase,
            currentWorkspace.id,
            albumId,
            albumMemories.map((memory) => memory.storagePath),
          ),
        "No se pudo eliminar el álbum.",
        {
          offlineOperation: {
            payload: {
              albumId,
              memoryIds: albumMemories.map((memory) => memory.id),
              storagePaths: albumMemories.map((memory) => memory.storagePath),
            },
            type: "album.delete",
          },
        },
      );

      if (result.error) {
        commitMemories(previousMemories);
        commitAlbums(previousAlbums);
        return false;
      }
      if (!result.queued) {
        await removeOfflineImages(albumMemories.map((memory) => memory.id));
      }
      albumMemories.forEach((memory) => {
        if (memory.offlineImageUrl && memory.imageUrl) URL.revokeObjectURL(memory.imageUrl);
      });
      return true;
    },
    [commitAlbums, commitMemories, performWrite],
  );

  const flushNoteUpdate = useCallback(
    async (noteId) => {
      const currentWorkspace = workspaceRef.current;
      const fields = noteBuffersRef.current.get(noteId);
      if (!currentWorkspace || !fields) return;

      noteBuffersRef.current.delete(noteId);
      noteTimersRef.current.delete(noteId);
      updateBufferedWriteCount();
      const fallbackNote = notesRef.current.find((note) => note.id === noteId) ?? null;

      const result = await performWrite(
        () => updateNoteRemote(supabase, currentWorkspace.id, noteId, fields),
        "No se pudo guardar la nota. Tus cambios siguen visibles para que puedas reintentarlo.",
        {
          fallbackData: fallbackNote,
          offlineOperation: {
            payload: { fields, noteId },
            type: "note.update",
          },
        },
      );

      if (result.error) {
        const newerFields = noteBuffersRef.current.get(noteId) ?? {};
        noteBuffersRef.current.set(noteId, { ...fields, ...newerFields });
        return;
      }

      const pendingFields = noteBuffersRef.current.get(noteId);
      commitNotes(
        notesRef.current.map((note) => {
          if (note.id !== noteId) return note;
          return pendingFields
            ? applyPendingNoteFields(result.data, pendingFields)
            : result.data;
        }),
      );
    },
    [commitNotes, performWrite, updateBufferedWriteCount],
  );

  const updateNoteDraft = useCallback(
    (noteId, fields) => {
      const databaseFields = {};
      if (Object.hasOwn(fields, "title")) databaseFields.title = fields.title.slice(0, 200);
      if (Object.hasOwn(fields, "content")) {
        databaseFields.content = fields.content.slice(0, 100000);
      }
      if (Object.hasOwn(fields, "pinned")) databaseFields.pinned = fields.pinned;

      if (Object.keys(databaseFields).length === 0) return;

      const updatedAt = new Date().toISOString();
      commitNotes(
        notesRef.current.map((note) =>
          note.id === noteId
            ? { ...applyPendingNoteFields(note, databaseFields), updatedAt }
            : note,
        ),
      );

      noteBuffersRef.current.set(noteId, {
        ...(noteBuffersRef.current.get(noteId) ?? {}),
        ...databaseFields,
      });

      const previousTimer = noteTimersRef.current.get(noteId);
      if (previousTimer) window.clearTimeout(previousTimer);
      const timerId = window.setTimeout(() => void flushNoteUpdate(noteId), 650);
      noteTimersRef.current.set(noteId, timerId);
      updateBufferedWriteCount();
    },
    [commitNotes, flushNoteUpdate, updateBufferedWriteCount],
  );

  const removeNote = useCallback(
    async (noteId) => {
      const currentWorkspace = workspaceRef.current;
      const previousNotes = notesRef.current;
      if (!currentWorkspace || !previousNotes.some((note) => note.id === noteId)) return false;

      const timerId = noteTimersRef.current.get(noteId);
      if (timerId) window.clearTimeout(timerId);
      noteTimersRef.current.delete(noteId);
      noteBuffersRef.current.delete(noteId);
      updateBufferedWriteCount();
      commitNotes(previousNotes.filter((note) => note.id !== noteId));

      const result = await performWrite(
        () => deleteNoteRemote(supabase, currentWorkspace.id, noteId),
        "No se pudo eliminar la nota.",
        {
          offlineOperation: { payload: { noteId }, type: "note.delete" },
        },
      );

      if (result.error) {
        commitNotes(previousNotes);
        return false;
      }

      return true;
    },
    [commitNotes, performWrite, updateBufferedWriteCount],
  );

  const flushPriorities = useCallback(
    async (snapshot) => {
      const currentWorkspace = workspaceRef.current;
      priorityTimerRef.current = null;
      updateBufferedWriteCount();
      if (!currentWorkspace) return;

      const result = await performWrite(
        () =>
          savePrioritiesRemote(
            supabase,
            currentWorkspace.id,
            snapshot,
            getLocalDateKey(),
          ),
        "No se pudieron guardar las prioridades.",
        {
          fallbackData: snapshot,
          offlineOperation: {
            payload: { localDate: getLocalDateKey(), priorities: snapshot },
            type: "priorities.save",
          },
        },
      );
      priorityNeedsRetryRef.current = Boolean(result.error);
    },
    [performWrite, updateBufferedWriteCount],
  );

  const changePriorities = useCallback(
    (transform) => {
      const slots = [...prioritiesRef.current].sort((a, b) => a.position - b.position);
      const transformed = transform([...slots]);
      const normalized = transformed.map((priority, index) => ({
        ...priority,
        id: slots[index].id,
        position: index + 1,
      }));

      commitPriorities(normalized);
      if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current);
      priorityTimerRef.current = window.setTimeout(
        () => void flushPriorities(normalized),
        450,
      );
      updateBufferedWriteCount();
    },
    [commitPriorities, flushPriorities, updateBufferedWriteCount],
  );

  const togglePriority = useCallback(
    (priorityId) => {
      changePriorities((current) =>
        current.map((priority) =>
          priority.id === priorityId ? { ...priority, done: !priority.done } : priority,
        ),
      );
    },
    [changePriorities],
  );

  const updatePriorityText = useCallback(
    (priorityId, text) => {
      changePriorities((current) =>
        current.map((priority) =>
          priority.id === priorityId
            ? { ...priority, text: text.slice(0, 500) }
            : priority,
        ),
      );
    },
    [changePriorities],
  );

  const resetPriorities = useCallback(() => {
    changePriorities((current) =>
      current.map((priority) => ({ ...priority, done: false })),
    );
  }, [changePriorities]);

  const movePriority = useCallback(
    (from, to) => {
      if (to < 0 || to >= prioritiesRef.current.length || from === to) return;
      changePriorities((current) => {
        const copy = [...current];
        const [moved] = copy.splice(from, 1);
        copy.splice(to, 0, moved);
        return copy;
      });
    },
    [changePriorities],
  );

  const saveQuickNote = useCallback(
    async (content) => {
      const currentWorkspace = workspaceRef.current;
      if (!currentWorkspace) return false;

      const normalizedContent = content.slice(0, 10000);
      const previousContent = quickNote;
      commitQuickNote(normalizedContent);
      const result = await performWrite(
        () => updateQuickNote(supabase, currentWorkspace.id, normalizedContent),
        "No se pudo guardar la nota rápida.",
        {
          fallbackData: normalizedContent,
          offlineOperation: {
            payload: { content: normalizedContent },
            type: "quickNote.update",
          },
        },
      );

      if (result.error) {
        commitQuickNote(previousContent);
        return false;
      }
      commitQuickNote(result.data);
      return true;
    },
    [commitQuickNote, performWrite, quickNote],
  );

  useEffect(() => {
    function flushBufferedChanges() {
      noteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      [...noteBuffersRef.current.keys()].forEach((noteId) => {
        void flushNoteUpdate(noteId);
      });

      if (priorityTimerRef.current) {
        window.clearTimeout(priorityTimerRef.current);
        priorityTimerRef.current = null;
        void flushPriorities(prioritiesRef.current);
      }
    }

    function flushWhenHidden() {
      if (document.visibilityState === "hidden") flushBufferedChanges();
    }

    window.addEventListener("pagehide", flushBufferedChanges);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushBufferedChanges);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushNoteUpdate, flushPriorities]);

  const retrySync = useCallback(async () => {
    const pendingNoteIds = [...noteBuffersRef.current.keys()];
    const operations = pendingNoteIds.map((noteId) => flushNoteUpdate(noteId));

    if (priorityNeedsRetryRef.current) {
      operations.push(flushPriorities(prioritiesRef.current));
    }

    if (operations.length > 0) await Promise.all(operations);
    return refresh();
  }, [flushNoteUpdate, flushPriorities, refresh]);

  const value = {
    addAlbum,
    addMemory,
    addTask,
    clearCompletedTasks,
    clearSyncError: () => setSyncError(null),
    createNote,
    initializationError,
    loading,
    albums,
    memories,
    movePriority,
    notes,
    offlineMode,
    pendingSync,
    priorities,
    quickNote,
    refresh,
    retrySync,
    retryInitialization: loadWorkspace,
    removeNote,
    removeMemory,
    removeAlbum,
    removeTask,
    resetPriorities,
    saveQuickNote,
    saving: pendingWrites > 0 || bufferedWrites > 0 || syncingOffline,
    setAlbumCover,
    syncError,
    tasks,
    togglePriority,
    toggleTask,
    updateTask,
    updateNoteDraft,
    updateAlbum,
    updatePriorityText,
    workspace,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
