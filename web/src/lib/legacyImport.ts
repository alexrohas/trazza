import type {
  AccountKind,
  AccountStatus,
  AppData,
  FirmType,
  JournalDirection,
  JournalEmotion,
  JournalResult,
  JournalSessionType,
  JournalTradingSession,
  MovementCategory,
  MovementKind,
} from "../types";
import { normalizeJournalErrorTypes } from "./journalErrors";
import { safeLocalGet, safeLocalSet } from "./storage";

const storageKeys = ["trazza:v1", "finix:v1", "prop-firm-tracker:v1"];
const backupStorageKey = "trazza:local-backup-before-react-cloud";
const migratedStorageKey = "trazza:local-migrated-to-react-cloud";

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
const directions = new Set<JournalDirection>(["long", "short", "none"]);
const tradingSessions = new Set<JournalTradingSession>(["asia", "london", "newYork", "londonNewYork", "other"]);
const sessionTypes = new Set<JournalSessionType>([
  "trading-day",
  "evaluation",
  "funded",
  "payout-day",
  "news-day",
  "review",
  "other",
]);
const results = new Set<JournalResult>(["good", "neutral", "bad"]);
const emotions = new Set<JournalEmotion>(["calm", "focused", "anxious", "impatient", "fomo", "revenge", "tired", "other"]);

export type LocalMigrationSource = {
  key: string;
  raw: string;
  summary: string;
};

