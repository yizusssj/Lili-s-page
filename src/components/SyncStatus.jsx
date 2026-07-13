import { CloudAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useWorkspace } from "../workspace/workspaceContext.js";

export default function SyncStatus() {
  const { clearSyncError, retrySync, saving, syncError } = useWorkspace();

  if (!saving && !syncError) return null;

  return (
    <div
      className={`syncStatus${syncError ? " syncStatusError" : ""}`}
      role={syncError ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="syncStatusMessage">
        {syncError ? (
          <CloudAlert aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="syncSpinner"
            size={16}
            strokeWidth={1.8}
          />
        )}
        {syncError ?? "Guardando en el workspace..."}
      </span>

      {syncError && (
        <span className="syncStatusActions">
          <button type="button" onClick={() => void retrySync()}>
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
            Reintentar
          </button>
          <button type="button" onClick={clearSyncError} aria-label="Cerrar aviso">
            <X aria-hidden="true" size={15} strokeWidth={1.8} />
          </button>
        </span>
      )}
    </div>
  );
}
