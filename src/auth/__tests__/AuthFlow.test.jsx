import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGate from "../AuthGate.jsx";
import AuthProvider from "../AuthProvider.jsx";
import { useAuth } from "../authContext.js";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../../lib/supabase.js", () => ({
  isSupabaseConfigured: true,
  supabase: { auth: authMock },
}));

function PrivateContent() {
  const { signOut, user } = useAuth();

  return (
    <div>
      <span>Sesión de {user.email}</span>
      <button type="button" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </div>
  );
}

function renderAuthFlow() {
  return render(
    <AuthProvider>
      <AuthGate>
        <PrivateContent />
      </AuthGate>
    </AuthProvider>,
  );
}

describe("Acceso privado", () => {
  let authChange;

  beforeEach(() => {
    authChange = undefined;
    Object.values(authMock).forEach((mock) => mock.mockReset());
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.onAuthStateChange.mockImplementation((callback) => {
      authChange = callback;
      return { data: { subscription: { unsubscribe: authMock.unsubscribe } } };
    });
    authMock.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    authMock.signOut.mockResolvedValue({ error: null });
  });

  it("inicia sesión con correo y contraseña y muestra el área privada", async () => {
    const user = userEvent.setup();
    renderAuthFlow();

    expect(
      await screen.findByRole("heading", { name: "Bienvenida de nuevo" }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Correo" }), "lili@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "una-clave-segura");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(authMock.signInWithPassword).toHaveBeenCalledWith({
      email: "lili@example.com",
      password: "una-clave-segura",
    });

    act(() => {
      authChange("SIGNED_IN", {
        user: { id: "user-1", email: "lili@example.com" },
      });
    });

    expect(await screen.findByText("Sesión de lili@example.com")).toBeInTheDocument();
  });

  it("traduce credenciales inválidas y permite cerrar una sesión existente", async () => {
    const user = userEvent.setup();
    authMock.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error("Invalid login credentials"),
    });

    const view = renderAuthFlow();
    await screen.findByRole("heading", { name: "Bienvenida de nuevo" });
    await user.type(screen.getByRole("textbox", { name: "Correo" }), "lili@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave-incorrecta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El correo o la contraseña no son correctos.",
    );

    view.unmount();
    authMock.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1", email: "lili@example.com" } } },
      error: null,
    });

    renderAuthFlow();
    await waitFor(() => expect(screen.getByText("Sesión de lili@example.com")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(authMock.signOut).toHaveBeenCalledOnce();
  });
});
