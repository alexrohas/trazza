import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData, JournalEntry } from "../types";

/**
 * Capturas del Journal en Supabase Storage.
 *
 * Hasta octubre de 2026 cada captura viajaba en base64 dentro de la propia fila
 * (journal_entries.operation_url), y como la app recarga todas las entradas después de cada
 * guardado, el usuario con más capturas se descargaba 6,4 MB cada vez que guardaba algo.
 * Ahora la imagen vive en el bucket privado `journal-media`, la fila guarda solo su ruta
 * (media_path) y al cargar se firman todas las rutas en una sola petición. La interfaz no
 * se entera: entry.operationUrl sigue siendo "lo que se pinta", ahora una URL firmada.
 *
 * Qué es cada cosa en operationUrl, según de dónde venga:
 *   - "data:image/..."            imagen nueva sin subir todavía (o una fila antigua sin migrar)
 *   - URL firmada de este bucket  imagen ya en Storage; su ruta se saca de la propia URL
 *   - cualquier otra cosa         enlace externo (TradingView...), se guarda tal cual
 * Sacar la ruta de la URL y no de un campo aparte del borrador es a propósito: así el
 * formulario no tiene que saber nada de Storage, y si la firma se renueva con el
 * formulario abierto la URL vieja sigue apuntando a la misma ruta.
 *
 * Rutas: `<user_id>/<uuid>.<ext>`. La primera carpeta es el usuario porque es lo que miran
 * las políticas de supabase-journal-media.sql. Las migradas desde base64 usan
 * `<user_id>/inline-<entry_id>.<ext>`: fija, para que repetir una migración cortada a
 * medias sobrescriba en vez de dejar copias huérfanas.
 */
export const JOURNAL_MEDIA_BUCKET = "journal-media";

/* Interruptor, encendido el 1 de octubre de 2026 tras ejecutar supabase-journal-media.sql
   en producción. Encendido, las capturas nuevas se suben a Storage y las antiguas de cada
   usuario se migran solas la primera vez que entra. Apagado, no se sube ni se migra nada y
   las consultas de escritura no nombran media_path; las ya migradas se siguen viendo,
   porque firmar las rutas al cargar no depende de él. Apagarlo solo tendría sentido sin
   la columna media_path, y ahora ya existe. */
export const JOURNAL_MEDIA_STORAGE_ENABLED = true;

/* La URL firmada da acceso a quien la tenga hasta que caduca, así que no conviene que
   dure semanas; un día cubre de sobra una sesión. Se reutiliza mientras le queden más de
   dos horas: así la URL de cada imagen no cambia en cada recarga y el navegador la sirve
   de su caché en vez de volver a descargarla. */
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const SIGNED_URL_MIN_REMAINING_MS = 2 * 60 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const SIGNED_URL_PATTERN = new RegExp(`/storage/v1/object/sign/${JOURNAL_MEDIA_BUCKET}/([^?#]+)`);

export function isInlineImage(value: string | undefined | null): value is string {
  return typeof value === "string" && /^data:image\//i.test(value.trim());
}

export function isJournalMediaUrl(value: string | undefined | null) {
  return typeof value === "string" && SIGNED_URL_PATTERN.test(value);
}

/* La ruta de una URL firmada de este bucket, solo si es del propio usuario. Una URL de otra
   cuenta (pegada a mano, o de un JSON ajeno) no se acepta como captura propia: se queda
   como enlace, y de todos modos RLS no dejaría firmarla. */
