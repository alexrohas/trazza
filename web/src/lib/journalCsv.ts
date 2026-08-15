import type { useT } from "./i18n/context";
import { mergeJournalErrorTypes, getJournalErrorDefinition, sanitizeErrorIds } from "./journalErrors";
import { getAccountName } from "./metrics";
import type { Firm, JournalDirection, JournalEmotion, JournalEntry, JournalErrorType, JournalResult, JournalSessionType, JournalTradingSession, TradingAccount } from "../types";

const journalTradingSessionValues: JournalTradingSession[] = ["asia", "london", "newYork", "londonNewYork", "other"];

function normalizeEntryTradingSession(value: unknown): JournalTradingSession | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (journalTradingSessionValues.includes(raw as JournalTradingSession)) return raw as JournalTradingSession;

  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "-");
  const aliases: Record<string, JournalTradingSession> = {
    asia: "asia",
    asian: "asia",
    londres: "london",
    london: "london",
    "new-york": "newYork",
    newyork: "newYork",
    ny: "newYork",
    "nueva-york": "newYork",
    "london-ny": "londonNewYork",
    "londres-ny": "londonNewYork",
    "london-new-york": "londonNewYork",
    "londres-nueva-york": "londonNewYork",
    other: "other",
  };
  return aliases[key] || "";
}

function getEntryTradingSession(entry: JournalEntry): JournalTradingSession | "" {
  const legacyEntry = entry as JournalEntry & { session?: unknown; trading_session?: unknown };
  return normalizeEntryTradingSession(legacyEntry.tradingSession ?? legacyEntry.trading_session ?? legacyEntry.session);
}

function directionLabel(direction: JournalDirection, t: ReturnType<typeof useT>) {
  if (direction === "long") return t("journal.option.direction.long");
  if (direction === "short") return t("journal.option.direction.short");
  return t("journal.option.direction.none");
}

function resultLabel(result: JournalResult, t: ReturnType<typeof useT>) {
  if (result === "good") return t("journal.option.result.good");
  if (result === "bad") return t("journal.option.result.bad");
  return t("journal.option.result.neutral");
}

function emotionLabel(emotion: JournalEmotion, t: ReturnType<typeof useT>) {
  const key = `journal.option.emotion.${emotion}` as Parameters<typeof t>[0];
  return t(key);
}

function sessionTypeLabel(sessionType: JournalSessionType, t: ReturnType<typeof useT>) {
  const map: Record<JournalSessionType, Parameters<typeof t>[0]> = {
    "trading-day": "journal.option.sessionType.tradingDay",
    evaluation: "journal.option.sessionType.evaluation",
    funded: "journal.option.sessionType.funded",
    "payout-day": "journal.option.sessionType.payoutDay",
    "news-day": "journal.option.sessionType.newsDay",
    review: "journal.option.sessionType.review",
    other: "journal.option.sessionType.other",
  };
  return t(map[sessionType] || "journal.option.sessionType.other");
}

function tradingSessionLabel(entry: JournalEntry, t: ReturnType<typeof useT>) {
  const session = getEntryTradingSession(entry);
  if (!session) return t("journal.session.none");
  const map: Record<JournalTradingSession, Parameters<typeof t>[0]> = {
    asia: "journal.option.session.asia",
    london: "journal.option.session.london",
    newYork: "journal.option.session.newYork",
    londonNewYork: "journal.option.session.londonNewYork",
    other: "journal.option.session.other",
  };
  return t(map[session]);
}

function escapeCsvValue(value: string | number) {
  const source = String(value);
  return /[",\r\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function exportJournalEntriesCsv(
  entries: JournalEntry[],
  accounts: TradingAccount[],
  firms: Firm[],
  errorTypes: JournalErrorType[],
  t: ReturnType<typeof useT>,
) {
  if (!entries.length) return;

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const firmNameById = new Map(firms.map((firm) => [firm.id, firm.name]));
  const effectiveErrorTypes = mergeJournalErrorTypes(errorTypes);

  const header = [
    "date",
    "firm",
    "account",
    "symbol",
    "direction",
    "tradingSession",
    "sessionType",
    "result",
    "emotion",
    "discipline",
    "pnl",
    "errors",
    "operationUrl",
    "notes",
    "lesson",
  ];
  const lines = entries.map((entry) => {
    const firmName =
      firmNameById.get(entry.firmId || "") || firmNameById.get(accountById.get(entry.accountId)?.firmId || "") || t("account.card.noFirm");
    const entryErrors = sanitizeErrorIds(effectiveErrorTypes, entry.errors);

    return [
      entry.date,
      firmName,
      getAccountName(accounts, entry.accountId, t("journal.entryForm.noAccount")),
      entry.symbol,
      directionLabel(entry.direction, t),
      tradingSessionLabel(entry, t),
      sessionTypeLabel(entry.sessionType || "other", t),
      resultLabel(entry.result || "neutral", t),
      emotionLabel(entry.emotion, t),
      entry.discipline,
      entry.pnl,
      entryErrors.map((id) => getJournalErrorDefinition(effectiveErrorTypes, id).label).join(" | "),
      entry.operationUrl || "",
      entry.notes || "",
      entry.lesson || "",
    ]
      .map(escapeCsvValue)
      .join(",");
  });
  const csv = [header.join(","), ...lines].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `trazza-journal-${todayIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
