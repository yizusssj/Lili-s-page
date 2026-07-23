import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { clearOfflineDataForUser } from "../offline/offlineDatabase.js";
import { AuthContext } from "./authContext.js";

const OFFLINE_USER_KEY = "lili:offline-user-v1";

function readOfflineUser() {
  try {
    const user = JSON.parse(window.localStorage.getItem(OFFLINE_USER_KEY));
    return typeof user?.id === "string" ? user : null;
  } catch {
    return null;
  }
}

function rememberUser(user) {
  if (!user?.id) return;
  window.localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify({
    email: user.email ?? null,
    id: user.id,
  }));
}

function offlineSession() {
  if (navigator.onLine !== false) return null;
  const user = readOfflineUser();
  return user ? { offline: true, user } : null;
}

function normalizeError(error) {
  return error instanceof Error ? error : new Error("No se pudo completar la autenticación.");
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [initializationError, setInitializationError] = useState(null);

  useEffect(() => {
    if (!supabase) return undefined;

    let isActive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) return;
      if (nextSession?.user) rememberUser(nextSession.user);
      setSession(nextSession ?? offlineSession());
      setInitializationError(null);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) return;
        const fallbackSession = offlineSession();
        if (data.session?.user) rememberUser(data.session.user);
        if (error && !fallbackSession) setInitializationError(error);
        else setSession(data.session ?? fallbackSession);
        setLoading(false);
      })
      .catch((error) => {
        if (!isActive) return;
        const fallbackSession = offlineSession();
        if (fallbackSession) setSession(fallbackSession);
        else setInitializationError(normalizeError(error));
        setLoading(false);
      });

    const restoreSessionOnline = () => {
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!isActive) return;
          if (error) {
            setInitializationError(error);
            return;
          }
          if (data.session?.user) rememberUser(data.session.user);
          setSession(data.session);
          setInitializationError(null);
        })
        .catch((error) => {
          if (isActive) setInitializationError(normalizeError(error));
        });
    };
    window.addEventListener("online", restoreSessionOnline);

    return () => {
      isActive = false;
      window.removeEventListener("online", restoreSessionOnline);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) return { error: new Error("Supabase no está configurado.") };

    try {
      return await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    } catch (error) {
      return { error: normalizeError(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return { error: new Error("Supabase no está configurado.") };

    const userId = session?.user?.id;
    window.localStorage.removeItem(OFFLINE_USER_KEY);

    let result;
    try {
      result = await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      result = { error: normalizeError(error) };
    }

    await clearOfflineDataForUser(userId);
    setSession(null);
    return result;
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      initializationError,
      loading,
      session,
      signIn,
      signOut,
      user: session?.user ?? null,
    }),
    [initializationError, loading, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