export function findLocalMigrationSource(): LocalMigrationSource | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(migratedStorageKey)) return null;

  for (const key of [backupStorageKey, ...storageKeys]) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const data = parseTrazzaImport(raw);
      if (!hasImportData(data)) continue;
      return {
        key,
        raw,
        summary: summarizeImportData(data),
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function markLocalMigrationComplete(source?: LocalMigrationSource | null) {
  if (typeof window === "undefined") return;
  // Se llama despues de una importacion que ya ha ido bien. `source.raw` puede ser el
  // dataset legado entero, asi que es justo el tipo de escritura que revienta la cuota:
  // si fallara sin proteger, tumbaria el flujo y pareceria que la importacion fallo.
  if (source?.raw && !safeLocalGet(backupStorageKey)) {
    safeLocalSet(backupStorageKey, source.raw);
  }
  safeLocalSet(migratedStorageKey, new Date().toISOString());
}

export function parseTrazzaImport(raw: string): AppData {
  const parsed = JSON.parse(raw) as unknown;
  const source = unwrapPayload(parsed);

  const firms = arrayOf(source.firms)
    .map((firm) => ({
      id: text(firm.id) || createStableClientId("firm"),
      name: text(firm.name) || text(firm.label),
      notes: text(firm.notes),
      type: normalizeFirmType(firm.type),
    }))
    .filter((firm) => firm.name);

  const firmIds = new Set(firms.map((firm) => firm.id));
  const accounts = arrayOf(source.accounts)
    .map((account) => {
      const sizeLabel = text(account.sizeLabel) || text(account.size);
      const phaseTarget = parseFlexibleNumber(account.phaseTarget ?? account.phase_target);
      return {
        id: text(account.id) || createStableClientId("account"),
        firmId: text(account.firmId) || text(account.firm_id),
        name: text(account.name) || text(account.label),
        status: normalizeAccountStatus(account.status),
        kind: deriveAccountKind(phaseTarget),
        drawdownType: "static" as const,
        size: parseFlexibleNumber(sizeLabel),
        sizeLabel,
        purchasedAt: normalizeDate(text(account.purchasedAt) || text(account.purchased_at)),
        phaseTarget,
        maxDrawdown: parseFlexibleNumber(account.maxDrawdown ?? account.max_drawdown),
        dailyDrawdown: parseFlexibleNumber(account.dailyDrawdown ?? account.daily_drawdown),
      };
    })
    .filter((account) => account.name && (!account.firmId || firmIds.has(account.firmId)));

  const accountIds = new Set(accounts.map((account) => account.id));
  const movementsSource = arrayOf(source.movements).length ? arrayOf(source.movements) : arrayOf(source.transactions);
  const movements = movementsSource
    .map((movement) => ({
      id: text(movement.id) || createStableClientId("movement"),
      date: normalizeDate(text(movement.date)),
      kind: normalizeMovementKind(movement.kind),
      category: normalizeMovementCategory(movement.category),
      amount: Math.abs(parseFlexibleNumber(movement.amount)),
      payoutGrossAmount: parseOptionalPositiveNumber(movement.payoutGrossAmount ?? movement.payout_gross_amount),
      payoutProfitSplit: parseOptionalPositiveNumber(movement.payoutProfitSplit ?? movement.payout_profit_split),
      firmId: text(movement.firmId) || text(movement.firm_id),
      accountId: text(movement.accountId) || text(movement.account_id) || undefined,
      note: text(movement.note) || text(movement.notes),
    }))
    .filter((movement) => movement.date && movement.amount > 0)
    .map((movement) => ({
      ...movement,
      accountId: movement.accountId && accountIds.has(movement.accountId) ? movement.accountId : undefined,
      firmId: movement.firmId && firmIds.has(movement.firmId) ? movement.firmId : "",
    }));

  const journalEntries = arrayOf(source.journalEntries)
    .map((entry) => ({
      id: text(entry.id) || createStableClientId("journal"),
      date: normalizeDate(text(entry.date)),
      firmId: text(entry.firmId) || text(entry.firm_id),
      accountId: text(entry.accountId) || text(entry.account_id),
      symbol: (text(entry.symbol) || text(entry.title) || text(entry.asset) || "TRADE").toUpperCase(),
      direction: normalizeDirection(entry.direction ?? entry.tradeDirection ?? entry.trade_direction),
      pnl: parseFlexibleNumber(entry.pnl),
      rMultiple: parseFlexibleNumber(entry.rMultiple ?? entry.r_multiple),
      discipline: normalizeDiscipline(entry.discipline),
      emotion: normalizeEmotion(entry.emotion),
      errors: normalizeStringArray(entry.errors),
      operationUrl: text(entry.operationUrl) || text(entry.operation_url),
      result: normalizeResult(entry.result, parseFlexibleNumber(entry.pnl)),
      sessionType: normalizeSessionType(entry.sessionType ?? entry.session_type),
      tradingSession: normalizeTradingSession(entry.tradingSession ?? entry.trading_session ?? entry.session),
      notes: text(entry.notes),
      lesson: text(entry.lesson),
    }))
    .filter((entry) => entry.date)
    .map((entry) => ({
      ...entry,
      accountId: accountIds.has(entry.accountId) ? entry.accountId : "",
      firmId: entry.firmId && firmIds.has(entry.firmId) ? entry.firmId : undefined,
    }));
  const journalErrorTypes = normalizeJournalErrorTypes(
    arrayOf(source.journalErrorTypes).length ? source.journalErrorTypes : source.errorTypes,
  );

  return {
    accounts,
    firms,
    journalEntries,
    journalErrorTypes,
    movements,
  };
}

export function summarizeImportData(data: AppData) {
  return `${data.firms.length} empresas, ${data.accounts.length} cuentas, ${data.movements.length} movimientos, ${data.journalEntries.length} entradas y ${data.journalErrorTypes.length} tipos de error`;
}

export function hasImportData(data: AppData) {
  return Boolean(
    data.firms.length ||
      data.accounts.length ||
      data.movements.length ||
      data.journalEntries.length ||
      data.journalErrorTypes.length,
  );
}

function unwrapPayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("El archivo no es un JSON valido de Trazza.");
  const data = isRecord(value.data) ? value.data : value;
  if (!isRecord(data)) throw new Error("El archivo no contiene datos validos.");
  return data;
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeFirmType(value: unknown): FirmType {
  const normalized = text(value).toLowerCase();
  if (firmTypes.has(normalized as FirmType)) return normalized as FirmType;
  if (["futuro", "futuros", "future", "prop firm"].includes(normalized)) return "futures";
  if (["forex", "fx"].includes(normalized)) return "forex";
  if (["crypto", "cripto"].includes(normalized)) return "crypto";
  return "other";
}

function normalizeAccountStatus(value: unknown): AccountStatus {
  const normalized = text(value).toLowerCase() as AccountStatus;
  return accountStatuses.has(normalized) ? normalized : "active";
}

// El export legado no conoce kind: se deriva igual que hace el relleno del SQL (con
// objetivo de fase es un challenge, si no una fondeada).
function deriveAccountKind(phaseTarget: number): AccountKind {
  return phaseTarget > 0 ? "challenge" : "funded";
}

function normalizeMovementKind(value: unknown): MovementKind {
  const normalized = text(value).toLowerCase() as MovementKind;
  if (movementKinds.has(normalized)) return normalized;
  return parseFlexibleNumber(value) < 0 ? "expense" : "income";
}

function normalizeMovementCategory(value: unknown): MovementCategory {
  const normalized = text(value).toLowerCase() as MovementCategory;
  return movementCategories.has(normalized) ? normalized : "other";
}

function normalizeDirection(value: unknown): JournalDirection {
  const normalized = text(value).toLowerCase() as JournalDirection;
  return directions.has(normalized) ? normalized : "none";
}

function normalizeTradingSession(value: unknown): JournalTradingSession {
  const normalized = text(value).toLowerCase();
  if (tradingSessions.has(normalized as JournalTradingSession)) return normalized as JournalTradingSession;
  if (normalized === "new york" || normalized === "ny") return "newYork";
  if (normalized === "londonny" || normalized === "londresny") return "londonNewYork";
  return "newYork";
}

function normalizeSessionType(value: unknown): JournalSessionType {
  const normalized = text(value).toLowerCase() as JournalSessionType;
  return sessionTypes.has(normalized) ? normalized : "trading-day";
}

function normalizeResult(value: unknown, pnl: number): JournalResult {
  const normalized = text(value).toLowerCase() as JournalResult;
  if (results.has(normalized)) return normalized;
  if (pnl > 0) return "good";
  if (pnl < 0) return "bad";
  return "neutral";
}

function normalizeEmotion(value: unknown): JournalEmotion {
  const normalized = text(value).toLowerCase() as JournalEmotion;
  return emotions.has(normalized) ? normalized : "focused";
}

function normalizeDiscipline(value: unknown) {
  const parsed = Math.round(parseFlexibleNumber(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  const scaled = parsed > 5 ? Math.ceil(parsed / 2) : parsed;
  return Math.min(5, Math.max(1, scaled));
}

function normalizeDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function parseFlexibleNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const source = text(value).replace(/[^\d.,-]/g, "");
  if (!source) return 0;
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

function parseOptionalPositiveNumber(value: unknown) {
  const number = parseFlexibleNumber(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  return [...new Set(source.map((item) => text(item)).filter(Boolean))];
}

function createStableClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
