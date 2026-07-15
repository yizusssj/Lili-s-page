import { CloudAlert, CloudOff, LoaderCircle, RefreshCw, X } from "lucide-react";
import useOnlineStatus from "../pwa/useOnlineStatus.js";
import { useWorkspace } from "../workspace/workspaceContext.js";

export default function SyncStatus() {
  const {
    clearSyncError,
    offlineMode = false,
    pendingSync = 0,
    retrySync,
    saving,
    syncError,
  } = useWorkspace();
  const online = useOnlineStatus();
  const offline = offlineMode || !online;

  if (!saving && !syncError && !offline && pendingSync === 0) return null;

  let message = "Guardando en el workspace...";
  if (offline) {
    message = pendingSync > 0
      ? `${pendingSync} ${pendingSync === 1 ? "cambio guardado" : "cambios guardados"} en este dispositivo`
      : "Modo sin conexión · puedes seguir usando la app";
  } else if (pendingSync > 0) {
    message = saving
      ? `Sincronizando ${pendingSync} ${pendingSync === 1 ? "cambio" : "cambios"}...`
      : `${pendingSync} ${pendingSync === 1 ? "cambio pendiente" : "cambios pendientes"}`;
  }
  if (syncError) message = syncError;

  return (
    <div
      className={`syncStatus${syncError ? " syncStatusError" : ""}${offline ? " syncStatusOffline" : ""}`}
      role={syncError ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="syncStatusMessage">
        {syncError ? (
          <CloudAlert aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : offline ? (
          <CloudOff aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="syncSpinner"
            size={16}
            strokeWidth={1.8}
          />
        )}
        {message}
      </span>

      {(syncError || (!offline && pendingSync > 0)) && (
        <span className="syncStatusActions">
          <button type="button" onClick={() => void retrySync()}>
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
            Reintentar
          </button>
          {syncError && (
            <button type="button" onClick={clearSyncError} aria-label="Cerrar aviso">
              <X aria-hidden="true" size={15} strokeWidth={1.8} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}
