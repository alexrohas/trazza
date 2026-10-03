// Stripe simulado para delete-account: solo apunta que suscripciones se cancelan.
export const state = { canceled: [] as string[] };

export default class Stripe {
  constructor(_key: string, _opts: unknown) {}
  subscriptions = {
    cancel: async (id: string) => {
      state.canceled.push(id);
      return { id, status: "canceled" };
    },
  };
}
