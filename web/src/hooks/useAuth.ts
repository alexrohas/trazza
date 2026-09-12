import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseClient } from "../lib/supabase";
import { useT } from "../lib/i18n/context";
import { safeLocalGet, safeLocalRemove, safeLocalSet } from "../lib/storage";
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

// Version del texto legal vigente. Se guarda junto a terms_accepted_at en la metadata
// del usuario para dejar constancia de que copia acepto; debe coincidir con la que
// registra el alta por email (signUp, mas abajo).
const TERMS_VERSION = "2026-08-06";

// Marca que deja signInWithGoogle justo antes de irse a Google. Al volver ya autenticado
// no hay checkbox que consultar (el texto legal viaja junto al boton), asi que el
// consentimiento se anota a partir de esta marca. Se consume una sola vez.
const PENDING_TERMS_KEY = "trazza:pending-google-terms";

// Si GoTrue no puede completar el login por redirect (el caso mas comun: redirect_to no
// esta en la lista blanca de Supabase), no lanza una excepcion visible: deja el error en
// el hash de la URL (#error=...&error_description=...) y sigue con normalidad. El propio
// cliente de supabase-js lo detecta en _initialize(), pero getSession() hace
// `await this.initializePromise` y descarta el {error} con el que resolvio -es como
// esta escrita la libreria, no un descuido nuestro-, asi que sin esto la app vuelve a
// "anonymous" sin decir por que y parece que el boton de Google "no hace nada".
// A diferencia del camino de exito (que si limpia el hash), GoTrue no toca el hash en el
// camino de error, asi que sigue ahi para que lo leamos nosotros.
function readOAuthHashError(): string | null {
  if (typeof window === "undefined" || !window.location.hash) return null;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const description = params.get("error_description");
  const error = params.get("error");
  if (!error && !description) return null;

  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url.toString());

  return description || "No se pudo completar el acceso con Google.";
}

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

    const oauthError = readOAuthHashError();
    if (oauthError) {
      setStatus("anonymous");
      setMessage({ type: "error", text: oauthError });
    }

    let active = true;

    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStatus("anonymous");
        setMessage({ type: "error", text: getAuthErrorMessage(error) });
        return;
      }
      // Si ya se mostro el error de arriba, un getSession() sin sesion (y sin error
      // propio) no debe pisarlo con "anonymous" otra vez -mismo estado, pero sin
      // machacar el mensaje que se acaba de poner.
      if (oauthError && !data.session) return;
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

  // Vuelca la aceptacion de terminos tras entrar con Google. En cuanto hay sesion, si
  // quedo la marca de PENDING_TERMS_KEY y el usuario aun no tiene terms_accepted_at, se
  // escribe en su metadata. La marca se consume siempre —haya escritura o no— para no
  // reintentar en cada render ni pisar el sello de un usuario que ya lo tenia.
  useEffect(() => {
    if (status !== "authenticated" || !user || !supabaseClient) return;

    const pending = safeLocalGet(PENDING_TERMS_KEY);
    if (!pending) return;
    safeLocalRemove(PENDING_TERMS_KEY);

    if (user.user_metadata?.terms_accepted_at) return;

    let parsed: { at?: unknown; version?: unknown };
    try {
      parsed = JSON.parse(pending);
    } catch {
      return;
    }
    if (typeof parsed.at !== "string") return;

    void supabaseClient.auth
      .updateUser({
        data: {
          ...(user.user_metadata || {}),
          terms_accepted_at: parsed.at,
          terms_version: typeof parsed.version === "string" ? parsed.version : TERMS_VERSION,
        },
      })
      .catch(() => undefined);
  }, [status, user]);

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
            // Registro de aceptacion de terminos: el checkbox es obligatorio en el
            // formulario, aqui se deja constancia de cuando y de que version.
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
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

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseClient) return;
    setBusy(true);
    setMessage({ type: "info", text: "Abriendo Google..." });

    safeLocalSet(
      PENDING_TERMS_KEY,
      JSON.stringify({ at: new Date().toISOString(), version: TERMS_VERSION }),
    );

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Mismo criterio que emailRedirectTo en signUp: se vuelve a la misma pagina
        // (/app en produccion, /app/ en el dev server). Tiene que estar en la lista de
        // Redirect URLs de Supabase o el proveedor cae al Site URL por defecto.
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });

    // Sin error, el navegador ya se esta yendo a Google y este arbol se desmonta; solo
    // se sigue por aqui si fallo antes de redirigir.
    if (error) {
      safeLocalRemove(PENDING_TERMS_KEY);
      setBusy(false);
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
    }
  }, []);

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

  const deleteAccount = useCallback(async () => {
    if (!supabaseClient || !user) return false;
    setBusy(true);
    setMessage({ type: "info", text: "Eliminando cuenta..." });

    try {
      const { error } = await supabaseClient.functions.invoke("delete-account");
      if (error) throw error;
    } catch (caught) {
      setBusy(false);
      setMessage({
        type: "error",
        text: caught instanceof Error ? caught.message : "No se pudo eliminar la cuenta.",
      });
      return false;
    }

    // La cuenta ya no existe en el servidor, asi que el signOut fallara con
    // "user_not_found". Es esperado: se ignora y se limpia el estado local a mano.
    await supabaseClient.auth.signOut().catch(() => undefined);
    setBusy(false);
    setStatus("anonymous");
    setSession(null);
    setUser(null);
    setMessage({ type: "success", text: "Tu cuenta ha sido eliminada." });
    return true;
  }, [user]);

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
    deleteAccount,
    message,
    profile,
    recoveryMode,
    resetPassword,
    session,
    signIn,
    signInWithGoogle,
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
  if (normalized.includes("provider is not enabled") || normalized.includes("unsupported provider")) {
    return "El acceso con Google no esta disponible ahora mismo.";
  }
  if (normalized.includes("signup")) return "El registro no esta habilitado en Supabase.";
  if (normalized.includes("rate limit")) return "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
  return message || "No se pudo completar el acceso.";
}
