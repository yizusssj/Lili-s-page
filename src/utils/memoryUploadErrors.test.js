import { describe, expect, it } from "vitest";
import {
  createMemoryUploadError,
  getMemoryUploadDiagnostic,
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

  it("explica cuando el título sigue siendo obligatorio en Supabase", () => {
    const error = createMemoryUploadError(
      {
        code: "23502",
        message: "null value in column \"title\" of relation \"memories\" violates not-null constraint",
      },
      "database",
      "No se pudo guardar.",
    );

    expect(getMemoryUploadErrorMessage(error)).toMatch(/títulos opcionales/i);
    expect(isBlockingMemoryUploadError(error)).toBe(true);
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

  it("conserva la etapa y el código técnico de Storage", () => {
    const error = createMemoryUploadError(
      { message: "Unauthorized", status: 403, statusCode: "403" },
      "storage",
      "No se pudo subir.",
    );

    expect(isBlockingMemoryUploadError(error)).toBe(true);
    expect(getMemoryUploadErrorMessage(error)).toMatch(/cierra sesión/i);
    expect(getMemoryUploadDiagnostic(error)).toBe(
      "subida de archivo · 403: Unauthorized",
    );
  });
});
