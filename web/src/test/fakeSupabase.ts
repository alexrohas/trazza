/**
 * Un Supabase en memoria con lo justo que usan db.ts y journalMedia.ts: tablas con
 * select/insert/update/delete, filtros por igualdad, orden, paginas con `range` y el
 * bucket de capturas. No pretende ser PostgREST; pretende comportarse como el en las dos
 * cosas que ya nos han mordido:
 *
 * - `maxRows`: PostgREST corta cada respuesta en max_rows SIN error. Con el corte puesto,
 *   una carga que no pagina llega truncada y el test lo ve.
 * - Columnas en camelCase: insertar `operationUrl` en vez de `operation_url` es un error
 *   de verdad en Supabase, y aqui tambien.
 */

type Row = Record<string, unknown>;
type Broken = "missing" | "error";

export function createFakeSupabase(options: { maxRows?: number; broken?: Record<string, Broken> } = {}) {
  const maxRows = options.maxRows ?? Infinity;
  const broken = options.broken ?? {};
  const tables = new Map<string, Row[]>();
  const objects = new Map<string, { type: string; size: number }>();
  const uploads: string[] = [];
  /** "tabla:desde-hasta" por cada pagina pedida. */
  const pageCalls: string[] = [];
  const flags = { failUpload: false };

  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  };

  function brokenResult(name: string) {
    const state = broken[name];
    if (state === "missing") return { data: null, error: { code: "42P01", message: `relation "${name}" does not exist` } };
    if (state === "error") return { data: null, error: { code: "XX000", message: "boom" } };
    return null;
  }

  function builder(name: string) {
    const st: { op: string; payload?: unknown; filters: [string, unknown][]; orders: [string, boolean][] } = {
      op: "select",
      filters: [],
      orders: [],
    };
    const match = (row: Row) => st.filters.every(([column, value]) => row[column] === value);

    const exec = (): { data: Row[] | null; error: { code?: string; message: string } | null } => {
      const failure = brokenResult(name);
      if (failure) return failure;
      const rows = table(name);
      if (st.op === "select") {
        return {
          data: rows
            .filter(match)
            .sort((a, b) => {
              for (const [column, ascending] of st.orders) {
                const x = String(a[column]);
                const y = String(b[column]);
                if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
              }
              return 0;
            })
            .map((row) => ({ ...row })),
          error: null,
        };
      }
      if (st.op === "insert") {
        const list = (Array.isArray(st.payload) ? st.payload : [st.payload]) as Row[];
        if (list.some((row) => Object.keys(row).some((key) => key !== key.toLowerCase()))) {
          return { data: null, error: { message: "column does not exist" } };
        }
        const inserted = list.map((row) => ({ id: row.id ?? crypto.randomUUID(), ...row }));
        rows.push(...inserted);
        return { data: inserted.map((row) => ({ ...row })), error: null };
      }
      if (st.op === "update") {
        const hit = rows.filter(match);
        hit.forEach((row) => Object.assign(row, st.payload as Row));
        return { data: hit.map((row) => ({ ...row })), error: null };
      }
      if (st.op === "delete") {
        const hit = rows.filter(match);
        tables.set(
          name,
          rows.filter((row) => !match(row)),
        );
        return { data: hit.map((row) => ({ ...row })), error: null };
      }
      throw new Error(`operacion ${st.op} no simulada`);
    };

    const query: Record<string, unknown> = {
      select: () => query,
      insert: (payload: unknown) => ((st.op = "insert"), (st.payload = payload), query),
      update: (payload: unknown) => ((st.op = "update"), (st.payload = payload), query),
      delete: () => ((st.op = "delete"), query),
      eq: (column: string, value: unknown) => (st.filters.push([column, value]), query),
      order: (column: string, opts?: { ascending?: boolean }) => (st.orders.push([column, opts?.ascending ?? true]), query),
      range: async (from: number, to: number) => {
        pageCalls.push(`${name}:${from}-${to}`);
        const result = exec();
        if (!result.data) return result;
        const end = Math.min(to, from + maxRows - 1);
        return { data: result.data.slice(from, end + 1), error: null };
      },
      maybeSingle: async () => {
        const result = exec();
        return { data: result.data?.[0] ?? null, error: result.error };
      },
      single: async () => {
        const result = exec();
        if (result.error) return result;
        return result.data?.length ? { data: result.data[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
        try {
          resolve(exec());
        } catch (error) {
          reject(error);
        }
      },
    };
    return query;
  }

  const SUPABASE_URL = "https://fake.supabase.co";
  const signedUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/sign/journal-media/${path}?token=tok-${path.length}`;

  const client = {
    from: (name: string) => builder(name),
    storage: {
      from: (bucket: string) => {
        if (bucket !== "journal-media") throw new Error(`bucket ${bucket} no simulado`);
        return {
          upload: async (path: string, blob: Blob, opts: { contentType: string; upsert: boolean }) => {
            if (flags.failUpload) return { data: null, error: { message: "new row violates row-level security policy" } };
            if (objects.has(path) && !opts.upsert) return { data: null, error: { message: "The resource already exists" } };
            objects.set(path, { type: opts.contentType, size: blob.size });
            uploads.push(path);
            return { data: { path }, error: null };
          },
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) =>
              objects.has(path)
                ? { path, signedUrl: signedUrl(path), error: null }
                : { path, signedUrl: null, error: "Object not found" },
            ),
            error: null,
          }),
          remove: async (paths: string[]) => {
            paths.forEach((path) => objects.delete(path));
            return { data: [], error: null };
          },
          list: async (prefix: string, { limit, offset }: { limit: number; offset: number }) => ({
            data: [...objects.keys()]
              .filter((key) => key.startsWith(`${prefix}/`))
              .slice(offset, offset + limit)
              .map((key) => ({ name: key.slice(prefix.length + 1) })),
            error: null,
          }),
        };
      },
    },
  };

  return { client, tables, table, objects, uploads, pageCalls, flags, signedUrl, SUPABASE_URL };
}
