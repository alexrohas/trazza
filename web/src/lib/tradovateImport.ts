import type { JournalEntryInput, JournalTradingSession, TradingAccount } from "../types";

type TradovateCommissionPreset = {
  label: string;
  match: string[];
  rates: Record<string, number>;
};

const TRADOVATE_COMMISSION_PRESETS: TradovateCommissionPreset[] = [
  {
    label: "Alpha Futures",
    match: ["alpha", "alpha futures", "alpha capital"],
    rates: { MNQ: 1.82, MES: 1.82, NQ: 5.76, ES: 5.76 },
  },
  {
    label: "Lucid",
    match: ["lucid", "lucid trading", "lucid flex"],
    rates: { MNQ: 1, MES: 1, NQ: 3.5, ES: 3.5 },
  },
  {
    label: "Apex",
    match: ["apex", "apex trader funding"],
    rates: { MNQ: 1.04, MES: 1.04, NQ: 3.1, ES: 3.1 },
  },
  {
    label: "Take Profit Trader",
    match: ["take profit", "takeprofit", "takeprofittrader", "tpt"],
    rates: { MNQ: 0.5, MES: 0.5, NQ: 5, ES: 5 },
  },
  {
    label: "Tradeify",
    match: ["tradeify"],
    rates: { MNQ: 1.82, MES: 1.82, NQ: 5.76, ES: 5.76 },
  },
  {
    label: "MyFundedFutures",
    match: ["myfundedfutures", "my funded futures", "mffu"],
    rates: { MNQ: 1.9, MES: 1.9, NQ: 4.68, ES: 4.68 },
  },
  {
    label: "Top One Futures",
    match: ["top one", "topone", "top one futures"],
    rates: { MNQ: 1.9, MES: 1.9, NQ: 5.76, ES: 5.76 },
  },
];

const requiredHeaders = [
  "symbol",
  "qty",
  "buyprice",
  "sellprice",
  "pnl",
  "boughttimestamp",
  "soldtimestamp",
  "buyfillid",
  "sellfillid",
];

type TradovateFill = {
  symbol: string;
  asset: string;
  direction: "long" | "short";
  qty: number;
  buyFillId: string;
  sellFillId: string;
  entryTime: Date;
  exitTime: Date;
  pnl: number;
};

export type TradovateEntryPreview = {
  commissionAmount: number;
  commissionMissingSymbols: string[];
  commissionPresetLabel: string;
  grossPnl: number;
  input: JournalEntryInput;
};

export type TradovateImportResult = {
  entries: TradovateEntryPreview[];
  rawRows: number;
};

export function parseTradovatePerformanceCsv(
  text: string,
  account: TradingAccount,
  firmName: string,
  tradingSession: JournalTradingSession,
): TradovateImportResult {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("El CSV no contiene operaciones.");

  const headers = rows[0].map((header) => String(header || "").replace(/^\uFEFF/, "").trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeCsvHeader(header), index]));
  const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length) {
    throw new Error("El CSV no parece ser un Performance CSV de Tradovate.");
  }

  const rawFills = rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row, index) => parseTradovatePerformanceRow(row, headerIndex, index + 2));
  if (!rawFills.length) throw new Error("No se detectaron operaciones en el CSV.");

  const today = new Date().toISOString().slice(0, 10);
  const groupedFills = groupTradovateFills(rawFills);
  const entries = groupedFills.map((fills) => createEntryFromTradovateFills(fills, account, firmName, tradingSession));

  const invalidDate = entries.find((entry) => !isValidIsoDate(entry.input.date) || entry.input.date > today);
  if (invalidDate) throw new Error("El CSV contiene fechas invalidas o futuras.");

  entries.sort((left, right) => left.input.date.localeCompare(right.input.date));

  return {
    entries,
    rawRows: rawFills.length,
  };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = String(text || "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows.filter((item) => item.some((cell) => String(cell || "").trim()));
}

function normalizeCsvHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function readCsvCell(row: string[], headerIndex: Map<string, number>, header: string) {
  const index = headerIndex.get(header);
  return index === undefined ? "" : String(row[index] || "").trim();
}

function parseTradovatePerformanceRow(row: string[], headerIndex: Map<string, number>, rowNumber: number): TradovateFill {
  const symbol = readCsvCell(row, headerIndex, "symbol");
  const qty = Number(readCsvCell(row, headerIndex, "qty"));
  const buyTimestamp = parseTradovateTimestamp(readCsvCell(row, headerIndex, "boughttimestamp"));
  const soldTimestamp = parseTradovateTimestamp(readCsvCell(row, headerIndex, "soldtimestamp"));
  const buyPrice = normalizeFlexibleNumber(readCsvCell(row, headerIndex, "buyprice"));
  const sellPrice = normalizeFlexibleNumber(readCsvCell(row, headerIndex, "sellprice"));
  const pnl = parseTradovateMoney(readCsvCell(row, headerIndex, "pnl"));
  const buyFillId = readCsvCell(row, headerIndex, "buyfillid");
  const sellFillId = readCsvCell(row, headerIndex, "sellfillid");

  if (
    !symbol ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(buyPrice) ||
    !Number.isFinite(sellPrice) ||
    !Number.isFinite(pnl) ||
    Number.isNaN(buyTimestamp.getTime()) ||
    Number.isNaN(soldTimestamp.getTime())
  ) {
    throw new Error(`La fila ${rowNumber} del CSV no tiene un formato valido.`);
  }

  const isLong = buyTimestamp <= soldTimestamp;
  return {
    symbol,
    asset: normalizeTradovateSymbol(symbol),
    direction: isLong ? "long" : "short",
    qty,
    buyFillId,
    sellFillId,
    entryTime: isLong ? buyTimestamp : soldTimestamp,
    exitTime: isLong ? soldTimestamp : buyTimestamp,
    pnl,
  };
}

