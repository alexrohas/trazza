// El webhook de Stripe tal como quedo el 1 de octubre de 2026 (v17): escribe el estado
// ACTUAL de la suscripcion leido de Stripe, no el que trae el evento, y propaga los fallos
// de escritura para que Stripe reintente. Ver "La auditoria del 30 de septiembre" en
// CLAUDE.md. Se ejecuta con el import map de webhook.import_map.json (ver run.sh).
import { assert, loadHandler } from "./harness.ts";
import { state } from "./mocks/webhook-stripe.ts";
import { db } from "./mocks/webhook-supabase.ts";

Deno.env.set("STRIPE_WEBHOOK_SIGNING_SECRET", "whsec_test");
const handler = await loadHandler(new URL("../stripe-webhook/index.ts", import.meta.url));

const subscription = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  status,
  customer: "cus_1",
  metadata: { supabase_user_id: "u1" },
  current_period_end: 1790000000,
  items: { data: [{ price: { id: "price_m" } }] },
  ...extra,
});

function send(event: unknown, signature: string | null = "ok") {
  const headers: Record<string, string> = {};
  if (signature) headers["stripe-signature"] = signature;
  return handler(new Request("http://localhost/", { method: "POST", body: JSON.stringify(event), headers }));
}

function reset(rows: Record<string, unknown>[] = [], subscriptions: Record<string, unknown>[] = []) {
  db.rows.clear();
  db.failUpsert = false;
  rows.forEach((row) => db.rows.set(String(row.user_id), { ...row }));
  state.subscriptions.clear();
  state.retrieveCalls.length = 0;
  subscriptions.forEach((sub) => state.subscriptions.set(String(sub.id), sub));
}

const row = (id = "u1") => db.rows.get(id);

Deno.test("checkout completado: trialing pasa a active con sus ids", async () => {
  reset([{ user_id: "u1", status: "trialing", stripe_customer_id: "cus_1" }], [subscription("sub_A", "active")]);
  const res = await send({
    type: "checkout.session.completed",
    data: { object: { subscription: "sub_A", client_reference_id: "u1" } },
  });
  assert(
    res.status === 200 && row()?.status === "active" && row()?.stripe_subscription_id === "sub_A" && row()?.price_id === "price_m",
    "checkout -> active",
    row(),
  );
});

Deno.test("un created en incomplete que llega tarde no pisa un active", async () => {
  reset([{ user_id: "u1", status: "active", stripe_subscription_id: "sub_A" }], [subscription("sub_A", "active")]);
  await send({ type: "customer.subscription.created", data: { object: subscription("sub_A", "incomplete") } });
  assert(row()?.status === "active", "sigue active", row());
});

Deno.test("pago fallido pasa a past_due, con la forma antigua y la nueva de la factura", async () => {
  reset([{ user_id: "u1", status: "active", stripe_subscription_id: "sub_A", stripe_customer_id: "cus_1" }], [
    subscription("sub_A", "past_due"),
  ]);
  let res = await send({ type: "invoice.payment_failed", data: { object: { customer: "cus_1", subscription: "sub_A" } } });
  assert(res.status === 200 && row()?.status === "past_due", "forma antigua -> past_due", row());

  reset([{ user_id: "u1", status: "active", stripe_subscription_id: "sub_A", stripe_customer_id: "cus_1" }], [
    subscription("sub_A", "past_due"),
  ]);
  res = await send({
    type: "invoice.payment_failed",
    data: { object: { customer: "cus_1", parent: { subscription_details: { subscription: "sub_A" } } } },
  });
  assert(res.status === 200 && row()?.status === "past_due", "forma nueva -> past_due", row());
});

Deno.test("un payment_failed que llega despues de que el reintento cobrara no pisa active", async () => {
  reset([{ user_id: "u1", status: "active", stripe_subscription_id: "sub_A" }], [subscription("sub_A", "active")]);
  await send({ type: "invoice.payment_failed", data: { object: { customer: "cus_1", subscription: "sub_A" } } });
  assert(row()?.status === "active", "sigue active", row());
});

