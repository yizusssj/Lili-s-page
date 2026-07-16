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
  hydrateOfflineTrash,
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
import { createMemoryUploadError } from "../utils/memoryUploadErrors.js";
import { normalizeReminderMinutes } from "../utils/reminders.js";
import { writeJSON, writeText } from "../utils/storage.js";
import {
  normalizeCompletedOccurrenceDates,
  normalizeTaskRecurrence,
  TASK_RECURRENCE,
} from "../utils/taskRecurrence.js";
import { WorkspaceContext } from "./workspaceContext.js";
import {
  deleteAlbum as deleteAlbumRemote,
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
  restoreAlbum as restoreAlbumRemote,
  restoreMemory as restoreMemoryRemote,
  restoreNote as restoreNoteRemote,
  restoreTask as restoreTaskRemote,
  savePriorities as savePrioritiesRemote,
  trashAlbum as trashAlbumRemote,
  trashCompletedTasks as trashCompletedTasksRemote,
  trashMemory as trashMemoryRemote,
  trashNote as trashNoteRemote,
  trashTask as trashTaskRemote,
  updateAlbumCover as updateAlbumCoverRemote,
  updateAlbum as updateAlbumRemote,
  updateNote as updateNoteRemote,
  updateMemory as updateMemoryRemote,
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

function getTrashMemories(items) {
  return items.flatMap((item) => {
    if (item.type === "album") return item.memories ?? [];
    if (item.type === "memory" && item.data) return [item.data];
    return [];
  });
}

const TASK_PRIORITIES = new Set(["low", "medium", "high"]);
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
  const recurrence = normalizeTaskRecurrence(input.recurrence, dueDate);

  return {
    dueDate,
    dueTime,
    priority,
    recurrence,
    recurrenceCompletedDates: [],
    reminderMinutesBefore,
    text,
  };
}

