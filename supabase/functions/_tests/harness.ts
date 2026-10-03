// Lo comun a los tests de las Edge Functions.
//
// Cada funcion hace `Deno.serve(handler)` al importarse. Aqui se cambia Deno.serve un
// momento para quedarse con ese handler y llamarlo con Requests de verdad, sin levantar
// ningun servidor. Stripe y Supabase se sustituyen por los modulos de mocks/ mediante el
// import map de cada test (ver run.sh): asi se ejecuta el index.ts real, el mismo que se
// despliega, y no una copia.

export type Handler = (req: Request) => Promise<Response>;

export async function loadHandler(moduleUrl: URL): Promise<Handler> {
  let handler: Handler | null = null;
  const original = Deno.serve;
  Object.defineProperty(Deno, "serve", {
    value: (h: Handler) => {
      handler = h;
      return {};
    },
    configurable: true,
    writable: true,
  });
  try {
    await import(moduleUrl.href);
  } finally {
    Object.defineProperty(Deno, "serve", { value: original, configurable: true, writable: true });
  }
  if (!handler) throw new Error(`${moduleUrl.pathname} no llamo a Deno.serve`);
  return handler;
}

export function assert(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) throw new Error(detail === undefined ? message : `${message}\n${JSON.stringify(detail, null, 2)}`);
}
