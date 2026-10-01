import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountKind,
  AccountStatus,
  AccountInput,
  AppData,
  DrawdownType,
  Firm,
  FirmInput,
  FirmType,
  JournalDirection,
  JournalEmotion,
  JournalEntry,
  JournalEntryInput,
  JournalErrorType,
  JournalErrorTypeInput,
  JournalResult,
  JournalSessionType,
  JournalStrategy,
  JournalStrategyInput,
  JournalTradingSession,
  Movement,
  MovementCategory,
  MovementInput,
  MovementKind,
  TradingAccount,
} from "../types";
import {
  JOURNAL_MEDIA_STORAGE_ENABLED,
  extensionForImage,
  isInlineImage,
  listJournalMedia,
  mediaPathFromSignedUrl,
  removeJournalMedia,
  signJournalMedia,
  uploadJournalMedia,
} from "./journalMedia";

type DbRow = Record<string, unknown>;

type QueryResult = {
  data: DbRow[] | null;
  error: { code?: string; message?: string } | null;
};

const firmTypes = new Set<FirmType>(["futures", "forex", "crypto", "other"]);
const accountStatuses = new Set<AccountStatus>(["active", "evaluation", "passed", "funded", "failed", "closed"]);
const accountKinds = new Set<AccountKind>(["challenge", "funded", "own"]);
const drawdownTypes = new Set<DrawdownType>(["static", "trailing"]);
const movementKinds = new Set<MovementKind>(["expense", "income"]);
const movementCategories = new Set<MovementCategory>([
  "challenge",
  "reset",
  "activation",
  "subscription",
  "platform",
  "commission",
  "payout",
  "refund",
  "other",
]);
const journalDirections = new Set<JournalDirection>(["long", "short", "none"]);
const journalTradingSessions = new Set<JournalTradingSession>(["asia", "london", "newYork", "londonNewYork", "other"]);
const journalSessionTypes = new Set<JournalSessionType>([
  "trading-day",
  "evaluation",
  "funded",
  "payout-day",
  "news-day",
  "review",
  "other",
]);
const journalResults = new Set<JournalResult>(["good", "neutral", "bad"]);
const journalEmotions = new Set<JournalEmotion>([
  "calm",
  "focused",
  "anxious",
  "impatient",
  "fomo",
  "revenge",
  "tired",
  "other",
]);

export async function loadCloudData(client: SupabaseClient, userId: string): Promise<AppData> {
  const [
    firmsResult,
    accountsResult,
    movementsResult,
    journalEntriesResult,
    journalErrorTypesResult,
    deletedDefaultsResult,
    journalStrategiesResult,
  ] = await Promise.all([
    fetchAllRows(() => client.from("firms").select("*").eq("user_id", userId).order("name", { ascending: true }).order("id")),
    fetchAllRows(() =>
      client.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true }).order("id"),
    ),
    fetchAllRows(() =>
      client.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: true }).order("id"),
    ),
    fetchOptionalTable(client, userId, "journal_entries", "date", false),
    fetchOptionalTable(client, userId, "journal_error_types", "position", true),
    fetchOptionalTable(client, userId, "journal_deleted_default_error_types", "deleted_at", true, "type_id"),
    fetchOptionalTable(client, userId, "journal_strategies", "position", true),
  ]);

  return {
    firms: unwrapRows(firmsResult).map(fromDbFirm),
    accounts: unwrapRows(accountsResult).map(fromDbAccount),
    movements: unwrapRows(movementsResult).map(fromDbMovement),
    journalEntries: await signJournalMedia(client, unwrapRows(journalEntriesResult).map(fromDbJournalEntry)),
    journalErrorTypes: unwrapRows(journalErrorTypesResult).map(fromDbJournalErrorType),
    deletedDefaultErrorTypeIds: unwrapRows(deletedDefaultsResult).map((row) => String(row.type_id)),
    journalStrategies: unwrapRows(journalStrategiesResult).map(fromDbJournalStrategy),
  };
}

export async function createCloudFirm(client: SupabaseClient, userId: string, input: FirmInput): Promise<Firm> {
  const result = await client
    .from("firms")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      type: input.type,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();

  return fromSingleRow(result, fromDbFirm, "No se pudo crear la empresa.");
}

export async function updateCloudFirm(
  client: SupabaseClient,
  userId: string,
  firmId: string,
  input: FirmInput,
): Promise<Firm> {
  const result = await client
    .from("firms")
    .update({
      name: input.name.trim(),
      type: input.type,
      notes: input.notes?.trim() || null,
    })
    .eq("id", firmId)
    .eq("user_id", userId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbFirm, "No se pudo actualizar la empresa.");
}

export async function deleteCloudFirm(client: SupabaseClient, userId: string, firmId: string): Promise<void> {
  const result = await client.from("firms").delete().eq("id", firmId).eq("user_id", userId);

  if (result.error) {
    throw new Error(result.error.message || "No se pudo eliminar la empresa.");
  }
}

export async function createCloudAccount(client: SupabaseClient, userId: string, input: AccountInput): Promise<TradingAccount> {
  const result = await client
    .from("accounts")
    .insert(accountInputToDb(userId, input))
    .select("*")
    .single();

  return fromSingleRow(result, fromDbAccount, "No se pudo crear la cuenta.");
}

