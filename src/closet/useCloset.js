import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  cacheRemoteClothingImages,
  enqueueOfflineOperation,
  getClosetSnapshot,
  hydrateOfflineClothingItems,
  putOfflineImage,
  removeOfflineImage,
  revokeOfflineMemoryUrls,
  saveClosetSnapshot,
} from "../offline/offlineDatabase.js";
import { isNetworkError } from "../offline/offlineSync.js";
import { prepareMemoryImage } from "../utils/images.js";
import { getLocalDateKey } from "../utils/date.js";
import { useWorkspace } from "../workspace/workspaceContext.js";
import {
  deleteClothingItem as deleteClothingItemRemote,
  deleteOutfit as deleteOutfitRemote,
  fetchClosetData,
  insertClothingItem,
  markAllClothesAvailable,
  markOutfitWorn as markOutfitWornRemote,
  saveOutfit as saveOutfitRemote,
  updateClothingItem as updateClothingItemRemote,
} from "./closetRepository.js";

function normalizeError(error, fallback) {
  if (error instanceof Error) return error;
  const normalized = new Error(error?.message || fallback);
  normalized.code = error?.code;
  return normalized;
}

function mergeRemoteItem(localItem, remoteItem) {
  return {
    ...localItem,
    ...remoteItem,
    imageUrl: localItem.imageUrl ?? remoteItem.imageUrl,
    imageUrlExpiresAt: localItem.imageUrl
      ? localItem.imageUrlExpiresAt
      : remoteItem.imageUrlExpiresAt,
    offlineImageUrl: Boolean(localItem.offlineImageUrl),
  };
}

