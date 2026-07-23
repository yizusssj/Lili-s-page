const CLOSET_BUCKET = "closet-images";
const IMAGE_URL_SECONDS = 60 * 60;

function throwIfError(error, fallbackMessage) {
  if (!error) return;
  if (!error.message) error.message = fallbackMessage;
  throw error;
}

function cleanOptionalText(value, maxLength) {
  const normalized = String(value ?? "").trim().slice(0, maxLength);
  return normalized || null;
}

export function mapClothingItem(row, image = {}) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    color: row.color,
    brand: row.brand,
    notes: row.notes ?? "",
    status: row.status,
    favorite: Boolean(row.favorite),
    lastWornOn: row.last_worn_on,
    wearCount: row.wear_count ?? 0,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageUrl: image.signedUrl ?? null,
    imageUrlExpiresAt: image.expiresAt ?? 0,
  };
}

export function mapOutfit(row, itemIds = []) {
  return {
    id: row.id,
    name: row.name,
    occasion: row.occasion,
    notes: row.notes ?? "",
    plannedFor: row.planned_for,
    wornOn: row.worn_on,
    favorite: Boolean(row.favorite),
    itemIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachImageUrls(client, rows, existingItems = []) {
  const now = Date.now();
  const existingByPath = new Map(
    existingItems
      .filter((item) =>
        item.storagePath
        && item.imageUrl
        && !item.offlineImageUrl
        && item.imageUrlExpiresAt > now + 5 * 60 * 1000)
      .map((item) => [item.storagePath, item]),
  );
  const missingRows = rows.filter((row) => !existingByPath.has(row.storage_path));
  let signedByPath = new Map();

  if (missingRows.length > 0) {
    const { data, error } = await client.storage
      .from(CLOSET_BUCKET)
      .createSignedUrls(
        missingRows.map((row) => row.storage_path),
        IMAGE_URL_SECONDS,
      );
    throwIfError(error, "No se pudieron abrir las fotografías del clóset.");
    signedByPath = new Map(
      (data ?? []).map((entry) => [entry.path, entry.signedUrl]),
    );
  }

  return rows.map((row) => {
    const existing = existingByPath.get(row.storage_path);
    if (existing) {
      return mapClothingItem(row, {
        expiresAt: existing.imageUrlExpiresAt,
        signedUrl: existing.imageUrl,
      });
    }

    const signedUrl = signedByPath.get(row.storage_path);
    return mapClothingItem(row, {
      expiresAt: signedUrl ? now + IMAGE_URL_SECONDS * 1000 : 0,
      signedUrl,
    });
  });
}

export async function fetchClosetData(client, workspaceId, existingItems = []) {
  const [itemsResult, outfitsResult, relationsResult] = await Promise.all([
    client
      .from("clothing_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("favorite", { ascending: false })
      .order("created_at", { ascending: false }),
    client
      .from("outfits")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("favorite", { ascending: false })
      .order("created_at", { ascending: false }),
    client
      .from("outfit_items")
      .select("outfit_id, clothing_item_id, position")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
  ]);

  throwIfError(itemsResult.error, "No se pudo cargar el clóset.");
  throwIfError(outfitsResult.error, "No se pudieron cargar los outfits.");
  throwIfError(relationsResult.error, "No se pudieron ordenar las prendas de los outfits.");

  const items = await attachImageUrls(client, itemsResult.data ?? [], existingItems);
  const itemIdsByOutfit = new Map();
  for (const relation of relationsResult.data ?? []) {
    const current = itemIdsByOutfit.get(relation.outfit_id) ?? [];
    current.push(relation.clothing_item_id);
    itemIdsByOutfit.set(relation.outfit_id, current);
  }

  return {
    items,
    outfits: (outfitsResult.data ?? [])
      .map((row) => mapOutfit(row, itemIdsByOutfit.get(row.id) ?? []))
      .filter((outfit) => outfit.itemIds.length > 0),
  };
}

export async function insertClothingItem(client, workspaceId, userId, item, image) {
  const uploadResult = await client.storage
    .from(CLOSET_BUCKET)
    .upload(item.storagePath, image.blob, {
      cacheControl: "3600",
      contentType: image.mimeType,
      upsert: false,
    });
  throwIfError(uploadResult.error, "No se pudo subir la fotografía de la prenda.");

  try {
    const { data, error } = await client
      .from("clothing_items")
      .upsert({
        brand: cleanOptionalText(item.brand, 80),
        category: item.category,
        color: cleanOptionalText(item.color, 40),
        created_by: userId,
        favorite: Boolean(item.favorite),
        file_size: image.blob.size,
        id: item.id,
        mime_type: image.mimeType,
        name: cleanOptionalText(item.name, 100),
        notes: String(item.notes ?? "").slice(0, 1000),
        status: item.status ?? "available",
        storage_path: item.storagePath,
        workspace_id: workspaceId,
      }, { onConflict: "id" })
      .select("*")
      .single();
    throwIfError(error, "No se pudo registrar la prenda.");

    const { data: signedData } = await client.storage
      .from(CLOSET_BUCKET)
      .createSignedUrl(item.storagePath, IMAGE_URL_SECONDS);

    return mapClothingItem(data, {
      expiresAt: signedData?.signedUrl
        ? Date.now() + IMAGE_URL_SECONDS * 1000
        : 0,
      signedUrl: signedData?.signedUrl,
    });
  } catch (error) {
    await client.storage.from(CLOSET_BUCKET).remove([item.storagePath]);
    throw error;
  }
}

export async function updateClothingItem(client, workspaceId, itemId, fields) {
  const payload = {};
  if (Object.hasOwn(fields, "name")) payload.name = cleanOptionalText(fields.name, 100);
  if (Object.hasOwn(fields, "category")) payload.category = fields.category;
  if (Object.hasOwn(fields, "color")) payload.color = cleanOptionalText(fields.color, 40);
  if (Object.hasOwn(fields, "brand")) payload.brand = cleanOptionalText(fields.brand, 80);
  if (Object.hasOwn(fields, "notes")) payload.notes = String(fields.notes ?? "").slice(0, 1000);
  if (Object.hasOwn(fields, "status")) payload.status = fields.status;
  if (Object.hasOwn(fields, "favorite")) payload.favorite = Boolean(fields.favorite);

  const { data, error } = await client
    .from("clothing_items")
    .update(payload)
    .eq("workspace_id", workspaceId)
    .eq("id", itemId)
    .select("*")
    .single();

  throwIfError(error, "No se pudo actualizar la prenda.");
  return mapClothingItem(data);
}

export async function deleteClothingItem(
  client,
  workspaceId,
  itemId,
  storagePath,
) {
  const { error } = await client
    .from("clothing_items")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", itemId);
  throwIfError(error, "No se pudo eliminar la prenda.");

  await client.storage.from(CLOSET_BUCKET).remove([storagePath]);
}

export async function saveOutfit(client, workspaceId, outfit) {
  const { error } = await client.rpc("save_outfit", {
    target_favorite: Boolean(outfit.favorite),
    target_item_ids: outfit.itemIds,
    target_name: cleanOptionalText(outfit.name, 100),
    target_notes: String(outfit.notes ?? "").slice(0, 1000),
    target_occasion: cleanOptionalText(outfit.occasion, 80),
    target_outfit_id: outfit.id,
    target_planned_for: outfit.plannedFor || null,
    target_workspace_id: workspaceId,
  });

  throwIfError(error, "No se pudo guardar el outfit.");
  return outfit;
}

export async function deleteOutfit(client, workspaceId, outfitId) {
  const { error } = await client
    .from("outfits")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", outfitId);
  throwIfError(error, "No se pudo eliminar el outfit.");
}

export async function markOutfitWorn(
  client,
  workspaceId,
  outfitId,
  wornDate,
) {
  const { error } = await client.rpc("mark_outfit_worn", {
    target_outfit_id: outfitId,
    target_workspace_id: workspaceId,
    worn_date: wornDate,
  });
  throwIfError(error, "No se pudo registrar el uso del outfit.");
}

export async function markAllClothesAvailable(client, workspaceId) {
  const { error } = await client
    .from("clothing_items")
    .update({ status: "available" })
    .eq("workspace_id", workspaceId)
    .eq("status", "laundry");
  throwIfError(error, "No se pudo actualizar la ropa limpia.");
}