function parseTradovateTimestamp(value: string) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return new Date(Number.NaN);
  const [, month, day, year, hour, minute, second] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

function parseTradovateMoney(value: string) {
  const text = String(value || "").trim();
  const isNegative = text.includes("(") && text.includes(")");
  const amount = normalizeFlexibleNumber(text.replace(/[()$€]/g, ""));
  if (!Number.isFinite(amount)) return Number.NaN;
  return isNegative ? -Math.abs(amount) : amount;
}

function normalizeTradovateSymbol(symbol: string) {
  const compact = String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^([A-Z]+)([FGHJKMNQUVXZ]\d{1,2})$/);
  return match ? match[1] : compact;
}

function findTradovateCommissionPreset(firmName: string) {
  const normalized = normalize(firmName);
  if (!normalized) return null;
  return (
    TRADOVATE_COMMISSION_PRESETS.find((preset) =>
      preset.match.some((item) => {
        const pattern = normalize(item);
        return pattern && normalized.includes(pattern);
      }),
    ) || null
  );
}

function calculateTradovateCommission(fills: TradovateFill[], firmName: string) {
  const preset = findTradovateCommissionPreset(firmName);
  const missingSymbols = new Set<string>();
  let amount = 0;

  fills.forEach((fill) => {
    const symbol = normalizeTradovateSymbol(fill.asset || fill.symbol);
    const rate = preset?.rates[symbol];
    if (!Number.isFinite(rate)) {
      missingSymbols.add(symbol);
      return;
    }
    amount += Math.max(0, fill.qty) * (rate as number);
  });

  return {
    amount: roundFinancialAmount(amount),
    missingSymbols: [...missingSymbols].filter(Boolean),
    presetLabel: preset?.label || "",
  };
}

function groupTradovateFills(fills: TradovateFill[]) {
  const parents = fills.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parents[cursor] !== cursor) {
      parents[cursor] = parents[parents[cursor]];
      cursor = parents[cursor];
    }
    return cursor;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents[rootB] = rootA;
  };
  const fillKeys = new Map<string, number>();

  fills.forEach((fill, index) => {
    [fill.buyFillId && `buy:${fill.buyFillId}`, fill.sellFillId && `sell:${fill.sellFillId}`]
      .filter((value): value is string => Boolean(value))
      .forEach((fillKey) => {
        const key = `${fill.symbol}|${fill.direction}|${fillKey}`;
        if (fillKeys.has(key)) union(fillKeys.get(key) as number, index);
        else fillKeys.set(key, index);
      });
  });

  const groups = new Map<number, TradovateFill[]>();
  fills.forEach((fill, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    (groups.get(root) as TradovateFill[]).push(fill);
  });
  return Array.from(groups.values());
}

function createEntryFromTradovateFills(
  fills: TradovateFill[],
  account: TradingAccount,
  firmName: string,
  tradingSession: JournalTradingSession,
): TradovateEntryPreview {
  const sortedByEntry = [...fills].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  const first = sortedByEntry[0];
  const grossPnl = roundFinancialAmount(sum(fills.map((fill) => fill.pnl)));
  const commission = calculateTradovateCommission(fills, firmName);
  const pnl = roundFinancialAmount(grossPnl - commission.amount);

  return {
    commissionAmount: commission.amount,
    commissionMissingSymbols: commission.missingSymbols,
    commissionPresetLabel: commission.presetLabel,
    grossPnl,
    input: {
      date: dateToIsoDate(first.entryTime),
      firmId: account.firmId,
      accountId: account.id,
      symbol: normalizeJournalAsset(first.asset),
      direction: first.direction,
      tradingSession,
      sessionType: "trading-day",
      result: "neutral",
      emotion: "focused",
      discipline: 3,
      pnl,
      errors: [],
      operationUrl: "",
      notes: "",
      lesson: "",
    },
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function roundFinancialAmount(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function dateToIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return dateToIsoDate(date) === value;
}

function normalizeJournalAsset(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeFlexibleNumber(value: string) {
  const source = String(value || "").replace(/[^\d.,-]/g, "");
  if (!source) return Number.NaN;
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
    return Number(isThousands ? parts.join("") : source.replace(",", "."));
  }

  if (lastDot !== -1) {
    const parts = source.split(".");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? parts.join("") : source);
  }

  return Number(source);
}