export async function updateCloudAccount(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  input: AccountInput,
): Promise<TradingAccount> {
  const result = await client
    .from("accounts")
    .update(accountInputToDb(userId, input, false))
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbAccount, "No se pudo actualizar la cuenta.");
}

export async function deleteCloudAccount(client: SupabaseClient, userId: string, accountId: string): Promise<void> {
  const result = await client.from("accounts").delete().eq("id", accountId).eq("user_id", userId);

  if (result.error) throw new Error(result.error.message || "No se pudo eliminar la cuenta.");
}

/* Update propio y no un upsert de la fila entera (mismo criterio que
   setCloudJournalErrorTypeActive): accountInputToDb no menciona visible, asi que
   guardar la cuenta desde el formulario normal nunca la pisa. Si esta funcion se
   despliega antes de ejecutar supabase-accounts-visibility.sql, la columna no existe y
   Supabase devuelve error — no hay caida silenciosa a "no hizo nada". */
export async function updateCloudAccountVisibility(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  visible: boolean,
): Promise<TradingAccount> {
  const result = await client
    .from("accounts")
    .update({ visible })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbAccount, "No se pudo actualizar la visibilidad de la cuenta.");
}

export async function createCloudMovement(client: SupabaseClient, userId: string, input: MovementInput): Promise<Movement> {
  const result = await client
    .from("transactions")
    .insert(movementInputToDb(userId, input))
    .select("*")
    .single();

  return fromSingleRow(result, fromDbMovement, "No se pudo crear el movimiento.");
}

/* Varios de una vez, para la importacion del extracto: un solo insert, no uno por fila.
   El id lo pone quien llama (como hace ya la importacion del legado) para poder enlazar
   despues cada movimiento con la cuenta que se cree para el. */
export async function createCloudMovements(
  client: SupabaseClient,
  userId: string,
  items: { id: string; input: MovementInput }[],
): Promise<void> {
  await insertRows(
    client,
    "transactions",
    items.map((item) => ({ id: item.id, ...movementInputToDb(userId, item.input) })),
    "No se pudieron importar los movimientos.",
  );
}

/* Solo la cuenta, sin tocar el resto del movimiento: es lo que hace el alta de cuentas
   que abre la importacion al guardar cada una. */
export async function linkCloudMovementAccount(
  client: SupabaseClient,
  userId: string,
  movementId: string,
  accountId: string,
): Promise<void> {
  const result = await client
    .from("transactions")
    .update({ account_id: accountId })
    .eq("id", movementId)
    .eq("user_id", userId);

  if (result.error) throw new Error(result.error.message || "No se pudo enlazar el movimiento con la cuenta.");
}

export async function updateCloudMovement(
  client: SupabaseClient,
  userId: string,
  movementId: string,
  input: MovementInput,
): Promise<Movement> {
  const result = await client
    .from("transactions")
    .update(movementInputToDb(userId, input, false))
    .eq("id", movementId)
    .eq("user_id", userId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbMovement, "No se pudo actualizar el movimiento.");
}

export async function deleteCloudMovement(client: SupabaseClient, userId: string, movementId: string): Promise<void> {
  const result = await client.from("transactions").delete().eq("id", movementId).eq("user_id", userId);

  if (result.error) throw new Error(result.error.message || "No se pudo eliminar el movimiento.");
}

export async function createCloudJournalEntry(
  client: SupabaseClient,
  userId: string,
  input: JournalEntryInput,
): Promise<JournalEntry> {
  const media = await resolveJournalMedia(client, userId, input.operationUrl);
  const result = await client
    .from("journal_entries")
    .insert({ ...journalEntryInputToDb(userId, input), ...media.columns })
    .select("*")
    .single();

  if (result.error) await removeJournalMedia(client, [media.uploadedPath]);
  return fromSingleRow(result, fromDbJournalEntry, "No se pudo crear el trade del journal.");
}

export async function updateCloudJournalEntry(
  client: SupabaseClient,
  userId: string,
  entryId: string,
  input: JournalEntryInput,
): Promise<JournalEntry> {
  const previous = JOURNAL_MEDIA_STORAGE_ENABLED
    ? await client.from("journal_entries").select("media_path").eq("id", entryId).eq("user_id", userId).maybeSingle()
    : { data: null };
  const previousPath = previous.data ? text((previous.data as DbRow).media_path) : "";

  const media = await resolveJournalMedia(client, userId, input.operationUrl);
  const result = await client
    .from("journal_entries")
    .update({ ...journalEntryInputToDb(userId, input, false), ...media.columns })
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (result.error) {
    await removeJournalMedia(client, [media.uploadedPath]);
  } else if (previousPath && previousPath !== (media.columns.media_path ?? null)) {
    await removeJournalMedia(client, [previousPath]);
  }
  return fromSingleRow(result, fromDbJournalEntry, "No se pudo actualizar el trade del journal.");
}