export function mediaPathFromSignedUrl(value: string, userId: string): string | null {
  const match = value.match(SIGNED_URL_PATTERN);
  if (!match) return null;
  let path: string;
  try {
    path = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return path.startsWith(`${userId}/`) && !path.includes("..") ? path : null;
}

export function extensionForImage(dataUrl: string) {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")).toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Imagen no válida.");
  const meta = dataUrl.slice(5, comma);
  const mime = meta.split(";")[0] || "application/octet-stream";
  const payload = dataUrl.slice(comma + 1);
  if (!meta.includes(";base64")) return new Blob([decodeURIComponent(payload)], { type: mime });
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

/* Firma las rutas que no tengan ya una URL vigente y devuelve las entradas con
   operationUrl apuntando a ella. Si la firma falla, la carga no se cae: las entradas salen
   sin imagen y se reintenta en la siguiente recarga. */
export async function signJournalMedia(client: SupabaseClient, entries: JournalEntry[]): Promise<JournalEntry[]> {
  const paths = [...new Set(entries.map((entry) => entry.mediaPath).filter((path): path is string => Boolean(path)))];
  if (!paths.length) return entries;

  const now = Date.now();
  const pending = paths.filter((path) => {
    const cached = signedUrlCache.get(path);
    return !cached || cached.expiresAt - now < SIGNED_URL_MIN_REMAINING_MS;
  });

  if (pending.length) {
    const { data, error } = await client.storage.from(JOURNAL_MEDIA_BUCKET).createSignedUrls(pending, SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.warn("No se pudieron firmar las capturas del Journal.", error);
    } else {
      for (const item of data || []) {
        if (item.path && item.signedUrl && !item.error) {
          signedUrlCache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000 });
        }
      }
    }
  }

  return entries.map((entry) =>
    entry.mediaPath ? { ...entry, operationUrl: signedUrlCache.get(entry.mediaPath)?.url || "" } : entry,
  );
}

export async function uploadJournalMedia(client: SupabaseClient, path: string, dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl.trim());
  const { error } = await client.storage.from(JOURNAL_MEDIA_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw new Error(error.message || "No se pudo subir la captura.");
}

/* Borrar el fichero de una captura que ya no usa nadie. Va a mejor esfuerzo: si falla, lo
   que queda es un fichero huérfano que ocupa sitio, no un dato mal, así que no merece
   tumbar el guardado que lo provocó. */
export async function removeJournalMedia(client: SupabaseClient, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!list.length) return;
  list.forEach((path) => signedUrlCache.delete(path));
  const { error } = await client.storage.from(JOURNAL_MEDIA_BUCKET).remove(list);
  if (error) console.warn("No se pudieron borrar capturas antiguas del Journal.", error);
}

export async function listJournalMedia(client: SupabaseClient, userId: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from(JOURNAL_MEDIA_BUCKET).list(userId, { limit: pageSize, offset });
    if (error) throw new Error(error.message || "No se pudieron listar las capturas.");
    const page = data || [];
    page.forEach((item) => paths.push(`${userId}/${item.name}`));
    if (page.length < pageSize) return paths;
  }
}

/* La copia JSON tiene que valer por sí sola: una URL firmada caduca en un día, así que al
   exportar cada captura de Storage se descarga y se mete en base64, como antes. Si alguna
   no se puede descargar se para la exportación: una copia de seguridad a la que le faltan
   imágenes sin avisar es peor que ninguna. */
export async function embedJournalMediaForExport(data: AppData): Promise<AppData> {
  const journalEntries = await Promise.all(
    data.journalEntries.map(async (entry) => {
      const { mediaPath, ...rest } = entry;
      /* Solo las capturas propias, las que tienen ruta. Un enlace guardado como enlace se
         copia tal cual aunque parezca de este bucket: si fuera una URL firmada ajena y ya
         caducada, descargarla haría fallar todas las exportaciones de ese usuario. */
      if (!mediaPath || !isJournalMediaUrl(entry.operationUrl)) return rest;
      const response = await fetch(entry.operationUrl as string);
      if (!response.ok) throw new Error("No se pudo descargar una captura para la copia.");
      return { ...rest, operationUrl: await blobToDataUrl(await response.blob()) };
    }),
  );
  return { ...data, journalEntries };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer una captura para la copia."));
    reader.readAsDataURL(blob);
  });
}