export default function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [workspace, setWorkspace] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [memories, setMemories] = useState([]);
  const [trash, setTrash] = useState([]);
  const [lastTrashed, setLastTrashed] = useState(null);
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
  const trashRef = useRef([]);
  const prioritiesRef = useRef([]);
  const pendingWritesRef = useRef(0);
  const noteBuffersRef = useRef(new Map());
  const noteTimersRef = useRef(new Map());
  const priorityTimerRef = useRef(null);
  const priorityNeedsRetryRef = useRef(false);
  const syncingOfflineRef = useRef(false);
  const purgingTrashRef = useRef(false);

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

  const commitTrash = useCallback((nextTrash) => {
    const sorted = [...nextTrash].sort((first, second) =>
      String(second.deletedAt ?? "").localeCompare(String(first.deletedAt ?? "")),
    );
    trashRef.current = sorted;
    setTrash(sorted);
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
      commitTrash(data.trash ?? []);
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
      commitTrash,
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
          trash: await hydrateOfflineTrash(cachedSnapshot.data.trash ?? []),
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
        trashRef.current,
      );

      if (data.priorities.length !== 3) {
        const error = new Error("El workspace no contiene sus tres prioridades.");
        error.code = "WORKSPACE_DATA_INCOMPLETE";
        throw error;
      }

      const hydratedData = {
        ...data,
        memories: await hydrateOfflineMemories(data.memories),
        trash: await hydrateOfflineTrash(data.trash),
      };
      revokeOfflineMemoryUrls(memoriesRef.current);
      revokeOfflineMemoryUrls(getTrashMemories(trashRef.current));
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
        trashRef.current,
      );
      const hydratedData = {
        ...data,
        memories: await hydrateOfflineMemories(data.memories),
        trash: await hydrateOfflineTrash(data.trash),
      };
      revokeOfflineMemoryUrls(memoriesRef.current);
      revokeOfflineMemoryUrls(getTrashMemories(trashRef.current));
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
        trash,
      });
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [albums, memories, notes, priorities, quickNote, tasks, trash, userId, workspace]);

  useEffect(() => {
    if (userId) void requestPersistentStorage();
  }, [userId]);

  useEffect(
    () => () => {
      if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current);
      noteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      noteTimersRef.current.clear();
      revokeOfflineMemoryUrls(memoriesRef.current);
      revokeOfflineMemoryUrls(getTrashMemories(trashRef.current));
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
        recurrence,
        recurrenceCompletedDates,
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
        recurrence,
        recurrenceCompletedDates,
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
        || Object.hasOwn(fields, "recurrence")
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
        const recurrenceInput = Object.hasOwn(fields, "recurrence")
          ? fields.recurrence
          : previous.recurrence;
        const recurrence = normalizeTaskRecurrence(recurrenceInput, dueDate);
        const recurrenceReset = dueDate !== previous.dueDate
          || recurrence !== previous.recurrence;
        const recurrenceCompletedDates = recurrenceReset
          ? []
          : normalizeCompletedOccurrenceDates(previous.recurrenceCompletedDates);

        Object.assign(nextFields, {
          dueDate,
          dueTime,
          recurrence,
          recurrenceCompletedDates,
          reminderAcknowledgedAt: null,
          reminderMinutesBefore,
        });
        Object.assign(databaseFields, {
          due_date: dueDate,
          due_time: dueTime,
          recurrence,
          recurrence_completed_dates: recurrenceCompletedDates,
          reminder_acknowledged_at: null,
          reminder_minutes_before: reminderMinutesBefore,
        });
      } else if (Object.hasOwn(fields, "recurrenceCompletedDates")) {
        const recurrenceCompletedDates = previous.recurrence === TASK_RECURRENCE.once
          ? []
          : normalizeCompletedOccurrenceDates(fields.recurrenceCompletedDates);
        nextFields.recurrenceCompletedDates = recurrenceCompletedDates;
        databaseFields.recurrence_completed_dates = recurrenceCompletedDates;
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

  const toggleTaskOccurrence = useCallback(
    async (taskId, dateKey) => {
      const task = tasksRef.current.find((item) => item.id === taskId);
      if (!task) return false;
      if (task.recurrence === TASK_RECURRENCE.once) return toggleTask(taskId);
      if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return false;
      }

      const completedDates = new Set(
        normalizeCompletedOccurrenceDates(task.recurrenceCompletedDates),
      );
      if (completedDates.has(dateKey)) completedDates.delete(dateKey);
      else completedDates.add(dateKey);

      return updateTask(taskId, {
        recurrenceCompletedDates: [...completedDates].sort(),
      });
    },
    [toggleTask, updateTask],
  );

  const removeTask = useCallback(
    async (taskId) => {
      const currentWorkspace = workspaceRef.current;
      const previousTasks = tasksRef.current;
      const task = previousTasks.find((item) => item.id === taskId);
      if (!currentWorkspace || !task) return false;

      const previousTrash = trashRef.current;
      const deletedAt = new Date().toISOString();
      const trashItem = {
        data: { ...task, deletedAt },
        deletedAt,
        id: taskId,
        type: "task",
      };

      commitTasks(previousTasks.filter((task) => task.id !== taskId));
      commitTrash([trashItem, ...previousTrash.filter((item) =>
        !(item.type === "task" && item.id === taskId),
      )]);
      const result = await performWrite(
        () => trashTaskRemote(supabase, currentWorkspace.id, taskId),
        "No se pudo eliminar la tarea.",
        {
          fallbackData: trashItem.data,
          offlineOperation: { payload: { taskId }, type: "task.trash" },
        },
      );

      if (result.error) {
        commitTasks(previousTasks);
        commitTrash(previousTrash);
        return false;
      }

      setLastTrashed({
        id: crypto.randomUUID(),
        items: [{ id: taskId, type: "task" }],
        message: "Tarea movida a la papelera",
      });
      return true;
    },
    [commitTasks, commitTrash, performWrite],
  );

  const clearCompletedTasks = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    const previousTasks = tasksRef.current;
    const completedTasks = previousTasks.filter((task) => task.done);
    if (!currentWorkspace || completedTasks.length === 0) return true;

    const previousTrash = trashRef.current;
    const deletedAt = new Date().toISOString();
    const trashItems = completedTasks.map((task) => ({
      data: { ...task, deletedAt },
      deletedAt,
      id: task.id,
      type: "task",
    }));
    commitTasks(previousTasks.filter((task) => !task.done));
    commitTrash([...trashItems, ...previousTrash]);
    const result = await performWrite(
      () => trashCompletedTasksRemote(
        supabase,
        currentWorkspace.id,
        completedTasks.map((task) => task.id),
      ),
      "No se pudieron limpiar las tareas terminadas.",
      {
        fallbackData: completedTasks,
        offlineOperation: {
          payload: { taskIds: completedTasks.map((task) => task.id) },
          type: "task.trashCompleted",
        },
      },
    );

    if (result.error) {
      commitTasks(previousTasks);
      commitTrash(previousTrash);
      return false;
    }

    setLastTrashed({
      id: crypto.randomUUID(),
      items: completedTasks.map((task) => ({ id: task.id, type: "task" })),
      message: `${completedTasks.length} tareas movidas a la papelera`,
    });
    return true;
  }, [commitTasks, commitTrash, performWrite]);

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
    async ({ albumId, description, file, memoryDate, sortOrder, title }) => {
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
      const fallbackSortOrder = Date.now() * 1000;
      const memory = {
        albumId,
        description: description.trim().slice(0, 4000),
        id,
        memoryDate,
        sortOrder: Number.isSafeInteger(sortOrder) && sortOrder > 0
          ? sortOrder
          : fallbackSortOrder,
        storagePath: `${currentWorkspace.id}/${id}.jpg`,
        title: normalizedTitle || null,
      };

      let image;
      try {
        image = await prepareMemoryImage(file);
      } catch (error) {
        return {
          data: null,
          error: createMemoryUploadError(
            error,
            "prepare",
            "No se pudo preparar la foto.",
          ),
        };
      }

      let imageCached = false;
      try {
        await putOfflineImage({
          blob: image.blob,
          memoryId: id,
          storagePath: memory.storagePath,
          userId,
          workspaceId: currentWorkspace.id,
        });
        imageCached = true;
      } catch (error) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          return {
            data: null,
            error: createMemoryUploadError(
              error,
              "cache",
              "No se pudo guardar la foto en este dispositivo.",
            ),
          };
        }
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
          offlineOperation: imageCached
            ? {
                payload: { memory },
                type: "memory.insert",
              }
            : null,
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
      const previousTrash = trashRef.current;
      const deletedAt = new Date().toISOString();
      const trashItem = {
        data: { ...memory, deletedAt },
        deletedAt,
        id: memoryId,
        type: "memory",
      };

      commitMemories(previousMemories.filter((item) => item.id !== memoryId));
      commitTrash([trashItem, ...previousTrash.filter((item) =>
        !(item.type === "memory" && item.id === memoryId),
      )]);

      const result = await performWrite(
        () => trashMemoryRemote(supabase, currentWorkspace.id, memory.id),
        "No se pudo eliminar el recuerdo.",
        {
          fallbackData: trashItem.data,
          offlineOperation: {
            payload: { memoryId: memory.id },
            type: "memory.trash",
          },
        },
      );

      if (result.error) {
        commitMemories(previousMemories);
        commitTrash(previousTrash);
        return false;
      }
      setLastTrashed({
        id: crypto.randomUUID(),
        items: [{ id: memoryId, type: "memory" }],
        message: "Foto movida a la papelera",
      });
      return true;
    },
    [commitMemories, commitTrash, performWrite],
  );

  const updateMemory = useCallback(
    async (memoryId, fields) => {
      const currentWorkspace = workspaceRef.current;
      const memory = memoriesRef.current.find((item) => item.id === memoryId);
      if (!currentWorkspace || !memory) {
        return { data: null, error: new Error("No se encontró el recuerdo.") };
      }

      const normalizedFields = {
        description: String(fields.description ?? "").trim().slice(0, 4000),
        title: String(fields.title ?? "").trim().slice(0, 120) || null,
      };
      const updatedMemory = {
        ...memory,
        ...normalizedFields,
        updatedAt: new Date().toISOString(),
      };
      const previousMemories = memoriesRef.current;
      commitMemories(
        previousMemories.map((item) => (item.id === memoryId ? updatedMemory : item)),
      );

      const result = await performWrite(
        () => updateMemoryRemote(
          supabase,
          currentWorkspace.id,
          memoryId,
          normalizedFields,
        ),
        "No se pudieron actualizar los detalles del recuerdo.",
        {
          fallbackData: updatedMemory,
          offlineOperation: {
            payload: { fields: normalizedFields, memoryId },
            type: "memory.update",
          },
        },
      );

      if (result.error) {
        commitMemories(previousMemories);
        return result;
      }

      const savedMemory = result.queued
        ? updatedMemory
        : { ...updatedMemory, ...result.data };
      commitMemories(
        memoriesRef.current.map((item) => (item.id === memoryId ? savedMemory : item)),
      );
      return { ...result, data: savedMemory };
    },
    [commitMemories, performWrite],
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
      const previousTrash = trashRef.current;
      const deletedAt = new Date().toISOString();
      const trashItem = {
        data: { ...album, deletedAt },
        deletedAt,
        id: albumId,
        memories: albumMemories,
        type: "album",
      };
      commitMemories(previousMemories.filter((memory) => memory.albumId !== albumId));
      commitAlbums(previousAlbums.filter((item) => item.id !== albumId));
      commitTrash([trashItem, ...previousTrash.filter((item) =>
        !(item.type === "album" && item.id === albumId),
      )]);

      const result = await performWrite(
        () => trashAlbumRemote(supabase, currentWorkspace.id, albumId),
        "No se pudo eliminar el álbum.",
        {
          fallbackData: trashItem.data,
          offlineOperation: {
            payload: { albumId },
            type: "album.trash",
          },
        },
      );

      if (result.error) {
        commitMemories(previousMemories);
        commitAlbums(previousAlbums);
        commitTrash(previousTrash);
        return false;
      }
      setLastTrashed({
        id: crypto.randomUUID(),
        items: [{ id: albumId, type: "album" }],
        message: "Álbum movido a la papelera",
      });
      return true;
    },
    [commitAlbums, commitMemories, commitTrash, performWrite],
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
      const note = previousNotes.find((item) => item.id === noteId);
      if (!currentWorkspace || !note) return false;
      const previousTrash = trashRef.current;
      const deletedAt = new Date().toISOString();
      const trashItem = {
        data: { ...note, deletedAt },
        deletedAt,
        id: noteId,
        type: "note",
      };
      const noteFields = {
        content: note.content,
        pinned: note.pinned,
        title: note.title,
      };

      const timerId = noteTimersRef.current.get(noteId);
      if (timerId) window.clearTimeout(timerId);
      noteTimersRef.current.delete(noteId);
      noteBuffersRef.current.delete(noteId);
      updateBufferedWriteCount();
      commitNotes(previousNotes.filter((note) => note.id !== noteId));
      commitTrash([trashItem, ...previousTrash.filter((item) =>
        !(item.type === "note" && item.id === noteId),
      )]);

      const result = await performWrite(
        () => trashNoteRemote(supabase, currentWorkspace.id, noteId, noteFields),
        "No se pudo eliminar la nota.",
        {
          fallbackData: trashItem.data,
          offlineOperation: {
            payload: { fields: noteFields, noteId },
            type: "note.trash",
          },
        },
      );

      if (result.error) {
        commitNotes(previousNotes);
        commitTrash(previousTrash);
        return false;
      }

      setLastTrashed({
        id: crypto.randomUUID(),
        items: [{ id: noteId, type: "note" }],
        message: "Nota movida a la papelera",
      });
      return true;
    },
    [commitNotes, commitTrash, performWrite, updateBufferedWriteCount],
  );

  const restoreTrashItem = useCallback(
    async (type, itemId) => {
      const currentWorkspace = workspaceRef.current;
      const item = trashRef.current.find(
        (candidate) => candidate.type === type && candidate.id === itemId,
      );
      if (!currentWorkspace || !item) return false;

      if (
        type === "memory"
        && !albumsRef.current.some((album) => album.id === item.data.albumId)
      ) {
        setSyncError("Restaura primero el álbum al que pertenece esta foto.");
        return false;
      }

      const previousAlbums = albumsRef.current;
      const previousMemories = memoriesRef.current;
      const previousNotes = notesRef.current;
      const previousTasks = tasksRef.current;
      const previousTrash = trashRef.current;
      const restoredData = { ...item.data, deletedAt: null };

      commitTrash(previousTrash.filter((candidate) =>
        !(candidate.type === type && candidate.id === itemId),
      ));

      if (type === "task") {
        commitTasks([restoredData, ...previousTasks]);
      } else if (type === "note") {
        commitNotes([restoredData, ...previousNotes]);
      } else if (type === "memory") {
        commitMemories(
          [...previousMemories, restoredData].sort(
            (first, second) => first.sortOrder - second.sortOrder,
          ),
        );
      } else if (type === "album") {
        const activeMemories = (item.memories ?? []).filter(
          (memory) => !memory.deletedAt,
        );
        commitAlbums([restoredData, ...previousAlbums]);
        commitMemories([...previousMemories, ...activeMemories]);
      }

      const remoteOperations = {
        album: () => restoreAlbumRemote(supabase, currentWorkspace.id, itemId),
        memory: () => restoreMemoryRemote(supabase, currentWorkspace.id, itemId),
        note: () => restoreNoteRemote(supabase, currentWorkspace.id, itemId),
        task: () => restoreTaskRemote(supabase, currentWorkspace.id, itemId),
      };
      const offlineIds = {
        album: "albumId",
        memory: "memoryId",
        note: "noteId",
        task: "taskId",
      };
      const result = await performWrite(
        remoteOperations[type],
        "No se pudo restaurar el elemento.",
        {
          fallbackData: restoredData,
          offlineOperation: {
            payload: { [offlineIds[type]]: itemId },
            type: `${type}.restore`,
          },
        },
      );

      if (result.error) {
        commitAlbums(previousAlbums);
        commitMemories(previousMemories);
        commitNotes(previousNotes);
        commitTasks(previousTasks);
        commitTrash(previousTrash);
        return false;
      }

      setLastTrashed(null);
      return true;
    },
    [commitAlbums, commitMemories, commitNotes, commitTasks, commitTrash, performWrite],
  );

  const permanentlyDeleteTrashItem = useCallback(
    async (type, itemId) => {
      const currentWorkspace = workspaceRef.current;
      const item = trashRef.current.find(
        (candidate) => candidate.type === type && candidate.id === itemId,
      );
      if (!currentWorkspace || !item) return false;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setSyncError("Conéctate a internet para eliminar elementos para siempre.");
        return false;
      }

      const previousTrash = trashRef.current;
      const albumMemories = type === "album"
        ? [
            ...(item.memories ?? []),
            ...previousTrash
              .filter((candidate) =>
                candidate.type === "memory" && candidate.data?.albumId === itemId,
              )
              .map((candidate) => candidate.data),
          ]
        : [];
      const uniqueAlbumMemories = [...new Map(
        albumMemories.map((memory) => [memory.id, memory]),
      ).values()];

      commitTrash(previousTrash.filter((candidate) => {
        if (candidate.type === type && candidate.id === itemId) return false;
        if (type === "album" && candidate.type === "memory") {
          return candidate.data?.albumId !== itemId;
        }
        return true;
      }));

      let operation;
      if (type === "task") {
        operation = () => deleteTaskRemote(supabase, currentWorkspace.id, itemId);
      } else if (type === "note") {
        operation = () => deleteNoteRemote(supabase, currentWorkspace.id, itemId);
      } else if (type === "memory") {
        operation = () => deleteMemoryRemote(
          supabase,
          currentWorkspace.id,
          itemId,
          item.data.storagePath,
        );
      } else {
        operation = () => deleteAlbumRemote(
          supabase,
          currentWorkspace.id,
          itemId,
          uniqueAlbumMemories.map((memory) => memory.storagePath),
        );
      }

      const result = await performWrite(
        operation,
        "No se pudo eliminar el elemento para siempre.",
      );
      if (result.error) {
        commitTrash(previousTrash);
        return false;
      }

      const removedMemories = type === "memory" ? [item.data] : uniqueAlbumMemories;
      if (removedMemories.length > 0) {
        await removeOfflineImages(removedMemories.map((memory) => memory.id));
        removedMemories.forEach((memory) => {
          if (memory.offlineImageUrl && memory.imageUrl) {
            URL.revokeObjectURL(memory.imageUrl);
          }
        });
      }
      setLastTrashed((current) => current?.items.some(
        (candidate) => candidate.type === type && candidate.id === itemId,
      ) ? null : current);
      return true;
    },
    [commitTrash, performWrite],
  );

  const emptyTrash = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSyncError("Conéctate a internet para vaciar la papelera.");
      return false;
    }

    const snapshot = [...trashRef.current].sort((first, second) => {
      if (first.type === "album") return -1;
      if (second.type === "album") return 1;
      return 0;
    });
    for (const item of snapshot) {
      const stillExists = trashRef.current.some(
        (candidate) => candidate.type === item.type && candidate.id === item.id,
      );
      if (stillExists && !await permanentlyDeleteTrashItem(item.type, item.id)) {
        return false;
      }
    }
    return true;
  }, [permanentlyDeleteTrashItem]);

  const undoLastTrash = useCallback(async () => {
    const notice = lastTrashed;
    if (!notice) return false;
    let restored = true;
    for (const item of notice.items) {
      if (trashRef.current.some(
        (candidate) => candidate.type === item.type && candidate.id === item.id,
      )) {
        restored = await restoreTrashItem(item.type, item.id) && restored;
      }
    }
    if (restored) setLastTrashed(null);
    return restored;
  }, [lastTrashed, restoreTrashItem]);

  const dismissTrashNotice = useCallback(() => setLastTrashed(null), []);

  useEffect(() => {
    if (
      purgingTrashRef.current
      || (typeof navigator !== "undefined" && navigator.onLine === false)
    ) return;

    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const expiredItems = trash.filter(
      (item) => new Date(item.deletedAt).getTime() <= cutoff,
    );
    if (expiredItems.length === 0) return;

    purgingTrashRef.current = true;
    void (async () => {
      const orderedItems = [...expiredItems].sort((first, second) => {
        if (first.type === "album") return -1;
        if (second.type === "album") return 1;
        return 0;
      });
      for (const item of orderedItems) {
        if (trashRef.current.some(
          (candidate) => candidate.type === item.type && candidate.id === item.id,
        )) {
          await permanentlyDeleteTrashItem(item.type, item.id);
        }
      }
      purgingTrashRef.current = false;
    })();
  }, [permanentlyDeleteTrashItem, trash]);

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
    dismissTrashNotice,
    emptyTrash,
    initializationError,
    loading,
    lastTrashed,
    albums,
    memories,
    movePriority,
    notes,
    offlineMode,
    pendingSync,
    permanentlyDeleteTrashItem,
    priorities,
    quickNote,
    refresh,
    retrySync,
    retryInitialization: loadWorkspace,
    restoreTrashItem,
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
    trash,
    togglePriority,
    updateMemory,
    toggleTask,
    toggleTaskOccurrence,
    updateTask,
    updateNoteDraft,
    updateAlbum,
    updatePriorityText,
    undoLastTrash,
    workspace,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
