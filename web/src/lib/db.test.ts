import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "../test/fakeSupabase";
import { loadCloudData } from "./db";

/* La carga de datos pide por paginas de 1.000 (auditoria del 30 de septiembre de 2026):
   PostgREST corta en max_rows sin error, y una tabla mas grande llegaba truncada sin que
   nadie se enterara. */

/* El simulado solo imita la parte de SupabaseClient que usa db.ts. */
const asClient = (fake: ReturnType<typeof createFakeSupabase>) => fake.client as any;

describe("loadCloudData", () => {
  it("trae enteras las tablas de mas de 1.000 filas, sin duplicados ni filas ajenas", async () => {
    const fake = createFakeSupabase({ maxRows: 1000, broken: { journal_deleted_default_error_types: "missing" } });
    /* 2.500 movimientos, muchos el mismo dia: si el orden no llevara desempate unico, las
       paginas podrian repetir o saltarse filas. Y 1.000 justas de journal. */
    fake.table("transactions").push(
      ...Array.from({ length: 2500 }, (_, index) => ({
        id: `t${String(index).padStart(5, "0")}`,
        user_id: "u1",
        date: `2026-0${1 + (index % 3)}-01`,
        kind: "expense",
        category: "other",
        amount: 1,
      })),
      { id: "x", user_id: "u2", date: "2026-01-01", kind: "expense", category: "other", amount: 1 },
    );
    fake.table("journal_entries").push(
      ...Array.from({ length: 1000 }, (_, index) => ({
        id: `j${String(index).padStart(5, "0")}`,
        user_id: "u1",
        date: "2026-05-05",
        pnl: 1,
      })),
    );

    const data = await loadCloudData(asClient(fake), "u1");
    const ids = data.movements.map((movement) => movement.id);

    expect(data.movements).toHaveLength(2500);
    expect(new Set(ids).size).toBe(2500);
    expect(ids).not.toContain("x");
    expect(data.journalEntries).toHaveLength(1000);
    /* Una tabla opcional que no existe llega vacia, no como error. */
    expect(data.deletedDefaultErrorTypeIds).toEqual([]);
    expect(fake.pageCalls.filter((call) => call.startsWith("transactions"))).toHaveLength(3);
    /* Con 1.000 justas pide una pagina mas para saber que ha terminado. */
    expect(fake.pageCalls.filter((call) => call.startsWith("journal_entries"))).toHaveLength(2);
  });

  it("un error en una tabla obligatoria llega como error, no como lista corta", async () => {
    const fake = createFakeSupabase({ broken: { firms: "error" } });
    await expect(loadCloudData(asClient(fake), "u1")).rejects.toThrow();
  });
});
