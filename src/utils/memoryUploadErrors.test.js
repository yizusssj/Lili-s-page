import { describe, expect, it } from "vitest";
import {
  getMemoryUploadErrorMessage,
  isBlockingMemoryUploadError,
} from "./memoryUploadErrors.js";

describe("errores al subir recuerdos", () => {
  it("explica cuando falta la migración del orden", () => {
    const error = {
      code: "PGRST204",
      message: "Could not find the 'sort_order' column of 'memories' in the schema cache",
    };

    expect(isBlockingMemoryUploadError(error)).toBe(true);
    expect(getMemoryUploadErrorMessage(error)).toMatch(/actualización de Recuerdos/i);
  });

  it("distingue una fotografía que el navegador no puede preparar", () => {
    const error = new Error("Este navegador no pudo leer la fotografía seleccionada.");

    expect(isBlockingMemoryUploadError(error)).toBe(false);
    expect(getMemoryUploadErrorMessage(error)).toBe(error.message);
  });

  it("da una salida útil para fallos desconocidos", () => {
    expect(getMemoryUploadErrorMessage(new Error("Unexpected failure")))
      .toMatch(/Supabase/);
  });
});
