import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseClient } from "../lib/supabase";
import { useT } from "../lib/i18n/context";
import type { Currency, UserProfile, UserProfileInput } from "../types";

type AuthStatus = "checking" | "authenticated" | "anonymous" | "unconfigured";

type AuthMessage = {
  type: "info" | "success" | "error";
  text: string;
};

type Credentials = {
  fullName?: string;
  email: string;
  password: string;
};

const supportedCurrencies = new Set<Currency>(["EUR", "USD"]);

export function useAuth() {
  const t = useT();
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? "checking" : "unconfigured");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const resolveSession = useCallback(async (nextSession: Session | null) => {
    if (!supabaseClient) {
      setStatus("unconfigured");
      setSession(null);
      setUser(null);
      return;
    }

    if (!nextSession?.user) {
      setStatus("anonymous");
      setSession(null);
      setUser(null);
      return;
    }

    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) {
      setStatus("anonymous");
      setSession(null);
      setUser(null);
      setMessage({ type: "error", text: "No se pudo comprobar la sesion. Vuelve a entrar." });
      return;
    }

    if (!isAuthEmailConfirmed(data.user)) {
      await supabaseClient.auth.signOut();
      setStatus("anonymous");
      setSession(null);
      setUser(null);
      setMessage({ type: "error", text: "Confirma tu email antes de entrar. Revisa tu bandeja de entrada." });
      return;
    }

    setStatus("authenticated");
    setSession({ ...nextSession, user: data.user });
    setUser(data.user);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!supabaseClient) {
      setStatus("unconfigured");
      return undefined;
    }

    let active = true;

    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStatus("anonymous");
        setMessage({ type: "error", text: getAuthErrorMessage(error) });
        return;
      }
      void resolveSession(data.session);
    });

    const { data: listener } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setSession(nextSession);
        return;
      }
      void resolveSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [resolveSession]);

  const profile = useMemo(() => (user ? toUserProfile(user, t) : null), [t, user]);

  const signIn = useCallback(
    async ({ email, password }: Credentials) => {
      if (!supabaseClient) return;
      setBusy(true);
      setMessage({ type: "info", text: "Entrando..." });

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      setBusy(false);

      if (error) {
        setMessage({ type: "error", text: getAuthErrorMessage(error) });
        return;
      }

      await resolveSession(data.session);
    },
    [resolveSession],
  );

  const signUp = useCallback(
    async ({ fullName, email, password }: Credentials) => {
      if (!supabaseClient) return;
      setBusy(true);
      setMessage({ type: "info", text: "Creando cuenta..." });

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || "",
            name: fullName || "",
          },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      setBusy(false);

      if (error) {
        setMessage({ type: "error", text: getAuthErrorMessage(error) });
        return;
      }

      if (data.session) {
        await resolveSession(data.session);
        return;
      }

      setMessage({ type: "success", text: "Cuenta creada. Revisa tu email para confirmar el acceso." });
      setStatus("anonymous");
    },
    [resolveSession],
  );

  const signOut = useCallback(async () => {
    if (!supabaseClient) return;
    setBusy(true);
    const { error } = await supabaseClient.auth.signOut();
    setBusy(false);

    if (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
      return;
    }

    setStatus("anonymous");
    setSession(null);
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabaseClient) return false;
    setBusy(true);
    setMessage({ type: "info", text: "Enviando email..." });

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    setBusy(false);

    if (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
      return false;
    }

    setMessage({ type: "success", text: "Si el email existe, te hemos enviado un enlace para restablecer la contrasena." });
    return true;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabaseClient) return false;
    setBusy(true);
    setMessage({ type: "info", text: "Guardando contrasena..." });

    const { error } = await supabaseClient.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
      return false;
    }

    await resolveSession(session);
    setRecoveryMode(false);
    setMessage({ type: "success", text: "Contrasena actualizada. Ya puedes seguir usando Trazza." });
    return true;
  }, [resolveSession, session]);

  const updateProfile = useCallback(async (input: UserProfileInput) => {
    if (!supabaseClient || !user) return false;

    setBusy(true);
    setMessage({ type: "info", text: "Guardando perfil..." });

    const metadata = user.user_metadata || {};
    const updates: Parameters<typeof supabaseClient.auth.updateUser>[0] = {
      data: {
        ...metadata,
        full_name: input.displayName.trim(),
        name: input.displayName.trim(),
        currency: input.currency,
      },
    };

    if (input.email.trim() && input.email.trim() !== user.email) {
      updates.email = input.email.trim();
    }

    const { data, error } = await supabaseClient.auth.updateUser(updates);
    setBusy(false);

    if (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
      return false;
    }

    if (data.user) {
      setUser(data.user);
      setSession((current) => (current ? { ...current, user: data.user } : current));
    }
    setMessage({ type: "success", text: "Perfil actualizado." });
    return true;
  }, [user]);

  return {
    busy,
    message,
    profile,
    recoveryMode,
    resetPassword,
    session,
    signIn,
    signOut,
    signUp,
    status,
    updatePassword,
    updateProfile,
    user,
  };
}

function isAuthEmailConfirmed(user: User) {
  const legacyUser = user as User & { email_verified?: boolean };
  return Boolean(user.email_confirmed_at || user.confirmed_at || legacyUser.email_verified || user.user_metadata?.email_verified);
}

function toUserProfile(user: User, t: ReturnType<typeof useT>): UserProfile {
  const metadata = user.user_metadata || {};
  const displayName = String(metadata.full_name || metadata.name || user.email || t("appShell.sidebar.defaultUser")).trim();
  const currency = normalizeCurrency(metadata.currency || metadata.preferred_currency);

  return {
    id: user.id,
    email: user.email || t("auth.noEmail"),
    displayName,
    currency,
  };
}

function normalizeCurrency(value: unknown): Currency {
  const currency = String(value || "").trim().toUpperCase() as Currency;
  return supportedCurrencies.has(currency) ? currency : "EUR";
}

function getAuthErrorMessage(error: { message?: string }) {
  const message = String(error.message || "").trim();
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Email o contrasena incorrectos.";
  if (normalized.includes("email not confirmed")) return "Confirma tu email antes de entrar.";
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Ya existe una cuenta con este email. Entra con tu contrasena.";
  }
  if (normalized.includes("signup")) return "El registro no esta habilitado en Supabase.";
  if (normalized.includes("rate limit")) return "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
  return message || "No se pudo completar el acceso.";
}
