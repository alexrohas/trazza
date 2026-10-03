// delete-account (v4, 1 de octubre de 2026): cancela la suscripcion, borra las capturas
// del usuario en Storage ANTES que sus filas (si eso falla no se ha borrado nada y se
// puede reintentar), luego las filas y al final el usuario. Se ejecuta con el import map
// de delete.import_map.json (ver run.sh).
import { assert, loadHandler } from "./harness.ts";
import { state } from "./mocks/delete-stripe.ts";
import { db } from "./mocks/delete-supabase.ts";

const handler = await loadHandler(new URL("../delete-account/index.ts", import.meta.url));

const call = () => handler(new Request("http://localhost/", { method: "POST", headers: { Authorization: "Bearer jwt" } }));

function reset(objects: string[]) {
  db.log = [];
  db.objects = [...objects];
  db.failList = false;
  db.failRemove = false;
  state.canceled = [];
}

const nothingDeleted = () => !db.log.some((entry) => entry.startsWith("delete:") || entry.startsWith("auth."));

Deno.test("borra capturas, luego filas y al final el usuario", async () => {
  reset(["u1/a.jpg", "u1/inline-x.jpg", "u2/ajena.jpg"]);
  const res = await call();
  const firstRow = db.log.findIndex((entry) => entry.startsWith("delete:"));
  const removeAt = db.log.findIndex((entry) => entry.startsWith("storage.remove"));

  assert(res.status === 200 && state.canceled[0] === "sub_1", "200 y suscripcion cancelada", { status: res.status, canceled: state.canceled });
  assert(JSON.stringify(db.objects) === JSON.stringify(["u2/ajena.jpg"]), "solo borra sus capturas", db.objects);
  assert(removeAt >= 0 && removeAt < firstRow, "capturas antes que cualquier fila", db.log);
  assert(db.log[db.log.length - 1] === "auth.deleteUser:u1", "el usuario lo ultimo", db.log);
  assert(
    db.log.includes("delete:journal_strategies") && db.log.includes("delete:journal_deleted_default_error_types"),
    "borra tambien estrategias y tipos borrados",
    db.log,
  );
});

Deno.test("sin capturas no llama a remove", async () => {
  reset([]);
  const res = await call();
  assert(res.status === 200 && !db.log.some((entry) => entry.startsWith("storage.remove")), "200 sin remove", db.log);
});

Deno.test("con mas de 1.000 capturas pagina el listado", async () => {
  reset(Array.from({ length: 1500 }, (_, index) => `u1/f${index}.jpg`));
  const res = await call();
  const lists = db.log.filter((entry) => entry.startsWith("storage.list"));
  assert(res.status === 200 && lists.length === 2 && db.objects.length === 0, "dos paginas y todo borrado", lists);
});

Deno.test("si falla el listado de Storage no se borra nada", async () => {
  reset(["u1/a.jpg"]);
  db.failList = true;
  const res = await call();
  assert(res.status === 400 && nothingDeleted(), "400 y nada borrado", db.log);
});

Deno.test("si falla el borrado de ficheros no se borra nada", async () => {
  reset(["u1/a.jpg"]);
  db.failRemove = true;
  const res = await call();
  assert(res.status === 400 && nothingDeleted(), "400 y nada borrado", db.log);
});