export async function deleteCloudJournalEntry(client: SupabaseClient, userId: string, entryId: string): Promise<void> {
  if (!JOURNAL_MEDIA_STORAGE_ENABLED) {
    const result = await client.from("journal_entries").delete().eq("id", entryId).eq("user_id", userId);
    if (result.error) throw new Error(result.error.message || "No se pudo eliminar el trade del journal.");
    return;
  }

  const result = await client
    .from("journal_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("media_path");

  if (result.error) throw new Error(result.error.message || "No se pudo eliminar el trade del journal.");
  await removeJournalMedia(
    client,
    (result.data || []).map((row) => text((row as DbRow).media_path)),
  );
}

/* Pasa las capturas que siguen en base64 dentro de la fila a Storage, una a una. Lo lanza
   useTrazzaData en segundo plano tras la primera carga, así que cada usuario migra lo suyo
   con sus propios permisos la primera vez que entra con esta versión. Quien no puede
   escribir (prueba caducada) falla en la primera subida y se para: sus capturas se quedan
   donde estaban y se siguen viendo igual. La ruta es fija por entrada, así que si se corta
   a medias la siguiente vez sobrescribe en vez de duplicar. No lanza: devuelve cuántas
   movió y, si se paró, por qué. */
export async function migrateInlineJournalMedia(
  client: SupabaseClient,
  userId: string,
  entries: JournalEntry[],
): Promise<{ moved: number; error?: unknown }> {
  if (!JOURNAL_MEDIA_STORAGE_ENABLED) return { moved: 0 };
  let moved = 0;
  try {
    for (const entry of entries) {
      if (entry.mediaPath || !isInlineImage(entry.operationUrl)) continue;
      const path = `${userId}/inline-${entry.id}.${extensionForImage(entry.operationUrl)}`;
      await uploadJournalMedia(client, path, entry.operationUrl);
      const result = await client
        .from("journal_entries")
        .update({ media_path: path, operation_url: null })
        .eq("id", entry.id)
        .eq("user_id", userId);
      if (result.error) throw new Error(result.error.message || "No se pudo mover la captura a Storage.");
      moved += 1;
    }
    return { moved };
  } catch (error) {
    return { moved, error };
  }
}

/* Qué columnas guarda una captura según lo que traiga operationUrl (ver journalMedia.ts):
   base64 se sube y se guarda su ruta; una URL firmada propia conserva su ruta; lo demás es
   un enlace. Con keepInlineOnUploadError (importar un JSON) una imagen que Storage rechaza
   se queda en base64 en vez de tumbar la importación entera. */
async function resolveJournalMedia(
  client: SupabaseClient,
  userId: string,
  value: string | undefined,
  options: { keepInlineOnUploadError?: boolean } = {},
): Promise<{ columns: { media_path?: string | null; operation_url: string | null }; uploadedPath?: string }> {
  const trimmed = value?.trim() || "";

  /* Con Storage apagado, lo de siempre y sin nombrar media_path: la columna puede no
     existir todavía, y mencionarla haría fallar el guardado. */
  if (!JOURNAL_MEDIA_STORAGE_ENABLED) return { columns: { operation_url: trimmed || null } };

  if (isInlineImage(trimmed)) {
    const path = `${userId}/${createUuid()}.${extensionForImage(trimmed)}`;
    try {
      await uploadJournalMedia(client, path, trimmed);
    } catch (error) {
      if (options.keepInlineOnUploadError) return { columns: { media_path: null, operation_url: trimmed } };
      throw error;
    }
    return { columns: { media_path: path, operation_url: null }, uploadedPath: path };
  }

  const ownPath = mediaPathFromSignedUrl(trimmed, userId);
  if (ownPath) return { columns: { media_path: ownPath, operation_url: null } };

  return { columns: { media_path: null, operation_url: trimmed || null } };
}

export async function upsertCloudJournalErrorType(
  client: SupabaseClient,
  userId: string,
  input: JournalErrorTypeInput,
  typeId?: string,
): Promise<JournalErrorType> {
  const row = journalErrorTypeInputToDb(userId, input, typeId);
  const result = await client
    .from("journal_error_types")
    .upsert(row, { onConflict: "user_id,id" })
    .select("*")
    .single();

  return fromSingleRow(result, fromDbJournalErrorType, "No se pudo guardar el tipo de error.");
}

/* Borrado de verdad, no archivado: el archivado ya existe (setCloudJournalErrorTypeActive)
   y responde a otra necesidad. Quien llama es responsable de comprobar antes que ninguna
   entrada lo use — la app lo bloquea en ese caso, porque las entradas guardan el id del
   tipo y borrarlo dejaria referencias huerfanas que se pintarian como un UUID. */
export async function deleteCloudJournalErrorType(
  client: SupabaseClient,
  userId: string,
  typeId: string,
): Promise<void> {
  const result = await client.from("journal_error_types").delete().eq("user_id", userId).eq("id", typeId);
  if (result.error) throw new Error("No se pudo borrar el tipo de error.");
}

/* Los 8 tipos "por defecto" (defaultJournalErrorTypes, en journalErrors.ts) no son filas
   reales hasta que se tocan por primera vez, y mergeJournalErrorTypes los siembra de
   nuevo en cada carga si no encuentra fila con ese id — asi que borrar uno de verdad
   (deleteCloudJournalErrorType, arriba) no basta: en el siguiente reload() reaparece
   igual que si nunca se hubiera tocado. Este insert es el que hace que se quede borrado:
   mergeJournalErrorTypes se filtra despues contra esta lista en JournalEntriesView. Con
   upsert (ignoreDuplicates) para que sea idempotente si el usuario pulsa borrar dos
   veces seguidas. Si la tabla todavia no existe (migracion sin ejecutar) no revienta:
   el borrado real de journal_error_types ya habra funcionado, solo que sin este
   registro reaparecera en el siguiente reload, igual que antes de esta migracion. */
export async function markDefaultErrorTypeDeleted(client: SupabaseClient, userId: string, typeId: string): Promise<void> {
  const result = await client
    .from("journal_deleted_default_error_types")
    .upsert({ type_id: typeId, user_id: userId }, { ignoreDuplicates: true, onConflict: "user_id,type_id" });
  if (result.error && !isMissingTableError(result.error)) {
    throw new Error("No se pudo registrar el tipo de error por defecto como borrado.");
  }
}

export async function setCloudJournalErrorTypeActive(
  client: SupabaseClient,
  userId: string,
  typeId: string,
  active: boolean,
): Promise<JournalErrorType> {
  const result = await client
    .from("journal_error_types")
    .update({ active })
    .eq("user_id", userId)
    .eq("id", typeId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbJournalErrorType, "No se pudo actualizar el tipo de error.");
}

export async function upsertCloudJournalStrategy(
  client: SupabaseClient,
  userId: string,
  input: JournalStrategyInput,
  strategyId?: string,
): Promise<JournalStrategy> {
  const row = journalStrategyInputToDb(userId, input, strategyId);
  const result = await client
    .from("journal_strategies")
    .upsert(row, { onConflict: "user_id,id" })
    .select("*")
    .single();

  return fromSingleRow(result, fromDbJournalStrategy, "No se pudo guardar la estrategia.");
}

/* Mismo criterio que deleteCloudJournalErrorType: borrado de verdad, y quien llama
   comprueba antes que ninguna entrada la use (la app bloquea el borrado en ese caso). */
export async function deleteCloudJournalStrategy(client: SupabaseClient, userId: string, strategyId: string): Promise<void> {
  const result = await client.from("journal_strategies").delete().eq("user_id", userId).eq("id", strategyId);
  if (result.error) throw new Error("No se pudo borrar la estrategia.");
}

export async function setCloudJournalStrategyActive(
  client: SupabaseClient,
  userId: string,
  strategyId: string,
  active: boolean,
): Promise<JournalStrategy> {
  const result = await client
    .from("journal_strategies")
    .update({ active })
    .eq("user_id", userId)
    .eq("id", strategyId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbJournalStrategy, "No se pudo actualizar la estrategia.");
}

export async function replaceCloudData(client: SupabaseClient, userId: string, imported: AppData): Promise<void> {
  const mapped = mapImportedDataForCloud(userId, imported);

  /* Las capturas del JSON vienen en base64 (la exportación las incrusta): se suben a
     Storage antes de borrar nada, para que un fallo de subida no deje la cuenta vacía. */
  const journalEntries: DbRow[] = [];
  for (const row of mapped.journalEntries) {
    const media = await resolveJournalMedia(client, userId, row.operation_url ?? undefined, { keepInlineOnUploadError: true });
    journalEntries.push({ ...row, ...media.columns });
  }

  await deleteOptionalUserRows(client, "journal_error_types", userId, mapped.journalErrorTypes.length > 0);
  await deleteOptionalUserRows(client, "journal_strategies", userId, mapped.journalStrategies.length > 0);
  await deleteOptionalUserRows(client, "journal_entries", userId, mapped.journalEntries.length > 0);
  await deleteRequiredUserRows(client, "transactions", userId, "No se pudieron eliminar los movimientos actuales.");
  await deleteRequiredUserRows(client, "accounts", userId, "No se pudieron eliminar las cuentas actuales.");
  await deleteRequiredUserRows(client, "firms", userId, "No se pudieron eliminar las empresas actuales.");

  // A partir de aqui los datos anteriores ya no existen y Supabase no ejecuta esto como
  // una transaccion. Si un insert falla, la cuenta queda a medias: el mensaje tiene que
  // decirlo y remitir a la copia, no sugerir que no ha pasado nada.
  try {
    await insertRows(client, "firms", mapped.firms, "No se pudieron importar las empresas.");
    await insertRows(client, "accounts", mapped.accounts, "No se pudieron importar las cuentas.");
    await insertRows(client, "transactions", mapped.movements, "No se pudieron importar los movimientos.");
    await insertRows(client, "journal_entries", journalEntries, "No se pudieron importar los trades del journal.");
    await insertRows(client, "journal_error_types", mapped.journalErrorTypes, "No se pudieron importar los tipos de error.");
    await insertRows(client, "journal_strategies", mapped.journalStrategies, "No se pudieron importar las estrategias.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `La importacion fallo despues de borrar los datos anteriores. Vuelve a importar el archivo de copia que se descargo automaticamente al empezar. Detalle: ${detail}`,
    );
  }

  /* Las entradas anteriores ya no existen: sus capturas, salvo las que el JSON reutiliza,
     se quedarían en Storage sin que nada las apunte. Va a mejor esfuerzo, como todo
     borrado de capturas: la importación ya ha terminado bien. */
  if (!JOURNAL_MEDIA_STORAGE_ENABLED) return;
  try {
    const referenced = new Set(journalEntries.map((row) => text(row.media_path)).filter(Boolean));
    const stored = await listJournalMedia(client, userId);
    await removeJournalMedia(
      client,
      stored.filter((path) => !referenced.has(path)),
    );
  } catch (error) {
    console.warn("No se pudieron limpiar las capturas sin uso tras importar.", error);
  }
}

function unwrapRows(result: QueryResult) {
  if (result.error) throw new Error(result.error.message || "No se pudieron cargar los datos.");
  return result.data || [];
}

function fromSingleRow<T>(
  result: { data: DbRow | null; error: { message?: string } | null },
  mapper: (row: DbRow) => T,
  fallbackMessage: string,
) {
  if (result.error) throw new Error(result.error.message || fallbackMessage);
  if (!result.data) throw new Error(fallbackMessage);
  return mapper(result.data);
}

/* PostgREST corta cada respuesta en max_rows (1.000 por defecto en Supabase) sin dar
   ningún error: una tabla con más filas llegaba truncada en silencio, y una importación
   grande de Tradovate o del banco lo alcanza. Se pide por páginas hasta que una vuelve
   incompleta. Si algún día se baja max_rows en Supabase, PAGE_SIZE tiene que bajar con
   él: con una página más corta que PAGE_SIZE el bucle creería haber llegado al final.
   El orden de cada consulta lleva un desempate único (id), o una fila podría salir en
   dos páginas, o en ninguna, cuando varias comparten fecha. */
const PAGE_SIZE = 1000;

type RangeableQuery = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: QueryResult["error"] }>;
};

