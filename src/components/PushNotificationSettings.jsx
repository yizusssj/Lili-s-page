import { useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, LoaderCircle, Smartphone } from "lucide-react";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushAvailability,
  syncCurrentPushSubscription,
} from "../pwa/pushNotifications.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

const AVAILABILITY_COPY = {
  insecure: "Las notificaciones necesitan una conexión segura HTTPS.",
  "install-required": "En iPhone, abre la app instalada desde tu pantalla de inicio para activarlas.",
  unconfigured: "La función está preparada; falta conectar la clave de notificaciones del proyecto.",
  unsupported: "Este dispositivo no admite notificaciones web.",
};

export default function PushNotificationSettings() {
  const { workspace } = useWorkspace();
  const availability = useMemo(() => getPushAvailability(), []);
  const [status, setStatus] = useState(() => (
    availability.available ? "checking" : availability.reason
  ));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!availability.available) return undefined;

    let active = true;
    syncCurrentPushSubscription(workspace?.id)
      .then((subscription) => {
        if (active) setStatus(subscription ? "enabled" : "disabled");
      })
      .catch(() => {
        if (active) setStatus("disabled");
      });

    return () => {
      active = false;
    };
  }, [availability, workspace?.id]);

  async function enable() {
    setStatus("enabling");
    setError("");

    try {
      await enablePushNotifications(workspace?.id);
      setStatus("enabled");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "";
      if (message === "permission-denied") {
        setStatus("denied");
      } else {
        setStatus("disabled");
        setError("No pudimos activar los avisos. Revisa la configuración e inténtalo otra vez.");
      }
    }
  }

  async function disable() {
    setStatus("disabling");
    setError("");

    try {
      await disablePushNotifications();
      setStatus("disabled");
    } catch {
      setStatus("enabled");
      setError("No pudimos desactivar los avisos en este momento.");
    }
  }

  const enabled = status === "enabled" || status === "disabling";
  const busy = status === "checking" || status === "enabling" || status === "disabling";
  const unavailableCopy = AVAILABILITY_COPY[status];

  return (
    <section className={`pushSettings${enabled ? " pushSettingsEnabled" : ""}`}>
      <span className="pushSettingsIcon" aria-hidden="true">
        {enabled ? <BellRing size={18} strokeWidth={1.8} /> : <Smartphone size={18} strokeWidth={1.8} />}
      </span>
      <div className="pushSettingsCopy">
        <strong>Avisos en el celular</strong>
        <span>
          {enabled
            ? "Activos en este dispositivo, incluso cuando la app esté cerrada."
            : unavailableCopy ?? "Recibe aquí los recordatorios que programes en tus tareas."}
        </span>
        {status === "denied" && (
          <small>El permiso está bloqueado. Actívalo desde Ajustes &gt; Notificaciones &gt; Lili.</small>
        )}
        {error && <small className="pushSettingsError">{error}</small>}
      </div>
      {availability.available && status !== "denied" && (
        <button
          type="button"
          className="pushSettingsButton"
          disabled={busy}
          onClick={() => void (enabled ? disable() : enable())}
        >
          {busy ? (
            <LoaderCircle className="pushSettingsSpinner" aria-hidden="true" size={14} />
          ) : enabled ? (
            <BellOff aria-hidden="true" size={14} strokeWidth={1.8} />
          ) : (
            <BellRing aria-hidden="true" size={14} strokeWidth={1.8} />
          )}
          {status === "enabling" || status === "checking"
            ? "Activando..."
            : status === "disabling"
              ? "Desactivando..."
              : enabled ? "Desactivar" : "Activar"}
        </button>
      )}
    </section>
  );
}
