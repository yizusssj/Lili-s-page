function collectErrorText(error) {
  return [
    error?.code,
    error?.status,
    error?.statusCode,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase();
}

const MEMORY_STAGE_LABELS = {
  cache: "almacenamiento del teléfono",
  database: "base de datos",
  prepare: "preparación de imagen",
  storage: "subida de archivo",
};

export function createMemoryUploadError(error, stage, fallbackMessage) {
  const source = error && typeof error === "object" ? error : {};
  const normalized = new Error(
    typeof source.message === "string" && source.message.trim()
      ? source.message
      : fallbackMessage,
  );

  normalized.memoryStage = stage;
  for (const field of ["code", "details", "hint", "status", "statusCode"]) {
    if (source[field] !== undefined) normalized[field] = source[field];
  }

  return normalized;
}

export function getMemoryUploadDiagnostic(error) {
  const stage = MEMORY_STAGE_LABELS[error?.memoryStage] ?? "proceso de subida";
  const code = error?.statusCode ?? error?.code ?? error?.status;
  const rawMessage = typeof error?.message === "string"
    ? error.message.replace(/\s+/g, " ").trim().slice(0, 180)
    : "Error sin detalle";

  return `${stage}${code ? ` · ${code}` : ""}: ${rawMessage}`;
}

export function isBlockingMemoryUploadError(error) {
  const text = collectErrorText(error);

  return error?.memoryStage === "database"
    || error?.memoryStage === "storage"
    || text.includes("sort_order")
    || text.includes("schema cache")
    || text.includes("row-level security")
    || text.includes("permission denied")
    || text.includes("jwt")
    || text.includes("not authenticated")
    || text.includes("bucket not found")
    || text.includes("memory-images");
}

export function getMemoryUploadErrorMessage(error) {
  const text = collectErrorText(error);

  if (
    text.includes("23502")
    && text.includes("title")
    && text.includes("memories")
  ) {
    return "Falta habilitar los títulos opcionales de Recuerdos en Supabase. Ejecuta la migración de reparación y vuelve a intentarlo.";
  }

  if (text.includes("sort_order") || text.includes("schema cache")) {
    return "Falta aplicar la actualización de Recuerdos en Supabase. Ejecuta la migración nueva y vuelve a intentarlo.";
  }

  if (text.includes("jwt") || text.includes("not authenticated")) {
    return "Tu sesión venció. Cierra y vuelve a abrir la app antes de guardar las fotos.";
  }

  if (
    text.includes("unauthorized")
    || error?.status === 401
    || error?.status === 403
    || error?.statusCode === "401"
    || error?.statusCode === "403"
  ) {
    return "Supabase rechazó el acceso a las fotos. Cierra sesión, vuelve a entrar e inténtalo otra vez.";
  }

  if (text.includes("row-level security") || text.includes("permission denied")) {
    return "Tu usuario no tiene permiso para guardar en este álbum. Revisa el acceso al workspace.";
  }

  if (text.includes("bucket not found") || text.includes("memory-images")) {
    return "Falta configurar el almacenamiento de Recuerdos en Supabase.";
  }

  if (
    text.includes("quotaexceeded")
    || text.includes("quota exceeded")
    || text.includes("almacenamiento local")
  ) {
    return "El teléfono no tiene espacio disponible para preparar las fotos. Libera un poco de almacenamiento e inténtalo otra vez.";
  }

  if (text.includes("payload too large") || text.includes("413")) {
    return "Una de las fotos quedó demasiado pesada para subirla. Prueba con una versión más pequeña.";
  }

  if (
    text.includes("no pudo leer la fotografía")
    || text.includes("no pudimos preparar la fotografía")
    || text.includes("no se pudo preparar la foto")
    || text.includes("no tiene dimensiones válidas")
    || text.includes("no puede procesar esta fotografía")
  ) {
    return error.message;
  }

  if (error?.memoryStage === "prepare") {
    return "El iPhone no pudo convertir una de las fotos. Prueba primero con esa foto sola o compártela como JPG.";
  }

  if (error?.memoryStage === "cache") {
    return "El teléfono no pudo conservar la foto para usarla sin internet. Revisa el espacio disponible e inténtalo otra vez.";
  }

  if (
    text.includes("failed to fetch")
    || text.includes("network")
    || text.includes("conexión")
  ) {
    return "La conexión se interrumpió mientras subíamos las fotos. Inténtalo de nuevo cuando tengas una señal estable.";
  }

  if (error?.memoryStage === "storage") {
    return "Supabase Storage rechazó la fotografía. Abre el detalle del error para ver la causa exacta.";
  }

  if (error?.memoryStage === "database") {
    return "La foto llegó al almacenamiento, pero Supabase no pudo registrar el recuerdo. Abre el detalle del error.";
  }

  return "No pudimos guardar las fotos en Supabase. Inténtalo otra vez; si continúa, revisa la actualización de Recuerdos.";
}
