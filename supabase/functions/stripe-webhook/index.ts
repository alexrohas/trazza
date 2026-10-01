// Stripe calls this endpoint directly (not through supabase.functions.invoke), so it
// must be deployed with JWT verification OFF ("Enforce JWT verification" unchecked in
// the dashboard, or --no-verify-jwt with the CLI). Authenticity is instead verified via
// the Stripe signature below using STRIPE_WEBHOOK_SIGNING_SECRET.
//
// Register this endpoint in the Stripe dashboard as:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// listening for: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

type PaidStatus = "active" | "past_due" | "canceled";

// Reduce los estados de Stripe a los que entiende subscriptions.status ("trialing" y
// "lifetime" solo los ponen el trigger de alta y el SQL a mano). null = no tocar la fila.
//
// past_due conserva el acceso: Stripe sigue reintentando el cobro durante dias y quien
// paga no deberia quedarse en solo lectura al primer fallo de la tarjeta. Lo que lo
// cierra es el final de los reintentos, que llega como canceled o unpaid segun la
// configuracion de Stripe. La regla de acceso esta escrita dos veces y tiene que decir lo
// mismo: can_write_data() en supabase-rls-subscription-writes.sql e
// isSubscriptionAccessActive en web/src/hooks/useSubscription.ts.
function mapStripeStatus(stripeStatus: string): PaidStatus | null {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    // Primer pago de una suscripcion nueva sin completar (3D Secure a medias) o caducado
    // sin completarse: nunca hubo acceso pagado que dar ni quitar. Antes iba a past_due, y
    // un "created" en incomplete que llegara despues del "updated" en active dejaba sin
    // acceso a quien acababa de pagar.
    case "incomplete":
    case "incomplete_expired":
      return null;
    case "unpaid":
    case "canceled":
    case "paused":
    default:
      return "canceled";
  }
}

// Stripe moved current_period_end from the subscription root to the first
// subscription item in newer API versions. Read both so this keeps working
// regardless of which API version the Stripe account is pinned to.
function getCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const root = (subscription as { current_period_end?: number }).current_period_end;
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  const timestamp = root ?? item?.current_period_end;
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

// Mismo caso que current_period_end: en las versiones nuevas de la API la suscripcion de
// una factura vive en parent.subscription_details y no en la raiz.
function getInvoiceSubscriptionId(invoice: {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
}): string | null {
  const value = invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

// La cuenta de Stripe esta fijada en 2024-06-20. Los tipos de stripe@17 solo admiten la
// version con la que se publico el paquete, de ahi el cast: no cambia nada al ejecutar.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header.");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SIGNING_SECRET not configured.");
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("stripe-webhook signature verification failed", message);
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  // Todos los eventos acaban igual: se averigua de que suscripcion hablan y se escribe su
  // estado ACTUAL, leido de Stripe, no el que trae el evento. Stripe no garantiza el orden
  // de entrega, y escribir el estado del evento dejaba que uno viejo pisara a uno nuevo
  // (un payment_failed que llega despues del cobro bueno, un created despues del updated).
  // Leer el estado vigente hace que el orden de llegada de igual.
  try {
    let subscriptionId: string | null = null;
    let fallbackUserId: string | null = null;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        subscriptionId = idOf(session.subscription as string | { id: string } | null);
        fallbackUserId = session.client_reference_id;
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        subscriptionId = (event.data.object as Stripe.Subscription).id;
        break;
      }
      case "invoice.payment_failed": {
        subscriptionId = getInvoiceSubscriptionId(event.data.object as Parameters<typeof getInvoiceSubscriptionId>[0]);
        break;
      }
      default:
        break;
    }

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId =
        subscription.metadata?.supabase_user_id ||
        fallbackUserId ||
        (await findUserIdByCustomer(idOf(subscription.customer as string | { id: string }) ?? ""));
      if (userId) await applySubscription(userId, subscription);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stripe-webhook handler error", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await adminClient
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function applySubscription(userId: string, subscription: Stripe.Subscription) {
  const status = mapStripeStatus(subscription.status);
  if (!status) return;

  const { data: row, error: readError } = await adminClient
    .from("subscriptions")
    .select("status, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(`No se pudo leer la suscripcion de ${userId}: ${readError.message}`);

  // lifetime se pone a mano y ningun evento de Stripe lo quita: si alguien con acceso de
  // por vida tuvo una suscripcion antes, su cancelacion no puede dejarle sin acceso.
  if (row?.status === "lifetime") return;

  // Un evento que quita o recorta acceso solo cuenta si es de la suscripcion que la fila
  // tiene apuntada. Quien cancela y vuelve a suscribirse tiene dos en Stripe, y el
  // "deleted" de la vieja no puede dejar en canceled a la nueva. Una que da acceso
  // (active) siempre entra: es la que pasa a ser la vigente.
  if (status !== "active" && row?.stripe_subscription_id && row.stripe_subscription_id !== subscription.id) return;

  const priceId = subscription.items.data[0]?.price?.id ?? null;

  // upsert y no update: un update no distingue "actualizada" de "no habia fila que
  // actualizar". Un usuario sin fila en subscriptions (el trigger de alta fallo, o la
  // cuenta se creo por otra via) pagaba, afectaba a cero filas, Stripe recibia un 200 y la
  // persona se quedaba con el paywall puesto sin que constara un error en ninguna parte.
  // La PK de la tabla es user_id, asi que el conflicto se resuelve por ahi sin declararlo.
  //
  // trial_ends_at se queda fuera a proposito: en una fila que ya existe no hay que
  // tocarlo, y en una que se crea aqui no significa nada, porque el acceso ya lo da
  // status sin mirar la fecha.
  const { error } = await adminClient
    .from("subscriptions")
    .upsert({
      user_id: userId,
      status,
      stripe_customer_id: idOf(subscription.customer as string | { id: string }),
      stripe_subscription_id: subscription.id,
      price_id: priceId,
      current_period_end: getCurrentPeriodEnd(subscription),
    });

  // Si la escritura falla se propaga, para que el handler devuelva 500 y Stripe reintente
  // el evento. supabase-js no lanza: devuelve { error }. Ignorarlo era contestar 200 a un
  // cobro que no se llego a registrar, y lo que Stripe da por entregado no lo repite.
  // Vale tambien para los eventos que quitan acceso: reintentarlos no hace dano.
  if (error) throw new Error(`No se pudo guardar la suscripcion de ${userId}: ${error.message}`);
}