async function fetchAllRows(build: () => RangeableQuery): Promise<QueryResult> {
  const rows: DbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await build().range(from, from + PAGE_SIZE - 1);
    if (result.error) return { data: null, error: result.error };
    const page = (result.data || []) as DbRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

async function fetchOptionalTable(
  client: SupabaseClient,
  userId: string,
  table: string,
  orderColumn: string,
  ascending: boolean,
  tieBreaker = "id",
): Promise<QueryResult> {
  const result = await fetchAllRows(() =>
    client.from(table).select("*").eq("user_id", userId).order(orderColumn, { ascending }).order(tieBreaker),
  );

  if (!result.error || !isMissingTableError(result.error)) return result;

  return { data: [], error: null };
}

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = String(error.message || "");
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("Could not find the table")
  );
}

function fromDbFirm(row: DbRow): Firm {
  return {
    id: text(row.id),
    name: text(row.name) || "Empresa sin nombre",
    type: normalizeFirmType(row.type),
    notes: text(row.notes),
  };
}

function fromDbAccount(row: DbRow): TradingAccount {
  const rawSize = row.size;
  const phaseTarget = numberOrZero(row.phase_target);

  return {
    id: text(row.id),
    firmId: text(row.firm_id),
    name: text(row.name) || "Cuenta sin nombre",
    status: normalizeAccountStatus(row.status),
    kind: normalizeAccountKind(row.kind, phaseTarget),
    drawdownType: normalizeDrawdownType(row.drawdown_type),
    parentAccountId: text(row.parent_account_id) || undefined,
    size: parseAccountSizeAmount(rawSize),
    sizeLabel: text(rawSize),
    purchasedAt: text(row.purchased_at),
    phaseTarget,
    maxDrawdown: numberOrZero(row.max_drawdown),
    dailyDrawdown: numberOrZero(row.daily_drawdown),
    /* undefined y no 0 cuando la columna viene a null o no existe todavia (antes de
       ejecutar supabase-accounts-payout-rules.sql): la regla no esta puesta, que no es
       lo mismo que tenerla a cero. numberOrZero borraria esa diferencia. */
    consistencyPct: undefinedNumber(row.consistency_pct),
    minProfitDays: undefinedNumber(row.min_profit_days),
    profitDayMin: undefinedNumber(row.profit_day_min),
    payoutMin: undefinedNumber(row.payout_min),
    withdrawMinProfit: undefinedNumber(row.withdraw_min_profit),
    trailLockOffset: undefinedNumber(row.trail_lock_offset),
    /* Solo false cuenta como oculta: una fila sin la columna (antes de ejecutar
       supabase-accounts-visibility.sql, o escrita por una version vieja de la app) o con
       null se lee como visible, igual que hace el legado. */
    visible: row.visible !== false,
  };
}