export default function useCloset() {
  const { userId, workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const itemsRef = useRef([]);
  const outfitsRef = useRef([]);

  const commitItems = useCallback((nextItems) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const commitOutfits = useCallback((nextOutfits) => {
    outfitsRef.current = nextOutfits;
    setOutfits(nextOutfits);
  }, []);

  const queue = useCallback(async (type, payload) => {
    await enqueueOfflineOperation({
      payload,
      type,
      userId,
      workspaceId,
    });
    setNotice("Guardado en este dispositivo. Se sincronizará al volver internet.");
  }, [userId, workspaceId]);

  const performWrite = useCallback(async (remoteOperation, offlineOperation) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queue(offlineOperation.type, offlineOperation.payload);
      return { queued: true };
    }

    try {
      return { data: await remoteOperation(), queued: false };
    } catch (caughtError) {
      if (isNetworkError(caughtError)) {
        await queue(offlineOperation.type, offlineOperation.payload);
        return { queued: true };
      }
      throw caughtError;
    }
  }, [queue]);

  const refresh = useCallback(async () => {
    if (!workspaceId || !userId) {
      setLoading(false);
      return false;
    }
    setLoading(true);
    setError(null);
    let cached = null;

    try {
      cached = await getClosetSnapshot(userId, workspaceId);
      if (cached?.data) {
        const cachedItems = await hydrateOfflineClothingItems(cached.data.items ?? []);
        commitItems(cachedItems);
        commitOutfits(cached.data.outfits ?? []);
      }
    } catch {
      // La carga remota todavía puede abrir el clóset.
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (!cached) {
        const offlineError = new Error(
          "Abre el clóset una vez con internet para preparar su copia offline.",
        );
        offlineError.code = "CLOSET_OFFLINE_MISSING";
        setError(offlineError);
      }
      setLoading(false);
      return Boolean(cached);
    }

    try {
      const data = await fetchClosetData(supabase, workspaceId, itemsRef.current);
      revokeOfflineMemoryUrls(itemsRef.current);
      commitItems(data.items);
      commitOutfits(data.outfits);
      await saveClosetSnapshot(userId, workspaceId, data);
      void cacheRemoteClothingImages(data.items, userId, workspaceId);
      setNotice("");
      return true;
    } catch (caughtError) {
      if (!cached) {
        setError(normalizeError(caughtError, "No se pudo abrir el clóset."));
      } else if (!isNetworkError(caughtError)) {
        setNotice("Mostrando la última copia disponible del clóset.");
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [commitItems, commitOutfits, userId, workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      revokeOfflineMemoryUrls(itemsRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    if (loading || !userId || !workspaceId) return undefined;
    const timer = window.setTimeout(() => {
      void saveClosetSnapshot(userId, workspaceId, {
        items: itemsRef.current,
        outfits: outfitsRef.current,
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [items, loading, outfits, userId, workspaceId]);

  const addClothingItems = useCallback(async (files, sharedFields = {}) => {
    if (!workspaceId || !userId || files.length === 0) {
      return { added: 0, errors: [] };
    }

    setSaving(true);
    setError(null);
    setNotice("");
    let added = 0;
    const errors = [];

    for (const file of files) {
      let image;
      try {
        image = await prepareMemoryImage(file);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const item = {
          id,
          name: null,
          category: sharedFields.category ?? "other",
          color: sharedFields.color || null,
          brand: sharedFields.brand?.trim() || null,
          notes: "",
          status: "available",
          favorite: false,
          lastWornOn: null,
          wearCount: 0,
          storagePath: `${workspaceId}/${id}.jpg`,
          mimeType: image.mimeType,
          fileSize: image.blob.size,
          createdAt: now,
          updatedAt: now,
          imageUrl: URL.createObjectURL(image.blob),
          imageUrlExpiresAt: Number.POSITIVE_INFINITY,
          offlineImageUrl: true,
        };

        await putOfflineImage({
          blob: image.blob,
          memoryId: item.id,
          storagePath: item.storagePath,
          userId,
          workspaceId,
        });
        commitItems([item, ...itemsRef.current]);

        try {
          const result = await performWrite(
            () => insertClothingItem(supabase, workspaceId, userId, item, image),
            { payload: { item }, type: "clothing.insert" },
          );
          if (result.data) {
            commitItems(itemsRef.current.map((candidate) =>
              candidate.id === item.id
                ? mergeRemoteItem(candidate, result.data)
                : candidate));
          }
          added += 1;
        } catch (caughtError) {
          commitItems(itemsRef.current.filter((candidate) => candidate.id !== item.id));
          await removeOfflineImage(item.id);
          URL.revokeObjectURL(item.imageUrl);
          errors.push(normalizeError(caughtError, "No se pudo guardar una prenda."));
        }
      } catch (caughtError) {
        errors.push(normalizeError(caughtError, "No se pudo preparar una fotografía."));
      }
    }

    if (added > 0) {
      setNotice(added === 1 ? "Prenda añadida al clóset." : `${added} prendas añadidas al clóset.`);
    }
    setSaving(false);
    return { added, errors };
  }, [commitItems, performWrite, userId, workspaceId]);

  const updateClothingItem = useCallback(async (itemId, fields) => {
    const previous = itemsRef.current;
    const current = previous.find((item) => item.id === itemId);
    if (!current || !workspaceId) return false;

    const optimistic = {
      ...current,
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    commitItems(previous.map((item) => (item.id === itemId ? optimistic : item)));
    setSaving(true);
    setError(null);

    try {
      const result = await performWrite(
        () => updateClothingItemRemote(supabase, workspaceId, itemId, fields),
        { payload: { fields, itemId }, type: "clothing.update" },
      );
      if (result.data) {
        commitItems(itemsRef.current.map((item) =>
          item.id === itemId ? mergeRemoteItem(item, result.data) : item));
      }
      return true;
    } catch (caughtError) {
      commitItems(previous);
      setError(normalizeError(caughtError, "No se pudo actualizar la prenda."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [commitItems, performWrite, workspaceId]);

  const removeClothingItem = useCallback(async (itemId) => {
    const previousItems = itemsRef.current;
    const previousOutfits = outfitsRef.current;
    const item = previousItems.find((candidate) => candidate.id === itemId);
    if (!item || !workspaceId) return false;

    commitItems(previousItems.filter((candidate) => candidate.id !== itemId));
    commitOutfits(previousOutfits
      .map((outfit) => ({
        ...outfit,
        itemIds: outfit.itemIds.filter((candidateId) => candidateId !== itemId),
      }))
      .filter((outfit) => outfit.itemIds.length > 0));
    setSaving(true);

    try {
      await performWrite(
        () => deleteClothingItemRemote(
          supabase,
          workspaceId,
          itemId,
          item.storagePath,
        ),
        {
          payload: { itemId, storagePath: item.storagePath },
          type: "clothing.delete",
        },
      );
      if (typeof navigator === "undefined" || navigator.onLine !== false) {
        await removeOfflineImage(itemId);
      }
      if (item.offlineImageUrl && item.imageUrl) URL.revokeObjectURL(item.imageUrl);
      setNotice("Prenda eliminada.");
      return true;
    } catch (caughtError) {
      commitItems(previousItems);
      commitOutfits(previousOutfits);
      setError(normalizeError(caughtError, "No se pudo eliminar la prenda."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [commitItems, commitOutfits, performWrite, workspaceId]);

  const saveOutfit = useCallback(async (input) => {
    if (!workspaceId || input.itemIds.length === 0) return null;
    const now = new Date().toISOString();
    const outfit = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name?.trim() || null,
      occasion: input.occasion?.trim() || null,
      notes: input.notes?.trim() || "",
      plannedFor: input.plannedFor || null,
      wornOn: input.wornOn ?? null,
      favorite: Boolean(input.favorite),
      itemIds: [...new Set(input.itemIds)].slice(0, 8),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };
    const previous = outfitsRef.current;
    commitOutfits([
      outfit,
      ...previous.filter((candidate) => candidate.id !== outfit.id),
    ]);
    setSaving(true);

    try {
      await performWrite(
        () => saveOutfitRemote(supabase, workspaceId, outfit),
        { payload: { outfit }, type: "outfit.save" },
      );
      setNotice("Outfit guardado.");
      return outfit;
    } catch (caughtError) {
      commitOutfits(previous);
      setError(normalizeError(caughtError, "No se pudo guardar el outfit."));
      return null;
    } finally {
      setSaving(false);
    }
  }, [commitOutfits, performWrite, workspaceId]);

  const removeOutfit = useCallback(async (outfitId) => {
    const previous = outfitsRef.current;
    if (!workspaceId || !previous.some((outfit) => outfit.id === outfitId)) return false;
    commitOutfits(previous.filter((outfit) => outfit.id !== outfitId));
    setSaving(true);

    try {
      await performWrite(
        () => deleteOutfitRemote(supabase, workspaceId, outfitId),
        { payload: { outfitId }, type: "outfit.delete" },
      );
      setNotice("Outfit eliminado.");
      return true;
    } catch (caughtError) {
      commitOutfits(previous);
      setError(normalizeError(caughtError, "No se pudo eliminar el outfit."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [commitOutfits, performWrite, workspaceId]);

  const markOutfitWorn = useCallback(async (outfitId) => {
    const wornDate = getLocalDateKey();
    const previousItems = itemsRef.current;
    const previousOutfits = outfitsRef.current;
    const outfit = previousOutfits.find((candidate) => candidate.id === outfitId);
    if (!workspaceId || !outfit) return false;
    const selectedIds = new Set(outfit.itemIds);

    commitOutfits(previousOutfits.map((candidate) =>
      candidate.id === outfitId ? { ...candidate, wornOn: wornDate } : candidate));
    commitItems(previousItems.map((item) =>
      selectedIds.has(item.id)
        ? {
            ...item,
            lastWornOn: wornDate,
            wearCount: item.wearCount + 1,
          }
        : item));
    setSaving(true);

    try {
      await performWrite(
        () => markOutfitWornRemote(
          supabase,
          workspaceId,
          outfitId,
          wornDate,
        ),
        {
          payload: { outfitId, wornDate },
          type: "outfit.worn",
        },
      );
      setNotice("Uso registrado. Si algo va a lavar, márcalo cuando quieras.");
      return true;
    } catch (caughtError) {
      commitItems(previousItems);
      commitOutfits(previousOutfits);
      setError(normalizeError(caughtError, "No se pudo registrar el outfit."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [commitItems, commitOutfits, performWrite, workspaceId]);

  const markAllClean = useCallback(async () => {
    const previous = itemsRef.current;
    if (!workspaceId) return false;
    commitItems(previous.map((item) => ({ ...item, status: "available" })));
    setSaving(true);

    try {
      await performWrite(
        () => markAllClothesAvailable(supabase, workspaceId),
        { payload: {}, type: "closet.cleanAll" },
      );
      setNotice("Todo quedó marcado como limpio.");
      return true;
    } catch (caughtError) {
      commitItems(previous);
      setError(normalizeError(caughtError, "No se pudo actualizar el lavado."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [commitItems, performWrite, workspaceId]);

  return {
    addClothingItems,
    clearError: () => setError(null),
    clearNotice: () => setNotice(""),
    error,
    items,
    loading,
    markAllClean,
    markOutfitWorn,
    notice,
    outfits,
    refresh,
    removeClothingItem,
    removeOutfit,
    saveOutfit,
    saving,
    updateClothingItem,
  };
}
