// Deletes the authenticated user's account permanently: cancels any live Stripe
// subscription, deletes their rows from every table (in FK-safe order, children
// before parents, since firms/accounts/transactions have no CREATE TABLE tracked
// in this repo so their cascade behavior can't be assumed), then deletes the
// auth.users row itself via the admin API. Deploy with "Verify JWT" ON — this is
// invoked by the authenticated user themselves, not a public webhook.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const userId = userData.user.id;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (error) {
        console.warn("No se pudo cancelar la suscripcion de Stripe", error);
      }
    }

    const tablesInDeleteOrder = [
      "transactions",
      "journal_entries",
      "journal_error_types",
      "accounts",
      "firms",
    ];
    for (const table of tablesInDeleteOrder) {
      const result = await adminClient.from(table).delete().eq("user_id", userId);
      if (result.error) throw new Error(`No se pudo borrar ${table}: ${result.error.message}`);
    }

    const subscriptionDelete = await adminClient.from("subscriptions").delete().eq("user_id", userId);
    if (subscriptionDelete.error) {
      throw new Error(`No se pudo borrar subscriptions: ${subscriptionDelete.error.message}`);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error(deleteUserError.message);

    return new Response(JSON.stringify({ success: true }), {
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