function fromDbMovement(row: DbRow): Movement {
  return {
    id: text(row.id),
    date: text(row.date),
    kind: normalizeMovementKind(row.kind),
    category: normalizeMovementCategory(row.category),
    amount: numberOrZero(row.amount),
    payoutGrossAmount: nullablePositiveNumber(row.payout_gross_amount),
    payoutProfitSplit: nullablePositiveNumber(row.payout_profit_split),
    firmId: text(row.firm_id),
    accountId: text(row.account_id) || undefined,
    note: text(row.note),
  };
}

function fromDbJournalEntry(row: DbRow): JournalEntry {
  return {
    id: text(row.id),
    date: text(row.date),
    firmId: text(row.firm_id),
    accountId: text(row.account_id),
    symbol: text(row.title) || "Operacion",
    direction: normalizeJournalDirection(row.trade_direction),
    pnl: numberOrZero(row.pnl),
    rMultiple: 0,
    discipline: numberOrZero(row.discipline),
    emotion: normalizeJournalEmotion(row.emotion),
    errors: stringArray(row.errors),
    strategyId: text(row.strategy_id) || undefined,
    operationUrl: text(row.operation_url),
    mediaPath: text(row.media_path) || undefined,
    result: normalizeJournalResult(row.result),
    sessionType: normalizeJournalSessionType(row.session_type),
    tradingSession: normalizeJournalTradingSession(row.trading_session),
    notes: text(row.notes) || text(row.lesson),
    lesson: text(row.lesson),
  };
}

