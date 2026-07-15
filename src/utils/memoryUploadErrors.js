function collectErrorText(error) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase();
}

export function isBlockingMemoryUploadError(error) {
  const text = collectErrorText(error);

  return text.includes("sort_order")
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

  if (text.includes("sort_order") || text.includes("schema cache")) {
    return "Falta aplicar la actualización de Recuerdos en Supabase. Ejecuta la migración nueva y vuelve a intentarlo.";
  }

  if (text.includes("jwt") || text.includes("not authenticated")) {
    return "Tu sesión venció. Cierra y vuelve a abrir la app antes de guardar las fotos.";
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

  if (
    text.includes("failed to fetch")
    || text.includes("network")
    || text.includes("conexión")
  ) {
    return "La conexión se interrumpió mientras subíamos las fotos. Inténtalo de nuevo cuando tengas una señal estable.";
  }

  return "No pudimos guardar las fotos en Supabase. Inténtalo otra vez; si continúa, revisa la actualización de Recuerdos.";
}
