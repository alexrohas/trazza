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

// Maps Stripe's granular subscription statuses down to the 3 states our
// subscriptions.status column understands for paid subscriptions. ("trialing"
// and "lifetime" are only ever set by our own signup trigger / manual SQL.)
function mapStripeStatus(stripeStatus: string): "active" | "past_due" | "canceled" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
    default:
      return "canceled";
  }
}

// Stripe moved current_period_end from the subscription root to the first
// subscription item in newer API versions. Read both so this keeps working
// regardless of which API version the Stripe account is pinned to.
function getCurrentPeriodEnd(subscription: {
  current_period_end?: number;
  items?: { data?: Array<{ current_period_end?: number }> };
}): string | null {
  const timestamp = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = subscription.metadata?.supabase_user_id || session.client_reference_id;
          if (userId) await upsertPaidSubscription(userId, subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id || (await findUserIdByCustomer(subscription.customer as string));
        if (userId) await upsertPaidSubscription(userId, subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id || (await findUserIdByCustomer(subscription.customer as string));
        if (userId) {
          await adminClient
            .from("subscriptions")
            .update({ status: "canceled", stripe_subscription_id: subscription.id })
            .eq("user_id", userId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await findUserIdByCustomer(invoice.customer as string);
        if (userId) {
          await adminClient.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId);
        }
        break;
      }
      default:
        break;
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
  const { data } = await adminClient
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function upsertPaidSubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;

  await adminClient
    .from("subscriptions")
    .update({
      status: mapStripeStatus(subscription.status),
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      price_id: priceId,
      current_period_end: getCurrentPeriodEnd(subscription),
    })
    .eq("user_id", userId);
}
