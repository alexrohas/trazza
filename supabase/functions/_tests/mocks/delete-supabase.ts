// Supabase simulado para delete-account: apunta en `log`, en orden, todo lo que se
// borra (Storage, tablas y el usuario), que es lo que los tests comprueban.
export const db = {
  log: [] as string[],
  objects: [] as string[],
  failList: false,
  failRemove: false,
  user: { id: "u1" } as { id: string } | null,
};

export function createClient(_url: string, _key: string) {
  return {
    auth: {
      getUser: async () =>
        db.user ? { data: { user: db.user }, error: null } : { data: { user: null }, error: { message: "no session" } },
      admin: {
        deleteUser: async (id: string) => {
          db.log.push(`auth.deleteUser:${id}`);
          return { error: null };
        },
      },
    },
    from(table: string) {
      let op = "select";
      const query: Record<string, unknown> = {
        select: () => query,
        delete: () => {
          op = "delete";
          return query;
        },
        eq: () => query,
        maybeSingle: async () => ({
          data: table === "subscriptions" ? { stripe_subscription_id: "sub_1" } : null,
          error: null,
        }),
        then: (resolve: (value: unknown) => void) => {
          if (op === "delete") db.log.push(`delete:${table}`);
          resolve({ data: null, error: null });
        },
      };
      return query;
    },
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string, { limit, offset }: { limit: number; offset: number }) => {
          db.log.push(`storage.list:${bucket}:${prefix}:${offset}`);
          if (db.failList) return { data: null, error: { message: "list boom" } };
          return {
            data: db.objects
              .filter((path) => path.startsWith(`${prefix}/`))
              .slice(offset, offset + limit)
              .map((path) => ({ name: path.slice(prefix.length + 1) })),
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          db.log.push(`storage.remove:${paths.length}`);
          if (db.failRemove) return { data: null, error: { message: "remove boom" } };
          db.objects = db.objects.filter((path) => !paths.includes(path));
          return { data: [], error: null };
        },
      }),
    },
  };
}
