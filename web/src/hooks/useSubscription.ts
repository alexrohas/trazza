import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseClient } from "../lib/supabase";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "lifetime";

export type BillingInterval = "monthly" | "annual";

export type Subscription = {
  userId: string;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  priceId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

type SubscriptionRow = {
  user_id: string;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Estado de suscripcion del usuario. Reutiliza las mismas Edge Functions que la app
 * legado (create-checkout-session / create-portal-session), asi que aqui no hay logica
 * de cobro: solo lectura del estado y redirecciones a Stripe.
 *
 * `subscription` distingue tres situaciones que el gating necesita separar:
 *   undefined -> todavia no resuelto
 *   null      -> resuelto pero sin fila, o fallo la carga
 *   objeto    -> fila real
 */
export function useSubscription(user: User | null) {
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseClient || !user) {
      setSubscription(undefined);
      return;
    }

    const { data, error: fetchError } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.warn("No se pudo cargar el estado de suscripcion.", fetchError);
      setSubscription(null);
      return;
    }

    setSubscription(data ? fromRow(data as SubscriptionRow) : null);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accessActive = useMemo(() => isSubscriptionAccessActive(subscription), [subscription]);

  /**
   * Fail-open a proposito, igual que en el legado: si el estado aun no se ha resuelto o
   * la carga fallo, se permite escribir. Un fallo de red no debe dejar a un usuario que
   * paga sin poder tocar sus datos. Solo bloquea una suscripcion resuelta e inactiva.
   */
  const canMutateData = useMemo(() => {
    if (subscription === undefined || subscription === null) return true;
    return accessActive;
  }, [accessActive, subscription]);

  const trialDaysLeft = useMemo(() => {
    if (!subscription?.trialEndsAt) return 0;
    const msLeft = new Date(subscription.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(msLeft / DAY_MS));
  }, [subscription]);

  const startCheckout = useCallback(async (interval: BillingInterval) => {
    if (!supabaseClient || !user) return;
    setBusy(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabaseClient.functions.invoke("create-checkout-session", {
        body: { interval },
      });
      if (invokeError) throw invokeError;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("No se pudo iniciar el pago.");
      window.location.href = url;
    } catch (checkoutError) {
      setBusy(false);
      setError(checkoutError instanceof Error ? checkoutError.message : "No se pudo iniciar el pago.");
    }
  }, [user]);

  const openBillingPortal = useCallback(async () => {
    if (!supabaseClient || !user) return;
    setBusy(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabaseClient.functions.invoke("create-portal-session");
      if (invokeError) throw invokeError;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("No se pudo abrir el portal.");
      window.location.href = url;
    } catch (portalError) {
      setBusy(false);
      setError(portalError instanceof Error ? portalError.message : "No se pudo abrir el portal.");
    }
  }, [user]);

  // Una licencia de por vida no tiene suscripcion de Stripe que gestionar, aunque haya
  // quedado un stripe_customer_id de alguna prueba anterior.
  const canManageBilling = useMemo(
    () => subscription?.status !== "lifetime" && Boolean(subscription?.stripeCustomerId),
    [subscription],
  );

  return {
    accessActive,
    busy,
    canManageBilling,
    canMutateData,
    clearError: () => setError(null),
    error,
    openBillingPortal,
    refresh,
    startCheckout,
    subscription,
    trialDaysLeft,
  };
}

export function isSubscriptionAccessActive(subscription: Subscription | null | undefined) {
  if (!subscription) return false;
  if (subscription.status === "active" || subscription.status === "lifetime") return true;
  if (subscription.status === "trialing") {
    if (!subscription.trialEndsAt) return true;
    return new Date(subscription.trialEndsAt).getTime() > Date.now();
  }
  return false;
}

function fromRow(row: SubscriptionRow): Subscription {
  return {
    userId: row.user_id,
    status: normalizeStatus(row.status),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    priceId: row.price_id,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
  };
}

function normalizeStatus(value: string | null): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = ["trialing", "active", "past_due", "canceled", "lifetime"];
  return allowed.includes(value as SubscriptionStatus) ? (value as SubscriptionStatus) : "canceled";
}
