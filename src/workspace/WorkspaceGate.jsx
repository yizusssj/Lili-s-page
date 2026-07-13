import { DatabaseZap, LoaderCircle, RefreshCw } from "lucide-react";
import { useWorkspace } from "./workspaceContext.js";

function getWorkspaceErrorMessage(error) {
  if (error?.code === "WORKSPACE_NOT_FOUND") {
    return "Tu cuenta aún no pertenece a un workspace. Ejecuta bootstrap_owner.sql o add_member.sql en Supabase.";
  }

  if (
    error?.message?.includes("memory_albums") ||
    error?.message?.includes("album_id")
  ) {
    return "Falta ejecutar la migración memory_albums.sql en Supabase.";
  }

  if (
    ["42P01", "PGRST205"].includes(error?.code) ||
    error?.message?.includes("memories")
  ) {
    return "Falta ejecutar la migración memories_gallery.sql en Supabase.";
  }

  if (
    ["42703", "42883", "PGRST202", "PGRST204"].includes(error?.code) ||
    error?.message?.includes("initialize_workspace_data") ||
    error?.message?.includes("data_initialized_at")
  ) {
    return "Falta ejecutar la migración initialize_shared_data.sql en Supabase.";
  }

  if (error?.code === "WORKSPACE_DATA_INCOMPLETE") {
    return "El workspace quedó incompleto. Revisa la migración antes de continuar.";
  }

  return "No pudimos cargar tus datos compartidos. Revisa tu conexión e inténtalo otra vez.";
}

export default function WorkspaceGate({ children }) {
  const { initializationError, loading, retryInitialization } = useWorkspace();

  if (loading) {
    return (
      <main className="authShell">
        <section className="authCard authStatusCard" aria-live="polite">
          <div className="authLogo" aria-hidden="true">
            <LoaderCircle className="authSpinner" size={25} strokeWidth={1.7} />
          </div>
          <h1>Abriendo el workspace</h1>
          <p>Estamos preparando tus datos compartidos.</p>
        </section>
      </main>
    );
  }

  if (initializationError) {
    return (
      <main className="authShell">
        <section className="authCard authStatusCard" role="alert">
          <div className="authLogo" aria-hidden="true">
            <DatabaseZap size={25} strokeWidth={1.7} />
          </div>
          <h1>No pudimos abrir el workspace</h1>
          <p>{getWorkspaceErrorMessage(initializationError)}</p>
          <button type="button" className="authSubmit" onClick={retryInitialization}>
            <RefreshCw aria-hidden="true" size={17} strokeWidth={1.8} />
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return children;
}
