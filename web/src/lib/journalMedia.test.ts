import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../test/fakeSupabase";
import {
  createCloudJournalEntry,
  deleteCloudJournalEntry,
  loadCloudData,
  migrateInlineJournalMedia,
  replaceCloudData,
  updateCloudJournalEntry,
} from "./db";
import { embedJournalMediaForExport, JOURNAL_MEDIA_STORAGE_ENABLED } from "./journalMedia";
import type { JournalEntryInput } from "../types";

/* El ciclo entero de las capturas del Journal en Supabase Storage (1 de octubre de 2026):
   crear, cargar firmadas, editar sin tocar, cambiar, quitar, borrar, URL ajena, subida
   rechazada, migrar las antiguas en base64, exportar e importar. Son los casos con los que
   se encendio el interruptor, sobre un Supabase en memoria. */

/* La exportacion pasa las imagenes a base64 con FileReader, que Node no trae. Este hace
   lo mismo que el del navegador con readAsDataURL, que es lo unico que se usa. */
class NodeFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onloadend: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
        this.result = `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
        this.onload?.();
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
}

beforeEach(() => {
  if (typeof globalThis.FileReader === "undefined") vi.stubGlobal("FileReader", NodeFileReader);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const JPEG = `data:image/jpeg;base64,${btoa("fake-jpeg-bytes-1")}`;
const JPEG2 = `data:image/jpeg;base64,${btoa("fake-jpeg-bytes-2-different")}`;
const input = (operationUrl: string) =>
  ({
    date: "2026-09-01",
    symbol: "NQ",
    direction: "long",
    tradingSession: "newYork",
    sessionType: "trading-day",
    result: "good",
    emotion: "calm",
    discipline: 4,
    pnl: 100,
    errors: [],
    operationUrl,
  }) as unknown as JournalEntryInput;

describe("capturas del Journal en Storage", () => {
  it("el interruptor esta encendido", () => {
    expect(JOURNAL_MEDIA_STORAGE_ENABLED).toBe(true);
  });

  it("recorre el ciclo entero sin dejar ficheros huerfanos", async () => {
    const fake = createFakeSupabase();
    const client = fake.client as any;
    const rows = () => fake.table("journal_entries");
    const row = (id: string) => rows().find((candidate) => candidate.id === id)!;

    /* Crear con una imagen pegada: sube a u1/<uuid>.jpg y la fila no lleva el base64. */
    const created = await createCloudJournalEntry(client, "u1", input(JPEG));
    const path1 = String(row(created.id).media_path);
    expect(path1).toMatch(/^u1\/[0-9a-f-]{36}\.jpg$/);
    expect(fake.objects.get(path1)?.type).toBe("image/jpeg");
    expect(row(created.id).operation_url).toBeNull();

    /* Cargar: la entrada sale con la URL firmada y su ruta. */
    let data = await loadCloudData(client, "u1");
    const loaded = data.journalEntries.find((entry) => entry.id === created.id)!;
    expect(loaded.operationUrl).toBe(fake.signedUrl(path1));
    expect(loaded.mediaPath).toBe(path1);

    /* Editar sin tocar la imagen (el borrador lleva la URL firmada): ni sube ni borra. */
    fake.uploads.length = 0;
    await updateCloudJournalEntry(client, "u1", created.id, { ...input(loaded.operationUrl!), pnl: 150 });
    expect(row(created.id).media_path).toBe(path1);
    expect(fake.uploads).toHaveLength(0);
    expect(fake.objects.has(path1)).toBe(true);

    /* Cambiar la imagen: sube la nueva y borra la vieja. */
    await updateCloudJournalEntry(client, "u1", created.id, input(JPEG2));
    const path2 = String(row(created.id).media_path);
    expect(path2).not.toBe(path1);
    expect(fake.objects.has(path2)).toBe(true);
    expect(fake.objects.has(path1)).toBe(false);

    /* Cambiarla por un enlace: borra el fichero y guarda el enlace. */
    await updateCloudJournalEntry(client, "u1", created.id, input("https://www.tradingview.com/x/abc/"));
    expect(row(created.id).media_path).toBeNull();
    expect(row(created.id).operation_url).toBe("https://www.tradingview.com/x/abc/");
    expect(fake.objects.has(path2)).toBe(false);

    /* Quitarla del todo. */
    await updateCloudJournalEntry(client, "u1", created.id, input(JPEG));
    const path6 = String(row(created.id).media_path);
    await updateCloudJournalEntry(client, "u1", created.id, input(""));
    expect(row(created.id).media_path).toBeNull();
    expect(row(created.id).operation_url).toBeNull();
    expect(fake.objects.has(path6)).toBe(false);

    /* Borrar una entrada con captura borra el fichero. */
    const toDelete = await createCloudJournalEntry(client, "u1", input(JPEG));
    const path7 = String(row(toDelete.id).media_path);
    await deleteCloudJournalEntry(client, "u1", toDelete.id);
    expect(fake.objects.has(path7)).toBe(false);
    expect(rows().some((candidate) => candidate.id === toDelete.id)).toBe(false);

    /* La URL firmada de OTRO usuario se guarda como enlace, no como ruta propia. */
    const foreign = `${fake.SUPABASE_URL}/storage/v1/object/sign/journal-media/u2/secret.jpg?token=zzz`;
    const withForeign = await createCloudJournalEntry(client, "u1", input(foreign));
    expect(row(withForeign.id).media_path).toBeNull();
    expect(row(withForeign.id).operation_url).toBe(foreign);

    /* Subida rechazada (una prueba caducada no puede subir): error y ninguna fila. */
    fake.flags.failUpload = true;
    const before = rows().length;
    await expect(createCloudJournalEntry(client, "u1", input(JPEG))).rejects.toThrow();
    fake.flags.failUpload = false;
    expect(rows()).toHaveLength(before);

    /* Migrar las capturas antiguas en base64, con ruta fija para no duplicar. */
    rows().push(
      { id: "old-1", user_id: "u1", date: "2026-08-01", title: "ES", pnl: 1, operation_url: JPEG, media_path: null },
      { id: "old-2", user_id: "u1", date: "2026-08-02", title: "ES", pnl: 1, operation_url: JPEG2, media_path: null },
    );
    data = await loadCloudData(client, "u1");
    let migration = await migrateInlineJournalMedia(client, "u1", data.journalEntries);
    expect(migration.moved).toBe(2);
    expect(migration.error).toBeFalsy();
    expect(row("old-1").media_path).toBe("u1/inline-old-1.jpg");
    expect(row("old-1").operation_url).toBeNull();
    expect(fake.objects.has("u1/inline-old-1.jpg")).toBe(true);

    data = await loadCloudData(client, "u1");
    migration = await migrateInlineJournalMedia(client, "u1", data.journalEntries);
    expect(migration.moved).toBe(0);
    expect(data.journalEntries.find((entry) => entry.id === "old-1")?.operationUrl).toBe(
      fake.signedUrl("u1/inline-old-1.jpg"),
    );

    /* Migrar sin permiso para subir: se para, devuelve el error y no toca la fila. */
    rows().push({ id: "old-3", user_id: "u1", date: "2026-08-03", title: "ES", pnl: 1, operation_url: JPEG, media_path: null });
    fake.flags.failUpload = true;
    migration = await migrateInlineJournalMedia(client, "u1", (await loadCloudData(client, "u1")).journalEntries);
    fake.flags.failUpload = false;
    expect(migration.moved).toBe(0);
    expect(migration.error).toBeTruthy();
    expect(row("old-3").operation_url).toBe(JPEG);

    /* Exportar: las firmadas se descargan y van en base64; mediaPath no viaja; el enlace
       externo se queda como esta. */
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).startsWith(`${fake.SUPABASE_URL}/storage/v1/object/sign/journal-media/`)
        ? new Response(new Blob(["png-bytes"], { type: "image/jpeg" }))
        : new Response("nope", { status: 404 }),
    );
    data = await loadCloudData(client, "u1");
    const exported = await embedJournalMediaForExport(data);
    const exportedOld = exported.journalEntries.find((entry) => entry.id === "old-1")!;
    expect(exportedOld.operationUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect("mediaPath" in exportedOld).toBe(false);
    expect(exported.journalEntries.find((entry) => entry.id === withForeign.id)?.operationUrl).toBe(foreign);

    /* Si una descarga falla, la exportacion se para en vez de salir incompleta. */
    vi.stubGlobal("fetch", async () => new Response("x", { status: 500 }));
    await expect(embedJournalMediaForExport(data)).rejects.toThrow();

    /* Importar el JSON exportado: sube cada captura y limpia lo que ya no apunta nadie. */
    fake.objects.set("u1/huerfana.jpg", { type: "image/jpeg", size: 1 });
    await replaceCloudData(client, "u1", exported);
    const imported = rows().filter((candidate) => candidate.user_id === "u1");
    const withMedia = imported.filter((candidate) => candidate.media_path);
    expect(withMedia).toHaveLength(3);
    expect(withMedia.every((candidate) => fake.objects.has(String(candidate.media_path)) && candidate.operation_url === null)).toBe(true);
    expect(fake.objects.has("u1/huerfana.jpg")).toBe(false);
    expect(fake.objects.has("u1/inline-old-1.jpg")).toBe(false);
    expect([...fake.objects.keys()].filter((key) => key.startsWith("u1/"))).toHaveLength(3);
  });
});
