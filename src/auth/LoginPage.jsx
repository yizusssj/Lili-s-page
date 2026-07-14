import { useState } from "react";
import { Eye, EyeOff, Heart, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "./authContext.js";

function getLoginErrorMessage(error) {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "El correo o la contraseña no son correctos.";
  }

  if (message.includes("email not confirmed")) {
    return "Primero confirma el correo desde el mensaje de Supabase.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Hubo demasiados intentos. Espera un momento y vuelve a probar.";
  }

  return "No se pudo iniciar sesión. Revisa tu conexión e inténtalo nuevamente.";
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    const { error } = await signIn({ email, password });

    if (error) setErrorMessage(getLoginErrorMessage(error));
    setSubmitting(false);
  }

  return (
    <main className="authShell">
      <section className="authCard" aria-labelledby="login-title">
        <div className="authBrand">
          <div className="authLogo" aria-hidden="true">
            <Heart size={25} strokeWidth={1.7} />
          </div>
          <div>
            <div className="authEyebrow">Lili&apos;s workspace</div>
            <h1 id="login-title">Bienvenida de nuevo</h1>
          </div>
        </div>

        <p className="authIntro">Un espacio privado para organizar tus días y guardar tus cosas bonitas.</p>

        <form className="authForm" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Correo</label>
          <div className="authField">
            <Mail aria-hidden="true" size={18} strokeWidth={1.7} />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="login-password">Contraseña</label>
          <div className="authField">
            <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.7} />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              minLength={6}
              required
              aria-describedby={errorMessage ? "login-error" : undefined}
            />
            <button
              type="button"
              className="authPasswordToggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" size={17} strokeWidth={1.7} />
              ) : (
                <Eye aria-hidden="true" size={17} strokeWidth={1.7} />
              )}
            </button>
          </div>

          {errorMessage && (
            <div id="login-error" className="authError" role="alert">
              {errorMessage}
            </div>
          )}

          <button type="submit" className="authSubmit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="authPrivacy">
          <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.7} />
          <span>
            <strong>Sesión guardada en este dispositivo</strong>
            <small>Solo tendrás que entrar de nuevo si cierras la sesión.</small>
          </span>
        </div>
      </section>
    </main>
  );
}
