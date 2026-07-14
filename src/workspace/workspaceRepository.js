function throwIfError(error, fallbackMessage) {
  if (!error) return;

  if (!error.message) error.message = fallbackMessage;
  throw error;
}

function mapTask(row) {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNote(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPriority(row, localDate) {
  return {
    id: row.id,
    position: row.position,
    text: row.text,
    done: row.completed_on === localDate,
  };
}

function mapAlbum(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverMemoryId: row.cover_memory_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MEMORY_BUCKET = "memory-images";
const MEMORY_URL_SECONDS = 6 * 60 * 60;

function mapMemory(row, image = {}) {
  return {
    id: row.id,
    albumId: row.album_id,
    title: row.title,
    description: row.description,
    memoryDate: row.memory_date,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageUrl: image.signedUrl ?? null,
    imageUrlExpiresAt: image.expiresAt ?? 0,
  };
}

async function attachMemoryUrls(client, rows, existingMemories) {
  const now = Date.now();
  const reusable = new Map(
    existingMemories
      .filter(
        (memory) =>
          memory.imageUrl && memory.imageUrlExpiresAt > now + 5 * 60 * 1000,
      )
      .map((memory) => [
        memory.storagePath,
        { expiresAt: memory.imageUrlExpiresAt, signedUrl: memory.imageUrl },
      ]),
  );
  const pathsToSign = rows
    .map((row) => row.storage_path)
    .filter((path) => !reusable.has(path));

  if (pathsToSign.length > 0) {
    const { data, error } = await client.storage
      .from(MEMORY_BUCKET)
      .createSignedUrls(pathsToSign, MEMORY_URL_SECONDS);

    throwIfError(error, "No se pudieron abrir las fotografías privadas.");

    (data ?? []).forEach((item, index) => {
      if (!item.signedUrl) return;
      reusable.set(item.path ?? pathsToSign[index], {
        expiresAt: now + MEMORY_URL_SECONDS * 1000,
        signedUrl: item.signedUrl,
      });
    });
  }

  return rows.map((row) => mapMemory(row, reusable.get(row.storage_path)));
}

export async function findUserWorkspace(client, userId) {
  const { data: membership, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id, role, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  throwIfError(membershipError, "No se pudo consultar tu acceso al workspace.");

  if (!membership) {
    const error = new Error("Tu cuenta todavía no pertenece a ningún workspace.");
    error.code = "WORKSPACE_NOT_FOUND";
    throw error;
  }

  const { data: workspace, error: workspaceError } = await client
    .from("workspaces")
    .select("id, name, data_initialized_at")
    .eq("id", membership.workspace_id)
    .single();

  throwIfError(workspaceError, "No se pudo abrir el workspace.");

  return {
    id: workspace.id,
    initializedAt: workspace.data_initialized_at,
    name: workspace.name,
    role: membership.role,
  };
}

export async function initializeWorkspace(client, workspaceId, seed) {
  const { data, error } = await client.rpc("initialize_workspace_data", {
    local_date: seed.localDate,
    note_items: seed.notes,
    priority_items: seed.priorities,
    quick_note_content: seed.quickNote,
    target_workspace_id: workspaceId,
    task_items: seed.tasks,
  });

  throwIfError(error, "No se pudo inicializar el contenido compartido.");
  return data;
}

export async function fetchWorkspaceData(
  client,
  workspaceId,
  localDate,
  existingMemories = [],
) {
  const [
    tasksResult,
    notesResult,
    prioritiesResult,
    quickNoteResult,
    albumsResult,
    memoriesResult,
  ] = await Promise.all([
    client
      .from("tasks")
      .select("id, text, done, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    client
      .from("notes")
      .select("id, title, content, pinned, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
    client
      .from("today_priorities")
      .select("id, position, text, completed_on")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    client
      .from("quick_notes")
      .select("content")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    client
      .from("memory_albums")
      .select("id, title, description, cover_memory_id, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    client
      .from("memories")
      .select(
        "id, album_id, title, description, memory_date, storage_path, mime_type, file_size, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("memory_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  throwIfError(tasksResult.error, "No se pudieron cargar las tareas.");
  throwIfError(notesResult.error, "No se pudieron cargar las notas.");
  throwIfError(prioritiesResult.error, "No se pudieron cargar las prioridades.");
  throwIfError(quickNoteResult.error, "No se pudo cargar la nota rápida.");
  throwIfError(memoriesResult.error, "No se pudieron cargar los recuerdos.");
  throwIfError(albumsResult.error, "No se pudieron cargar los álbumes.");

  const memories = await attachMemoryUrls(
    client,
    memoriesResult.data ?? [],
    existingMemories,
  );

  return {
    albums: (albumsResult.data ?? []).map(mapAlbum),
    memories,
    notes: (notesResult.data ?? []).map(mapNote),
    priorities: (prioritiesResult.data ?? []).map((row) => mapPriority(row, localDate)),
    quickNote: quickNoteResult.data?.content ?? "",
    tasks: (tasksResult.data ?? []).map(mapTask),
  };
}

export async function insertAlbum(client, workspaceId, userId, album) {
  const { data, error } = await client
    .from("memory_albums")
    .insert({
      created_by: userId,
      description: album.description,
      id: album.id,
      title: album.title,
      workspace_id: workspaceId,
    })
    .select("id, title, description, cover_memory_id, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo crear el álbum.");
  return mapAlbum(data);
}

export async function updateAlbumCover(
  client,
  workspaceId,
  albumId,
  coverMemoryId,
) {
  const { data, error } = await client
    .from("memory_albums")
    .update({ cover_memory_id: coverMemoryId })
    .eq("workspace_id", workspaceId)
    .eq("id", albumId)
    .select("id, title, description, cover_memory_id, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo cambiar la portada del álbum.");
  return mapAlbum(data);
}

export async function updateAlbum(client, workspaceId, albumId, fields) {
  const { data, error } = await client
    .from("memory_albums")
    .update(fields)
    .eq("workspace_id", workspaceId)
    .eq("id", albumId)
    .select("id, title, description, cover_memory_id, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo actualizar el álbum.");
  return mapAlbum(data);
}

export async function deleteAlbum(
  client,
  workspaceId,
  albumId,
  storagePaths,
) {
  const rpcArguments = {
    target_album_id: albumId,
    target_workspace_id: workspaceId,
  };
  const verification = await client.rpc("delete_memory_album", {
    ...rpcArguments,
    verify_only: true,
  });
  throwIfError(
    verification.error,
    "No se pudo verificar la eliminación del álbum.",
  );

  for (let index = 0; index < storagePaths.length; index += 100) {
    const paths = storagePaths.slice(index, index + 100);
    const { error } = await client.storage.from(MEMORY_BUCKET).remove(paths);
    throwIfError(error, "No se pudieron eliminar las fotografías privadas.");
  }

  const { error } = await client.rpc("delete_memory_album", {
    ...rpcArguments,
    verify_only: false,
  });

  throwIfError(error, "No se pudo eliminar el álbum.");
}

export async function insertMemory(
  client,
  workspaceId,
  userId,
  memory,
  image,
) {
  const uploadResult = await client.storage
    .from(MEMORY_BUCKET)
    .upload(memory.storagePath, image.blob, {
      cacheControl: String(MEMORY_URL_SECONDS),
      contentType: image.mimeType,
      upsert: false,
    });

  throwIfError(uploadResult.error, "No se pudo subir la fotografía.");

  let row;
  try {
    const { data, error } = await client
      .from("memories")
      .insert({
        album_id: memory.albumId,
        created_by: userId,
        description: memory.description,
        file_size: image.blob.size,
        id: memory.id,
        memory_date: memory.memoryDate,
        mime_type: image.mimeType,
        storage_path: memory.storagePath,
        title: memory.title,
        workspace_id: workspaceId,
      })
      .select(
        "id, album_id, title, description, memory_date, storage_path, mime_type, file_size, created_at, updated_at",
      )
      .single();

    throwIfError(error, "No se pudo guardar el recuerdo.");
    row = data;
  } catch (error) {
    await client.storage.from(MEMORY_BUCKET).remove([memory.storagePath]);
    throw error;
  }

  const { data: signedData } = await client.storage
    .from(MEMORY_BUCKET)
    .createSignedUrl(memory.storagePath, MEMORY_URL_SECONDS);

  return mapMemory(row, {
    expiresAt: signedData?.signedUrl ? Date.now() + MEMORY_URL_SECONDS * 1000 : 0,
    signedUrl: signedData?.signedUrl,
  });
}

export async function deleteMemory(client, workspaceId, memoryId, storagePath) {
  const storageResult = await client.storage.from(MEMORY_BUCKET).remove([storagePath]);
  throwIfError(storageResult.error, "No se pudo eliminar la fotografía privada.");

  const { error } = await client
    .from("memories")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", memoryId);

  throwIfError(error, "No se pudo eliminar el recuerdo.");
}

export async function insertTask(client, workspaceId, userId, task) {
  const { data, error } = await client
    .from("tasks")
    .insert({
      created_by: userId,
      done: task.done,
      id: task.id,
      text: task.text,
      workspace_id: workspaceId,
    })
    .select("id, text, done, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo crear la tarea.");
  return mapTask(data);
}

export async function updateTask(client, workspaceId, taskId, fields) {
  const { data, error } = await client
    .from("tasks")
    .update(fields)
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .select("id, text, done, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo actualizar la tarea.");
  return mapTask(data);
}

export async function deleteTask(client, workspaceId, taskId) {
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", taskId);

  throwIfError(error, "No se pudo eliminar la tarea.");
}

export async function deleteCompletedTasks(client, workspaceId) {
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("done", true);

  throwIfError(error, "No se pudieron limpiar las tareas terminadas.");
}

export async function insertNote(client, workspaceId, userId, note) {
  const { data, error } = await client
    .from("notes")
    .insert({
      content: note.content,
      created_by: userId,
      id: note.id,
      pinned: note.pinned,
      title: note.title,
      workspace_id: workspaceId,
    })
    .select("id, title, content, pinned, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo crear la nota.");
  return mapNote(data);
}

export async function updateNote(client, workspaceId, noteId, fields) {
  const { data, error } = await client
    .from("notes")
    .update(fields)
    .eq("workspace_id", workspaceId)
    .eq("id", noteId)
    .select("id, title, content, pinned, created_at, updated_at")
    .single();

  throwIfError(error, "No se pudo guardar la nota.");
  return mapNote(data);
}

export async function deleteNote(client, workspaceId, noteId) {
  const { error } = await client
    .from("notes")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", noteId);

  throwIfError(error, "No se pudo eliminar la nota.");
}

export async function savePriorities(client, workspaceId, priorities, localDate) {
  const { error } = await client.rpc("save_workspace_priorities", {
    local_date: localDate,
    priority_items: priorities.map(({ done, text }) => ({ done, text })),
    target_workspace_id: workspaceId,
  });

  throwIfError(error, "No se pudieron guardar las prioridades.");
}

export async function updateQuickNote(client, workspaceId, content) {
  const { data, error } = await client
    .from("quick_notes")
    .update({ content })
    .eq("workspace_id", workspaceId)
    .select("content")
    .single();

  throwIfError(error, "No se pudo guardar la nota rápida.");
  return data.content;
}
