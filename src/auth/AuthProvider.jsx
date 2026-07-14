import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { AuthContext } from "./authContext.js";

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
      setSession(nextSession);
      setInitializationError(null);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) return;
        if (error) setInitializationError(error);
        else setSession(data.session);
        setLoading(false);
      })
      .catch((error) => {
        if (!isActive) return;
        setInitializationError(normalizeError(error));
        setLoading(false);
      });

    return () => {
      isActive = false;
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

    try {
      return await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      return { error: normalizeError(error) };
    }
  }, []);

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