Deno.test("el deleted de una suscripcion vieja no pisa la nueva", async () => {
  reset([{ user_id: "u1", status: "active", stripe_subscription_id: "sub_B" }], [
    subscription("sub_A", "canceled"),
    subscription("sub_B", "active"),
  ]);
  await send({ type: "customer.subscription.deleted", data: { object: subscription("sub_A", "canceled") } });
  assert(row()?.status === "active" && row()?.stripe_subscription_id === "sub_B", "sigue la nueva", row());
});

Deno.test("el deleted de la vigente la cancela", async () => {
  reset([{ user_id: "u1", status: "past_due", stripe_subscription_id: "sub_A" }], [subscription("sub_A", "canceled")]);
  await send({ type: "customer.subscription.deleted", data: { object: subscription("sub_A", "canceled") } });
  assert(row()?.status === "canceled", "canceled", row());
});

Deno.test("reintentos agotados (unpaid) cierran el acceso", async () => {
  reset([{ user_id: "u1", status: "past_due", stripe_subscription_id: "sub_A" }], [subscription("sub_A", "unpaid")]);
  await send({ type: "customer.subscription.updated", data: { object: subscription("sub_A", "unpaid") } });
  assert(row()?.status === "canceled", "unpaid -> canceled", row());
});

Deno.test("ningun evento baja un lifetime", async () => {
  reset([{ user_id: "u1", status: "lifetime", stripe_subscription_id: null }], [subscription("sub_A", "canceled")]);
  await send({ type: "customer.subscription.deleted", data: { object: subscription("sub_A", "canceled") } });
  assert(row()?.status === "lifetime", "sigue lifetime", row());
});

Deno.test("un 3D Secure a medias (incomplete) no toca la prueba", async () => {
  reset([{ user_id: "u1", status: "trialing", trial_ends_at: "2099-01-01" }], [subscription("sub_A", "incomplete")]);
  const res = await send({ type: "customer.subscription.created", data: { object: subscription("sub_A", "incomplete") } });
  assert(res.status === 200 && row()?.status === "trialing" && !row()?.stripe_subscription_id, "sigue trialing", row());
});

Deno.test("un usuario sin fila que paga se crea (upsert de verdad)", async () => {
  reset([], [subscription("sub_A", "active")]);
  await send({ type: "checkout.session.completed", data: { object: { subscription: "sub_A", client_reference_id: "u1" } } });
  assert(row()?.status === "active", "creada active", row());
});

Deno.test("sin metadata encuentra al usuario por stripe_customer_id", async () => {
  const sub = subscription("sub_C", "active", { customer: "cus_2", metadata: {} });
  reset([{ user_id: "u2", status: "trialing", stripe_customer_id: "cus_2" }], [sub]);
  await send({ type: "customer.subscription.updated", data: { object: sub } });
  assert(row("u2")?.status === "active", "u2 active", row("u2"));
});

Deno.test("una escritura fallida devuelve 500 para que Stripe reintente", async () => {
  reset([{ user_id: "u1", status: "trialing" }], [subscription("sub_A", "active")]);
  db.failUpsert = true;
  const res = await send({ type: "customer.subscription.updated", data: { object: subscription("sub_A", "active") } });
  assert(res.status === 500, "500", res.status);
});

Deno.test("sin firma: 400 Missing stripe-signature header (la comprobacion de despliegue)", async () => {
  const res = await send({ type: "x" }, null);
  const text = await res.text();
  assert(res.status === 400 && text.includes("Missing stripe-signature header"), "400 con el mensaje", { status: res.status, text });
});

Deno.test("un evento que no interesa responde 200 sin llamar a Stripe", async () => {
  reset();
  const res = await send({ type: "charge.succeeded", data: { object: {} } });
  assert(res.status === 200 && state.retrieveCalls.length === 0, "200 sin retrieve", state.retrieveCalls);
});
