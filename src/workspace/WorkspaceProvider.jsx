import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../app/config.js";
import { useAuth } from "../auth/authContext.js";
import { supabase } from "../lib/supabase.js";
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

  const performWrite = useCallback(async (operation, message) => {
    pendingWritesRef.current += 1;
    setPendingWrites(pendingWritesRef.current);
    setSyncError(null);

    try {
      return { data: await operation(), error: null };
    } catch (error) {
      setSyncError(message);
      return { data: null, error: normalizeError(error, message) };
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      setPendingWrites(pendingWritesRef.current);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!supabase || !userId) return;

    setLoading(true);
    setInitializationError(null);

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

      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      commitWorkspaceData(data);
      setSyncError(null);
    } catch (error) {
      setInitializationError(normalizeError(error, "No se pudo abrir el workspace."));
    } finally {
      setLoading(false);
    }
  }, [commitWorkspaceData, userId]);

  const refresh = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    if (!supabase || !currentWorkspace) return false;

    try {
      const data = await fetchWorkspaceData(
        supabase,
        currentWorkspace.id,
        getLocalDateKey(),
        memoriesRef.current,
      );
      commitWorkspaceData(data);
      setSyncError(null);
      return true;
    } catch {
      setSyncError("No pudimos actualizar los datos compartidos. Revisa tu conexión.");
      return false;
    }
  }, [commitWorkspaceData]);

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

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const intervalId = window.setInterval(refreshWhenVisible, 30000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  useEffect(
    () => () => {
      if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current);
      noteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      noteTimersRef.current.clear();
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

      commitTasks(
        previousTasks.map((task) =>
          task.id === taskId
            ? { ...task, ...nextFields, updatedAt: new Date().toISOString() }
            : task,
        ),
      );

      const result = await performWrite(
        () => updateTaskRemote(supabase, currentWorkspace.id, taskId, databaseFields),
        "No se pudo actualizar la tarea.",
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
      commitTasks(
        tasksRef.current.map((task) =>
          task.id === taskId ? { ...task, done: nextDone } : task,
        ),
      );

      const result = await performWrite(
        () => updateTaskRemote(supabase, currentWorkspace.id, taskId, { done: nextDone }),
        "No se pudo actualizar la tarea.",
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

      const album = {
        description: description.trim().slice(0, 500),
        id: crypto.randomUUID(),
        title: normalizedTitle,
      };
      const result = await performWrite(
        () => insertAlbum(supabase, currentWorkspace.id, userId, album),
        "No se pudo crear el álbum.",
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
      const memory = {
        albumId,
        description: description.trim().slice(0, 4000),
        id,
        memoryDate,
        storagePath: `${currentWorkspace.id}/${id}.jpg`,
        title: normalizedTitle || null,
      };

      const result = await performWrite(
        async () => {
          const image = await prepareMemoryImage(file);
          return insertMemory(
            supabase,
            currentWorkspace.id,
            userId,
            memory,
            image,
          );
        },
        "No se pudo guardar el recuerdo. Revisa la fotografía e inténtalo otra vez.",
      );

      if (result.error) return result;
      commitMemories(
        [result.data, ...memoriesRef.current].sort((a, b) =>
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

      const result = await performWrite(
        () =>
          deleteMemoryRemote(
            supabase,
            currentWorkspace.id,
            memory.id,
            memory.storagePath,
          ),
        "No se pudo eliminar el recuerdo.",
      );

      if (result.error) return false;
      commitMemories(memoriesRef.current.filter((item) => item.id !== memoryId));
      if (
        albumsRef.current.some((album) => album.coverMemoryId === memoryId)
      ) {
        commitAlbums(
          albumsRef.current.map((album) =>
            album.coverMemoryId === memoryId
              ? { ...album, coverMemoryId: null }
              : album,
          ),
        );
      }
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

      const result = await performWrite(
        () =>
          updateAlbumCoverRemote(
            supabase,
            currentWorkspace.id,
            albumId,
            memoryId,
          ),
        "No se pudo cambiar la portada del álbum.",
      );

      if (result.error) return false;
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

      const result = await performWrite(
        () =>
          updateAlbumRemote(supabase, currentWorkspace.id, albumId, {
            description: description.trim().slice(0, 500),
            title: normalizedTitle,
          }),
        "No se pudo actualizar el álbum.",
      );

      if (result.error) return result;
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
      const result = await performWrite(
        () =>
          deleteAlbumRemote(
            supabase,
            currentWorkspace.id,
            albumId,
            albumMemories.map((memory) => memory.storagePath),
          ),
        "No se pudo eliminar el álbum.",
      );

      if (result.error) return false;
      commitMemories(
        memoriesRef.current.filter((memory) => memory.albumId !== albumId),
      );
      commitAlbums(albumsRef.current.filter((item) => item.id !== albumId));
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

      const result = await performWrite(
        () => updateNoteRemote(supabase, currentWorkspace.id, noteId, fields),
        "No se pudo guardar la nota. Tus cambios siguen visibles para que puedas reintentarlo.",
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
      const result = await performWrite(
        () => updateQuickNote(supabase, currentWorkspace.id, normalizedContent),
        "No se pudo guardar la nota rápida.",
      );

      if (result.error) return false;
      commitQuickNote(result.data);
      return true;
    },
    [commitQuickNote, performWrite],
  );

  const retrySync = useCallback(async () => {
    const pendingNoteIds = [...noteBuffersRef.current.keys()];
    const operations = pendingNoteIds.map((noteId) => flushNoteUpdate(noteId));

    if (priorityNeedsRetryRef.current) {
      operations.push(flushPriorities(prioritiesRef.current));
    }

    if (operations.length === 0) return refresh();
    await Promise.all(operations);
    return true;
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
    saving: pendingWrites > 0 || bufferedWrites > 0,
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
