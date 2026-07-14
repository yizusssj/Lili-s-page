/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { render } from "@testing-library/react";
import { WorkspaceContext } from "../workspace/workspaceContext.js";

const DEFAULT_PRIORITIES = [
  { id: "10000000-0000-4000-8000-000000000001", position: 1, text: "Prioridad 1", done: false },
  { id: "10000000-0000-4000-8000-000000000002", position: 2, text: "Prioridad 2", done: false },
  { id: "10000000-0000-4000-8000-000000000003", position: 3, text: "Prioridad 3", done: false },
];

function WorkspaceHarness({ children, initialData }) {
  const [albums, setAlbums] = useState(initialData.albums ?? []);
  const [tasks, setTasks] = useState(initialData.tasks ?? []);
  const [notes, setNotes] = useState(initialData.notes ?? []);
  const [memories, setMemories] = useState(initialData.memories ?? []);
  const [priorities, setPriorities] = useState(
    initialData.priorities ?? DEFAULT_PRIORITIES,
  );
  const [quickNote, setQuickNote] = useState(initialData.quickNote ?? "");

  async function addTask(text) {
    setTasks((current) => [
      { id: crypto.randomUUID(), text, done: false },
      ...current,
    ]);
    return true;
  }

  async function toggleTask(taskId) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
    return true;
  }

  async function removeTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    return true;
  }

  async function createNote() {
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      title: "Nueva nota",
      content: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setNotes((current) => [note, ...current]);
    return note;
  }

  function updateNoteDraft(noteId, fields) {
    setNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? { ...note, ...fields, updatedAt: new Date().toISOString() }
          : note,
      ),
    );
  }

  function changePriorities(transform) {
    setPriorities((current) => {
      const transformed = transform([...current]);
      return transformed.map((priority, index) => ({
        ...priority,
        id: current[index].id,
        position: index + 1,
      }));
    });
  }

  const value = {
    addAlbum: async ({ description, title }) => {
      const now = new Date().toISOString();
      const album = {
        id: crypto.randomUUID(),
        title,
        description,
        coverMemoryId: null,
        createdAt: now,
        updatedAt: now,
      };
      setAlbums((current) => [album, ...current]);
      return { data: album, error: null };
    },
    addMemory: async ({ albumId, description, file, memoryDate, title }) => {
      const now = new Date().toISOString();
      const memory = {
        id: crypto.randomUUID(),
        albumId,
        title,
        description,
        memoryDate,
        storagePath: `workspace-test/${crypto.randomUUID()}.jpg`,
        mimeType: "image/jpeg",
        fileSize: file.size,
        createdAt: now,
        updatedAt: now,
        imageUrl: "https://example.test/memory.jpg",
        imageUrlExpiresAt: Date.now() + 3600000,
      };
      setMemories((current) => [memory, ...current]);
      return { data: memory, error: null };
    },
    albums,
    addTask,
    clearCompletedTasks: async () => {
      setTasks((current) => current.filter((task) => !task.done));
      return true;
    },
    clearSyncError: () => {},
    createNote,
    initializationError: null,
    loading: false,
    memories,
    movePriority: (from, to) => {
      changePriorities((current) => {
        const copy = [...current];
        const [moved] = copy.splice(from, 1);
        copy.splice(to, 0, moved);
        return copy;
      });
    },
    notes,
    priorities,
    quickNote,
    refresh: async () => true,
    removeNote: async (noteId) => {
      setNotes((current) => current.filter((note) => note.id !== noteId));
      return true;
    },
    removeMemory: async (memoryId) => {
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
      setAlbums((current) =>
        current.map((album) =>
          album.coverMemoryId === memoryId
            ? { ...album, coverMemoryId: null }
            : album,
        ),
      );
      return true;
    },
    removeAlbum: async (albumId) => {
      setMemories((current) =>
        current.filter((memory) => memory.albumId !== albumId),
      );
      setAlbums((current) => current.filter((album) => album.id !== albumId));
      return true;
    },
    removeTask,
    resetPriorities: () =>
      changePriorities((current) =>
        current.map((priority) => ({ ...priority, done: false })),
      ),
    retryInitialization: async () => {},
    retrySync: async () => true,
    saveQuickNote: async (content) => {
      setQuickNote(content);
      return true;
    },
    saving: false,
    setAlbumCover: async (albumId, memoryId) => {
      setAlbums((current) =>
        current.map((album) =>
          album.id === albumId ? { ...album, coverMemoryId: memoryId } : album,
        ),
      );
      return true;
    },
    syncError: null,
    tasks,
    togglePriority: (priorityId) =>
      changePriorities((current) =>
        current.map((priority) =>
          priority.id === priorityId
            ? { ...priority, done: !priority.done }
            : priority,
        ),
      ),
    toggleTask,
    updateNoteDraft,
    updateAlbum: async (albumId, fields) => {
      const previous = albums.find((album) => album.id === albumId);
      const updated = { ...previous, ...fields, updatedAt: new Date().toISOString() };
      setAlbums((current) =>
        current.map((album) => (album.id === albumId ? updated : album)),
      );
      return { data: updated, error: null };
    },
    updatePriorityText: (priorityId, text) =>
      changePriorities((current) =>
        current.map((priority) =>
          priority.id === priorityId ? { ...priority, text } : priority,
        ),
      ),
    workspace: { id: "workspace-test", name: "Lili's Workspace", role: "owner" },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function renderWithWorkspace(ui, initialData = {}) {
  return render(
    <WorkspaceHarness initialData={initialData}>{ui}</WorkspaceHarness>,
  );
}
