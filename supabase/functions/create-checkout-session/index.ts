// Creates a Stripe Checkout Session for the authenticated user and returns its URL.
// Deploy via the Supabase dashboard (Edge Functions -> New function) or the CLI.
// Required function secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL,
// SITE_URL, SUPABASE_SERVICE_ROLE_KEY (SUPABASE_URL and SUPABASE_ANON_KEY are provided
// automatically by the Supabase Edge Functions runtime).
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// La cuenta de Stripe esta fijada en 2024-06-20. Los tipos de stripe@17 solo admiten la
// version con la que se publico el paquete, de ahi el cast: no cambia nada al ejecutar.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

const priceIdByInterval: Record<string, string> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY") ?? "",
  annual: Deno.env.get("STRIPE_PRICE_ANNUAL") ?? "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header.");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) throw new Error("No autenticado.");
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const interval = body?.interval === "annual" ? "annual" : "monthly";
    const priceId = priceIdByInterval[interval];
    if (!priceId) throw new Error(`Price no configurado para el intervalo "${interval}".`);
    if (!SITE_URL) throw new Error("SITE_URL no configurado.");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await adminClient
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    // Con una suscripcion viva, un checkout nuevo crearia una segunda y se cobrarian las
    // dos. past_due cuenta como viva: Stripe sigue reintentando la primera, y lo que hay
    // que arreglar es la tarjeta, desde el portal. La app ya no ofrece los planes en estos
    // casos; esto es la red por si se llega igualmente.
    if (existing?.status === "lifetime") {
      throw new Error("Tu cuenta ya tiene acceso de por vida.");
    }
    if ((existing?.status === "active" || existing?.status === "past_due") && existing.stripe_subscription_id) {
      throw new Error("Ya tienes una suscripcion. Gestionala desde Ajustes > Suscripcion.");
    }

    let customerId = existing?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await adminClient.from("subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/app?checkout=success`,
      cancel_url: `${SITE_URL}/app?checkout=cancelled`,
      client_reference_id: user.id,
      subscription_data: { metadata: { supabase_user_id: user.id } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
