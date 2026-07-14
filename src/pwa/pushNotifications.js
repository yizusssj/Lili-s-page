import { supabase } from "../lib/supabase.js";

export const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";

function isIosDevice() {
  const userAgent = navigator.userAgent ?? "";
  return /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

export function getPushAvailability() {
  if (!window.isSecureContext) return { available: false, reason: "insecure" };

  if (
    !("serviceWorker" in navigator)
    || !("PushManager" in window)
    || !("Notification" in window)
  ) {
    return { available: false, reason: "unsupported" };
  }

  if (isIosDevice() && !isStandaloneApp()) {
    return { available: false, reason: "install-required" };
  }

  if (!vapidPublicKey) return { available: false, reason: "unconfigured" };
  return { available: true, reason: null };
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(normalized);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function registerSubscription(subscription, workspaceId) {
  if (!supabase) throw new Error("Supabase no está configurado.");

  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;

  if (!p256dh || !auth) {
    throw new Error("El dispositivo no devolvió las claves de notificación.");
  }

  const { error } = await supabase.rpc("register_push_subscription", {
    target_auth: auth,
    target_endpoint: subscription.endpoint,
    target_p256dh: p256dh,
    target_user_agent: navigator.userAgent.slice(0, 500),
    target_workspace_id: workspaceId,
  });

  if (error) throw error;
}

export async function getCurrentPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function syncCurrentPushSubscription(workspaceId) {
  const subscription = await getCurrentPushSubscription();
  if (subscription && workspaceId) await registerSubscription(subscription, workspaceId);
  return subscription;
}

export async function enablePushNotifications(workspaceId) {
  if (!workspaceId) throw new Error("No encontramos el workspace activo.");

  const availability = getPushAvailability();
  if (!availability.available) throw new Error(availability.reason);

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") throw new Error("permission-denied");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      userVisibleOnly: true,
    });
  }

  await registerSubscription(subscription, workspaceId);
  return subscription;
}

export async function disablePushNotifications() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  if (supabase) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    if (error) throw error;
  }

  await subscription.unsubscribe();
}
