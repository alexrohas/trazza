import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountStatus,
  AccountInput,
  AppData,
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
  JournalTradingSession,
  Movement,
  MovementCategory,
  MovementInput,
  MovementKind,
  TradingAccount,
} from "../types";

type DbRow = Record<string, unknown>;

type QueryResult = {
  data: DbRow[] | null;
  error: { code?: string; message?: string } | null;
};

const firmTypes = new Set<FirmType>(["futures", "forex", "crypto", "other"]);
const accountStatuses = new Set<AccountStatus>(["active", "evaluation", "passed", "funded", "failed", "closed"]);
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
  const [firmsResult, accountsResult, movementsResult, journalEntriesResult, journalErrorTypesResult] = await Promise.all([
    client.from("firms").select("*").eq("user_id", userId).order("name", { ascending: true }),
    client.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    client.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: true }),
    fetchOptionalTable(client, userId, "journal_entries", "date", false),
    fetchOptionalTable(client, userId, "journal_error_types", "position", true),
  ]);

  return {
    firms: unwrapRows(firmsResult as QueryResult).map(fromDbFirm),
    accounts: unwrapRows(accountsResult as QueryResult).map(fromDbAccount),
    movements: unwrapRows(movementsResult as QueryResult).map(fromDbMovement),
    journalEntries: unwrapRows(journalEntriesResult).map(fromDbJournalEntry),
    journalErrorTypes: unwrapRows(journalErrorTypesResult).map(fromDbJournalErrorType),
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

export async function createCloudMovement(client: SupabaseClient, userId: string, input: MovementInput): Promise<Movement> {
  const result = await client
    .from("transactions")
    .insert(movementInputToDb(userId, input))
    .select("*")
    .single();

  return fromSingleRow(result, fromDbMovement, "No se pudo crear el movimiento.");
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
  const result = await client
    .from("journal_entries")
    .insert(journalEntryInputToDb(userId, input))
    .select("*")
    .single();

  return fromSingleRow(result, fromDbJournalEntry, "No se pudo crear la entrada de journal.");
}

export async function updateCloudJournalEntry(
  client: SupabaseClient,
  userId: string,
  entryId: string,
  input: JournalEntryInput,
): Promise<JournalEntry> {
  const result = await client
    .from("journal_entries")
    .update(journalEntryInputToDb(userId, input, false))
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("*")
    .single();

  return fromSingleRow(result, fromDbJournalEntry, "No se pudo actualizar la entrada de journal.");
}

export async function deleteCloudJournalEntry(client: SupabaseClient, userId: string, entryId: string): Promise<void> {
  const result = await client.from("journal_entries").delete().eq("id", entryId).eq("user_id", userId);

  if (result.error) throw new Error(result.error.message || "No se pudo eliminar la entrada de journal.");
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

export async function replaceCloudData(client: SupabaseClient, userId: string, imported: AppData): Promise<void> {
  const mapped = mapImportedDataForCloud(userId, imported);

  await deleteOptionalUserRows(client, "journal_error_types", userId, mapped.journalErrorTypes.length > 0);
  await deleteOptionalUserRows(client, "journal_entries", userId, mapped.journalEntries.length > 0);
  await deleteRequiredUserRows(client, "transactions", userId, "No se pudieron eliminar los movimientos actuales.");
  await deleteRequiredUserRows(client, "accounts", userId, "No se pudieron eliminar las cuentas actuales.");
  await deleteRequiredUserRows(client, "firms", userId, "No se pudieron eliminar las empresas actuales.");

  await insertRows(client, "firms", mapped.firms, "No se pudieron importar las empresas.");
  await insertRows(client, "accounts", mapped.accounts, "No se pudieron importar las cuentas.");
  await insertRows(client, "transactions", mapped.movements, "No se pudieron importar los movimientos.");
  await insertRows(client, "journal_entries", mapped.journalEntries, "No se pudieron importar las entradas de journal.");
  await insertRows(client, "journal_error_types", mapped.journalErrorTypes, "No se pudieron importar los tipos de error.");
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

async function fetchOptionalTable(
  client: SupabaseClient,
  userId: string,
  table: string,
  orderColumn: string,
  ascending: boolean,
): Promise<QueryResult> {
  const result = await client
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order(orderColumn, { ascending });

  if (!result.error || !isMissingTableError(result.error)) return result as QueryResult;

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

  return {
    id: text(row.id),
    firmId: text(row.firm_id),
    name: text(row.name) || "Cuenta sin nombre",
    status: normalizeAccountStatus(row.status),
    size: parseAccountSizeAmount(rawSize),
    sizeLabel: text(rawSize),
    purchasedAt: text(row.purchased_at),
    phaseTarget: numberOrZero(row.phase_target),
    maxDrawdown: numberOrZero(row.max_drawdown),
    dailyDrawdown: numberOrZero(row.daily_drawdown),
  };
}

function fromDbMovement(row: DbRow): Movement {
  return {
    id: text(row.id),
    date: text(row.date),
    kind: normalizeMovementKind(row.kind),
    category: normalizeMovementCategory(row.category),
    amount: numberOrZero(row.amount),
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
    operationUrl: text(row.operation_url),
    result: normalizeJournalResult(row.result),
    sessionType: normalizeJournalSessionType(row.session_type),
    tradingSession: normalizeJournalTradingSession(row.trading_session),
    notes: text(row.notes) || text(row.lesson),
    lesson: text(row.lesson),
  };
}

function fromDbJournalErrorType(row: DbRow): JournalErrorType {
  return {
    active: row.active === undefined ? true : Boolean(row.active),
    color: normalizeHexColor(text(row.color)) || "#64748b",
    id: text(row.id),
    label: text(row.label) || "Error sin nombre",
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
    purchased_at: input.purchasedAt || null,
    phase_target: nullableNumber(input.phaseTarget),
    max_drawdown: nullableNumber(input.maxDrawdown),
    daily_drawdown: nullableNumber(input.dailyDrawdown),
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
  };
}

function mapImportedDataForCloud(userId: string, imported: AppData) {
  const firmIds = new Map<string, string>();
  const accountIds = new Map<string, string>();

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

  return { accounts, firms, journalEntries, journalErrorTypes, movements };
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
      throw new Error("Crea la tabla journal_entries en Supabase antes de importar entradas de journal.");
    }
    if (table === "journal_error_types" && isMissingTableError(result.error)) {
      throw new Error("Crea la tabla journal_error_types en Supabase antes de importar tipos de error.");
    }
    throw new Error(result.error.message || fallbackMessage);
  }
}

function createUuid() {
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

function stringArray(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  return [...new Set(source.map((item) => text(item)).filter(Boolean))];
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