function fromDbJournalErrorType(row: DbRow): JournalErrorType {
  const severity = text(row.severity);
  return {
    active: row.active === undefined ? true : Boolean(row.active),
    color: normalizeHexColor(text(row.color)) || "#64748b",
    id: text(row.id),
    label: text(row.label) || "Error sin nombre",
    position: numberOrZero(row.position),
    /* Se deja sin definir si la fila no la trae, en vez de poner un valor por defecto:
       undefined significa "deducela del color", que es lo que hacen las dos apps con las
       filas antiguas. Un defecto aqui congelaria una deduccion como si fuera un dato. */
    severity: severity === "minor" || severity === "moderate" || severity === "severe" ? severity : undefined,
  };
}

function fromDbJournalStrategy(row: DbRow): JournalStrategy {
  return {
    active: row.active === undefined ? true : Boolean(row.active),
    id: text(row.id),
    label: text(row.label) || "Estrategia sin nombre",
    position: numberOrZero(row.position),
  };
}

function accountInputToDb(userId: string, input: AccountInput, includeUser = true) {
  return {
    ...(includeUser ? { user_id: userId } : {}),
    firm_id: input.firmId || null,
    name: input.name.trim(),
    size: input.size.trim() || null,
    status: input.status,
    kind: input.kind,
    drawdown_type: input.kind === "own" ? null : input.drawdownType,
    parent_account_id: input.kind === "funded" ? input.parentAccountId || null : null,
    purchased_at: input.purchasedAt || null,
    phase_target: input.kind === "challenge" ? nullableNumber(input.phaseTarget) : null,
    max_drawdown: input.kind === "own" ? null : nullableNumber(input.maxDrawdown),
    daily_drawdown: input.kind === "own" ? null : nullableNumber(input.dailyDrawdown),
    /* Reglas de cobro. En capital propio no hay firma que las imponga, y el minimo para
       cobrar solo tiene sentido en una fondeada: en una evaluacion el umbral es el
       objetivo, que ya vive en phase_target. Se limpian al cambiar de tipo por lo mismo
       que phase_target y los drawdowns — una cuenta que pasa a capital propio no debe
       arrastrar reglas invisibles que el formulario ya no ensena. */
    consistency_pct: input.kind === "own" ? null : nullableNumber(input.consistencyPct),
    min_profit_days: input.kind === "own" ? null : nullableNumber(input.minProfitDays),
    profit_day_min: input.kind === "own" ? null : nullableNumber(input.profitDayMin),
    payout_min: input.kind === "funded" ? nullableNumber(input.payoutMin) : null,
    /* El beneficio para retirar, como el minimo del ciclo, solo existe en una fondeada. El
       bloqueo del trailing es propiedad del drawdown, asi que vive donde vive el drawdown:
       en todo lo que no es capital propio, y solo si es trailing (en uno estatico no hay
       nada que se bloquee). */
    withdraw_min_profit: input.kind === "funded" ? nullableNumber(input.withdrawMinProfit) : null,
    trail_lock_offset:
      input.kind !== "own" && input.drawdownType === "trailing" ? nullableNumber(input.trailLockOffset) : null,
  };
}

function movementInputToDb(userId: string, input: MovementInput, includeUser = true) {
  return {
    ...(includeUser ? { user_id: userId } : {}),
    firm_id: input.firmId || null,
    account_id: input.accountId || null,
    date: input.date,
    kind: input.kind,
    category: input.category,
    amount: input.amount,
    payout_gross_amount: input.category === "payout" ? nullableNumber(input.payoutGrossAmount) : null,
    payout_profit_split: input.category === "payout" ? nullableNumber(input.payoutProfitSplit) : null,
    note: input.note?.trim() || null,
  };
}

function journalEntryInputToDb(userId: string, input: JournalEntryInput, includeUser = true) {
  return {
    ...(includeUser ? { user_id: userId } : {}),
    firm_id: input.firmId || null,
    account_id: input.accountId || null,
    date: input.date,
    title: input.symbol.trim(),
    trade_direction: input.direction === "none" ? null : input.direction,
    trading_session: input.tradingSession,
    session_type: input.sessionType,
    result: input.result,
    emotion: input.emotion,
    discipline: input.discipline,
    pnl: input.pnl,
    errors: stringArray(input.errors),
    strategy_id: input.strategyId || null,
    operation_url: input.operationUrl?.trim() || null,
    notes: input.notes?.trim() || null,
    lesson: input.lesson?.trim() || null,
  };
}

