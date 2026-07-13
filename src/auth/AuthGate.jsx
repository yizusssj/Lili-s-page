import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "./authContext.js";
import LoginPage from "./LoginPage.jsx";

function AuthStatus({ icon: Icon, title, message, loading = false }) {
  return (
    <main className="authShell">
      <section className="authCard authStatusCard" aria-live="polite">
        <div className="authLogo" aria-hidden="true">
          <Icon className={loading ? "authSpinner" : undefined} size={25} strokeWidth={1.7} />
        </div>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export default function AuthGate({ children }) {
  const { configured, initializationError, loading, session } = useAuth();

  if (!configured) {
    return (
      <AuthStatus
        icon={ShieldAlert}
        title="Falta conectar Supabase"
        message="Revisa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local."
      />
    );
  }

  if (loading) {
    return (
      <AuthStatus
        icon={LoaderCircle}
        title="Preparando tu espacio"
        message="Estamos recuperando tu sesión de forma segura."
        loading
      />
    );
  }

  if (initializationError && !session) {
    return (
      <AuthStatus
        icon={ShieldAlert}
        title="No pudimos comprobar la sesión"
        message="Actualiza la página para intentarlo otra vez."
      />
    );
  }

  if (!session) return <LoginPage />;

  return children;
}
