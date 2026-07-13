const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2400;
const ACCEPTED_INPUT_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateMemoryImage(file) {
  if (!file) throw new Error("Selecciona una fotografía.");
  if (!ACCEPTED_INPUT_TYPES.has(file.type)) {
    throw new Error("Usa una imagen JPG, PNG, WebP o HEIC.");
  }
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error("La fotografía original debe pesar menos de 20 MB.");
  }
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Algunos navegadores solo decodifican HEIC mediante un elemento img.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    if (typeof image.decode === "function") {
      image.src = objectUrl;
      await image.decode();
    } else {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = objectUrl;
      });
    }
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Este navegador no pudo leer la fotografía seleccionada.");
  }

  return {
    height: image.naturalHeight,
    source: image,
    width: image.naturalWidth,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No pudimos preparar la fotografía."));
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function prepareMemoryImage(file) {
  validateMemoryImage(file);
  const image = await loadImageSource(file);

  try {
    if (!image.width || !image.height) {
      throw new Error("La fotografía no tiene dimensiones válidas.");
    }

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Tu navegador no puede procesar esta fotografía.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 0.86);
    if (blob.size > MAX_OUTPUT_BYTES) blob = await canvasToBlob(canvas, 0.72);
    if (blob.size > MAX_OUTPUT_BYTES) {
      throw new Error("La fotografía sigue siendo demasiado pesada después de optimizarla.");
    }

    return { blob, height, mimeType: "image/jpeg", width };
  } finally {
    image.cleanup();
  }
}