function journalErrorTypeInputToDb(userId: string, input: JournalErrorTypeInput, typeId?: string) {
  const label = input.label.trim();
  return {
    user_id: userId,
    id: typeId || createSlug(label),
    label,
    color: normalizeHexColor(input.color) || "#64748b",
    position: nullableNumber(input.position) ?? 1000,
    active: input.active ?? true,
    severity: input.severity ?? null,
  };
}

function journalStrategyInputToDb(userId: string, input: JournalStrategyInput, strategyId?: string) {
  const label = input.label.trim();
  return {
    user_id: userId,
    id: strategyId || createSlug(label),
    label,
    position: nullableNumber(input.position) ?? 1000,
    active: input.active ?? true,
  };
}

function mapImportedDataForCloud(userId: string, imported: AppData) {
  const firmIds = new Map<string, string>();
  const accountIds = new Map<string, string>();
  const strategyIds = new Map(imported.journalStrategies.map((strategy) => [strategy.id, strategy.id]));

  const firms = imported.firms
    .filter((firm) => firm.name.trim())
    .map((firm) => {
      const id = createUuid();
      firmIds.set(firm.id, id);
      return {
        id,
        user_id: userId,
        name: firm.name.trim(),
        type: normalizeFirmType(firm.type),
        notes: firm.notes?.trim() || null,
      };
    });

  const accounts = imported.accounts
    .filter((account) => account.name.trim())
    .map((account) => {
      const id = createUuid();
      accountIds.set(account.id, id);
      return {
        id,
        user_id: userId,
        firm_id: firmIds.get(account.firmId) || null,
        name: account.name.trim(),
        size: account.sizeLabel || String(account.size || ""),
        status: normalizeAccountStatus(account.status),
        // parent_account_id no se puede reconstruir de un import: el enlace se hace a
        // mano despues, desde el selector de cuenta de origen o via SQL.
        kind: normalizeAccountKind(account.kind, nullableNumber(account.phaseTarget) ?? 0),
        drawdown_type: "static",
        parent_account_id: null,
        purchased_at: account.purchasedAt || null,
        phase_target: nullableNumber(account.phaseTarget),
        max_drawdown: nullableNumber(account.maxDrawdown),
        daily_drawdown: nullableNumber(account.dailyDrawdown),
      };
    });

  const accountFirmIds = new Map(accounts.map((account) => [account.id, account.firm_id]));
  const movements = imported.movements
    .filter((movement) => movement.date && movement.amount > 0)
    .map((movement) => {
      const accountId = movement.accountId ? accountIds.get(movement.accountId) || null : null;
      return {
        id: createUuid(),
        user_id: userId,
        firm_id: accountId ? accountFirmIds.get(accountId) || null : firmIds.get(movement.firmId) || null,
        account_id: accountId,
        date: movement.date,
        kind: normalizeMovementKind(movement.kind),
        category: normalizeMovementCategory(movement.category),
        amount: Math.abs(movement.amount),
        payout_gross_amount: movement.category === "payout" ? nullableNumber(movement.payoutGrossAmount) : null,
        payout_profit_split: movement.category === "payout" ? nullableNumber(movement.payoutProfitSplit) : null,
        note: movement.note?.trim() || null,
      };
    });

  const journalEntries = imported.journalEntries
    .filter((entry) => entry.date && entry.symbol.trim())
    .map((entry) => {
      const accountId = entry.accountId ? accountIds.get(entry.accountId) || null : null;
      const firmId = accountId ? accountFirmIds.get(accountId) || null : firmIds.get(entry.firmId || "") || null;
      const direction = normalizeJournalDirection(entry.direction);
      return {
        id: createUuid(),
        user_id: userId,
        firm_id: firmId,
        account_id: accountId,
        date: entry.date,
        title: entry.symbol.trim(),
        trade_direction: direction === "none" ? null : direction,
        trading_session: normalizeJournalTradingSession(entry.tradingSession),
        session_type: normalizeJournalSessionType(entry.sessionType),
        result: normalizeJournalResult(entry.result),
        emotion: normalizeJournalEmotion(entry.emotion),
        discipline: clampNumber(Math.round(entry.discipline), 1, 5),
        pnl: entry.pnl,
        errors: stringArray(entry.errors),
        strategy_id: entry.strategyId ? strategyIds.get(entry.strategyId) || null : null,
        operation_url: entry.operationUrl?.trim() || null,
        notes: entry.notes?.trim() || null,
        lesson: entry.lesson?.trim() || null,
      };
    });

  const journalErrorTypes = imported.journalErrorTypes.map((type, index) => ({
    user_id: userId,
    id: type.id,
    label: type.label.trim(),
    color: normalizeHexColor(type.color) || "#64748b",
    position: Number.isFinite(type.position) ? type.position : (index + 1) * 10,
    active: type.active,
  }));

  const journalStrategies = imported.journalStrategies.map((strategy, index) => ({
    user_id: userId,
    id: strategy.id,
    label: strategy.label.trim(),
    position: Number.isFinite(strategy.position) ? strategy.position : (index + 1) * 10,
    active: strategy.active,
  }));

  return { accounts, firms, journalEntries, journalErrorTypes, journalStrategies, movements };
}

