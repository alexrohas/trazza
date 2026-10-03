// Stripe simulado para stripe-webhook: la firma vale si la cabecera es "ok", y
// subscriptions.retrieve lee de un mapa que cada test rellena.
export const state = {
  subscriptions: new Map<string, Record<string, unknown>>(),
  retrieveCalls: [] as string[],
};

export default class Stripe {
  constructor(_key: string, _opts: unknown) {}
  webhooks = {
    constructEventAsync: async (body: string, signature: string, secret: string) => {
      if (signature !== "ok") throw new Error("bad signature");
      if (!secret) throw new Error("no secret");
      return JSON.parse(body);
    },
  };
  subscriptions = {
    retrieve: async (id: string) => {
      state.retrieveCalls.push(id);
      const subscription = state.subscriptions.get(id);
      if (!subscription) throw new Error(`No such subscription ${id}`);
      return structuredClone(subscription);
    },
  };
}
