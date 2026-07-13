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

export async function fetchWorkspaceData(client, workspaceId, localDate) {
  const [tasksResult, notesResult, prioritiesResult, quickNoteResult] = await Promise.all([
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
  ]);

  throwIfError(tasksResult.error, "No se pudieron cargar las tareas.");
  throwIfError(notesResult.error, "No se pudieron cargar las notas.");
  throwIfError(prioritiesResult.error, "No se pudieron cargar las prioridades.");
  throwIfError(quickNoteResult.error, "No se pudo cargar la nota rápida.");

  return {
    notes: (notesResult.data ?? []).map(mapNote),
    priorities: (prioritiesResult.data ?? []).map((row) => mapPriority(row, localDate)),
    quickNote: quickNoteResult.data?.content ?? "",
    tasks: (tasksResult.data ?? []).map(mapTask),
  };
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