async function deleteRequiredUserRows(client: SupabaseClient, table: string, userId: string, fallbackMessage: string) {
  const result = await client.from(table).delete().eq("user_id", userId);
  if (result.error) throw new Error(result.error.message || fallbackMessage);
}

async function deleteOptionalUserRows(client: SupabaseClient, table: string, userId: string, required: boolean) {
  const result = await client.from(table).delete().eq("user_id", userId);
  if (!result.error) return;
  if (!required && isMissingTableError(result.error)) return;
  throw new Error(result.error.message || `No se pudieron eliminar los datos de ${table}.`);
}

async function insertRows(client: SupabaseClient, table: string, rows: DbRow[], fallbackMessage: string) {
  if (!rows.length) return;
  const result = await client.from(table).insert(rows);
  if (result.error) {
    if (table === "journal_entries" && isMissingTableError(result.error)) {
      throw new Error("Crea la tabla journal_entries en Supabase antes de importar trades del journal.");
    }
    if (table === "journal_error_types" && isMissingTableError(result.error)) {
      throw new Error("Crea la tabla journal_error_types en Supabase antes de importar tipos de error.");
    }
    throw new Error(result.error.message || fallbackMessage);
  }
}

export function createUuid() {
  const runtimeCrypto = globalThis.crypto;
  if (runtimeCrypto?.randomUUID) return runtimeCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (runtimeCrypto?.getRandomValues) {
    runtimeCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeFirmType(value: unknown): FirmType {
  const normalized = text(value) as FirmType;
  return firmTypes.has(normalized) ? normalized : "other";
}

function normalizeAccountStatus(value: unknown): AccountStatus {
  const normalized = text(value) as AccountStatus;
  return accountStatuses.has(normalized) ? normalized : "active";
}

// Sin kind guardado (filas de antes de la migracion), se deriva igual que hace el
// relleno del SQL: con objetivo de fase es un challenge, si no una fondeada.
function normalizeAccountKind(value: unknown, phaseTarget: number): AccountKind {
  const normalized = text(value) as AccountKind;
  if (accountKinds.has(normalized)) return normalized;
  return phaseTarget > 0 ? "challenge" : "funded";
}

function normalizeDrawdownType(value: unknown): DrawdownType {
  const normalized = text(value) as DrawdownType;
  return drawdownTypes.has(normalized) ? normalized : "static";
}

function normalizeMovementKind(value: unknown): MovementKind {
  const normalized = text(value) as MovementKind;
  return movementKinds.has(normalized) ? normalized : "expense";
}

function normalizeMovementCategory(value: unknown): MovementCategory {
  const normalized = text(value) as MovementCategory;
  return movementCategories.has(normalized) ? normalized : "other";
}

function normalizeJournalDirection(value: unknown): JournalDirection {
  const normalized = text(value) as JournalDirection;
  return journalDirections.has(normalized) ? normalized : "none";
}

function normalizeJournalTradingSession(value: unknown): JournalTradingSession {
  const normalized = text(value) as JournalTradingSession;
  return journalTradingSessions.has(normalized) ? normalized : "other";
}

function normalizeJournalSessionType(value: unknown): JournalSessionType {
  const normalized = text(value) as JournalSessionType;
  return journalSessionTypes.has(normalized) ? normalized : "trading-day";
}

function normalizeJournalResult(value: unknown): JournalResult {
  const normalized = text(value) as JournalResult;
  return journalResults.has(normalized) ? normalized : "neutral";
}

function normalizeJournalEmotion(value: unknown): JournalEmotion {
  const normalized = text(value) as JournalEmotion;
  return journalEmotions.has(normalized) ? normalized : "focused";
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function createSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `error-${createUuid().slice(0, 8)}`;
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : "";
}

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nullablePositiveNumber(value: unknown) {
  const number = nullableNumber(value);
  return number !== null && number > 0 ? number : undefined;
}

function stringArray(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  return [...new Set(source.map((item) => text(item)).filter(Boolean))];
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/* Como nullableNumber pero hacia la app, que distingue "sin regla" con undefined y no
   con null (el resto de campos opcionales de TradingAccount ya son undefined). */
function undefinedNumber(value: unknown) {
  return nullableNumber(value) ?? undefined;
}

export function parseAccountSizeAmount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const source = text(value);
  const match = source.match(/(\d[\d.,]*)\s*([km])?/i);
  if (!match) return 0;

  const numeric = normalizeFlexibleNumber(match[1]);
  const suffix = (match[2] || "").toLowerCase();
  const multiplier = suffix === "m" ? 1000000 : suffix === "k" ? 1000 : 1;

  return numeric * multiplier;
}

function normalizeFlexibleNumber(value: string) {
  const source = value.replace(/[^\d.,-]/g, "");
  const lastComma = source.lastIndexOf(",");
  const lastDot = source.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(source.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma !== -1) {
    const parts = source.split(",");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? source.replaceAll(",", "") : source.replace(",", "."));
  }

  if (lastDot !== -1) {
    const parts = source.split(".");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? source.replaceAll(".", "") : source);
  }

  return Number(source);
}
