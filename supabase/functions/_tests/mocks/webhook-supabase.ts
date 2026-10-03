// Supabase simulado para stripe-webhook: solo la tabla subscriptions, con lo que usa el
// handler (select + eq + maybeSingle y upsert por user_id).
export const db = {
  rows: new Map<string, Record<string, unknown>>(),
  failUpsert: false,
};

class Query {
  filters: [string, unknown][] = [];
  constructor(private table: string) {}
  select(_columns: string) {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  async maybeSingle() {
    const match = [...db.rows.values()].filter((row) => this.filters.every(([column, value]) => row[column] === value));
    if (match.length > 1) return { data: null, error: { message: "multiple rows" } };
    return { data: match[0] ? { ...match[0] } : null, error: null };
  }
  async upsert(values: Record<string, unknown>) {
    if (this.table !== "subscriptions") throw new Error(`tabla inesperada: ${this.table}`);
    if (db.failUpsert) return { error: { message: "boom" } };
    const key = String(values.user_id);
    db.rows.set(key, { ...(db.rows.get(key) || {}), ...values });
    return { error: null };
  }
}

export function createClient(_url: string, _key: string) {
  return { from: (table: string) => new Query(table) };
}
