import { parseCsvRows } from "./csv";
import type { FirmType, Movement, MovementCategory, MovementKind } from "../types";

/**
 * Importacion de extractos del banco (Revolut y Wise) en CSV. Todo ocurre en el
 * navegador: el fichero no sale de la maquina y solo se guardan las filas que el usuario
 * confirma en la vista previa. Existe porque 35 de 54 usuarios no crearon ni un registro,
 * y ver el gasto acumulado exigia teclear cada compra a mano.
 *
 * Un extracto trae de todo (el supermercado, el alquiler, bizums), asi que no se importa
 * nada que no se reconozca como una firma o una plataforma de trading. Lo demas se cuenta
 * pero no se ensena ni se guarda.
 *
 * Formatos comprobados contra extractos reales el 22 de septiembre de 2026:
 * - Revolut: las cabeceras salen en el idioma de la app ("Tipo, Producto, Fecha de
 *   inicio..." o "Type, Product, Started Date..."), por eso cada columna admite los dos.
 * - Wise (extracto de una divisa): cabeceras siempre en ingles, fechas DD-MM-AAAA, y el
 *   que paga en su propia columna ("Payer Name"), que es donde llegan los payouts.
 */

export type BankSource = "revolut" | "wise";

/** Por donde entro el dinero: decide si un ingreso es un payout o una devolucion. */
export type BankChannel = "card" | "refund" | "transfer" | "other";

export type BankRow = {
  /** Estable entre dos lecturas del mismo fichero: sirve de clave en la vista previa. */
  key: string;
  date: string;
  /** Con signo y en la divisa del extracto (negativo = sale dinero). */
  amount: number;
  currency: string;
  /** Lo que se ensena y se compara: el comercio, quien paga o la descripcion. */
  counterparty: string;
  channel: BankChannel;
};

export type BankStatement = {
  source: BankSource;
  rows: BankRow[];
};

export class BankImportError extends Error {
  constructor(public code: "empty" | "unknownFormat") {
    super(code);
  }
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeText(value.replace(/^﻿/, "")).replace(/[^a-z0-9]/g, "");
}

function parseAmount(value: string) {
  const parsed = Number(String(value || "").replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

/** Columna por cualquiera de sus nombres (cada idioma de Revolut da el suyo). */
function columnReader(headers: string[]) {
  const index = new Map(headers.map((header, position) => [normalizeHeader(header), position]));
  return (row: string[], ...names: string[]) => {
    for (const name of names) {
      const position = index.get(normalizeHeader(name));
      if (position !== undefined) return String(row[position] ?? "").trim();
    }
    return "";
  };
}

function hasColumns(headers: string[], ...names: string[]) {
  const set = new Set(headers.map(normalizeHeader));
  return names.every((name) => set.has(normalizeHeader(name)));
}

export function parseBankStatement(text: string): BankStatement {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new BankImportError("empty");
  const headers = rows[0];

  if (hasColumns(headers, "TransferWise ID", "Amount", "Currency", "Date")) {
    return { source: "wise", rows: parseWise(headers, rows.slice(1)) };
  }
  const revolutSpanish = hasColumns(headers, "Tipo", "Fecha de inicio", "Importe", "Divisa");
  const revolutEnglish = hasColumns(headers, "Type", "Started Date", "Amount", "Currency");
  if (revolutSpanish || revolutEnglish) {
    return { source: "revolut", rows: parseRevolut(headers, rows.slice(1)) };
  }
  throw new BankImportError("unknownFormat");
}

/* Solo se leen los movimientos cerrados: uno "revertido" o "pendiente" no ha movido
   dinero (o aun puede no moverlo). */
const REVOLUT_DONE_STATES = new Set(["completado", "completed"]);

function parseRevolut(headers: string[], rows: string[][]): BankRow[] {
  const read = columnReader(headers);
  return rows.flatMap((row, index): BankRow[] => {
    const state = normalizeText(read(row, "State", "Estado"));
    if (state && !REVOLUT_DONE_STATES.has(state)) return [];
    const date = read(row, "Fecha de inicio", "Started Date").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    /* La comision va aparte y en positivo: lo que de verdad salio es importe - comision. */
    const amount = roundCents(parseAmount(read(row, "Importe", "Amount")) - parseAmount(read(row, "Comision", "Fee")));
    if (!amount) return [];
    const type = normalizeText(read(row, "Tipo", "Type"));
    const description = read(row, "Descripcion", "Description");
    return [
      {
        key: `revolut-${index}-${date}-${amount}`,
        date,
        amount,
        currency: read(row, "Divisa", "Currency").toUpperCase() || "EUR",
        counterparty: description,
        channel: revolutChannel(type, amount),
      },
    ];
  });
}

function revolutChannel(type: string, amount: number): BankChannel {
  if (type.includes("reembolso") || type.includes("refund") || type === "card_credit") return "refund";
  if (type.includes("tarjeta") || type.includes("card")) return amount > 0 ? "refund" : "card";
  if (type.includes("transfer")) return "transfer";
  return "other";
}

function parseWise(headers: string[], rows: string[][]): BankRow[] {
  const read = columnReader(headers);
  return rows.flatMap((row, index): BankRow[] => {
    const match = read(row, "Date").match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return [];
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    const amount = roundCents(parseAmount(read(row, "Amount")));
    if (!amount) return [];
    const detailsType = normalizeText(read(row, "Transaction Details Type"));
    const counterparty =
      read(row, "Merchant") || read(row, "Payer Name") || read(row, "Payee Name") || read(row, "Description");
    return [
      {
        key: read(row, "TransferWise ID") || `wise-${index}-${date}-${amount}`,
        date,
        amount,
        currency: read(row, "Currency").toUpperCase() || "USD",
        counterparty,
        channel: detailsType === "card" ? (amount > 0 ? "refund" : "card") : detailsType === "deposit" || detailsType === "transfer" ? "transfer" : "other",
      },
    ];
  });
}

/* ---------------------------------------------------------------------------------- */
/* Reconocer firmas y plataformas                                                      */
/* ---------------------------------------------------------------------------------- */

type BankPattern = {
  /** Nombre limpio: el que se propone al crear la empresa si el usuario no la tiene. */
  name: string;
  /** Lo que aparece en el banco. Cuidado con los nombres cortos: "apex" a secas tambien
   *  es un gimnasio, por eso se pide "apex trader". */
  bank: RegExp;
  /** Como la habra llamado el usuario al crearla (texto libre, con erratas reales como
   *  "apha futures"). Sin esto no se encontraria su empresa y se propondria otra. */
  firm: RegExp;
  type: FirmType;
};

const FIRM_PATTERNS: BankPattern[] = [
  { name: "Lucid", bank: /\blucid\b/, firm: /lucid/, type: "futures" },
  { name: "Apex", bank: /apex ?trader/, firm: /apex/, type: "futures" },
  { name: "Alpha Futures", bank: /alpha ?futures/, firm: /al?pha ?fut|^al?pha$/, type: "futures" },
  { name: "Alpha Capital", bank: /alpha ?capital/, firm: /alpha ?cap/, type: "forex" },
  { name: "Topstep", bank: /topstep/, firm: /topstep/, type: "futures" },
  { name: "Tradeify", bank: /tradeify/, firm: /tradeify/, type: "futures" },
  { name: "MyFundedFutures", bank: /my ?funded ?futures|\bmffu\b/, firm: /my ?funded ?fut|mffu/, type: "futures" },
  { name: "Take Profit Trader", bank: /take ?profit ?trader/, firm: /take ?profit|\btpt\b/, type: "futures" },
  { name: "Top One Futures", bank: /top ?one ?futures/, firm: /top ?one/, type: "futures" },
  { name: "Bulenox", bank: /bulenox/, firm: /bulenox/, type: "futures" },
  { name: "Earn2Trade", bank: /earn ?2 ?trade/, firm: /earn ?2/, type: "futures" },
  { name: "FTMO", bank: /\bftmo\b/, firm: /ftmo/, type: "forex" },
  { name: "FundedNext", bank: /funded ?next/, firm: /funded ?next/, type: "forex" },
  { name: "Funding Pips", bank: /funding ?pips/, firm: /funding ?pips/, type: "forex" },
  { name: "The5ers", bank: /the ?5 ?ers/, firm: /5 ?ers/, type: "forex" },
  { name: "Goat Funded", bank: /goat ?funded/, firm: /goat/, type: "forex" },
];

/* Herramientas que se pagan aparte de la firma. No tienen empresa: se guardan en
   "General" con la categoria Plataforma, que es donde las pondria el usuario a mano. */
const PLATFORM_PATTERNS: { name: string; bank: RegExp }[] = [
  { name: "TradingView", bank: /tradingview/ },
  { name: "NinjaTrader", bank: /ninja ?trader/ },
  { name: "ATAS", bank: /\batas\b/ },
  { name: "Rithmic", bank: /rithmic/ },
  { name: "Tradovate", bank: /tradovate/ },
  { name: "Sierra Chart", bank: /sierra ?chart/ },
  { name: "Quantower", bank: /quantower/ },
  { name: "Bookmap", bank: /bookmap/ },
];

export type BankMatch =
  | { kind: "firm"; name: string; type: FirmType; firmId?: string }
  | { kind: "platform"; name: string };

type FirmLike = { id: string; name: string };

/**
 * Que es esta fila, o undefined si no tiene que ver con el trading. Si el usuario ya
 * tiene la empresa se devuelve la suya (con varias que encajen, "lucid" y "lucid
 * trading", la que mas movimientos tiene: es la que usa de verdad). Las empresas que el
 * usuario haya creado y no esten en la lista tambien se reconocen, por su nombre.
 */
export function matchBankRow(row: BankRow, firms: FirmLike[], movementCountByFirm: Map<string, number>): BankMatch | undefined {
  const text = normalizeText(row.counterparty);
  const pickFirm = (candidates: FirmLike[]) =>
    [...candidates].sort((left, right) => (movementCountByFirm.get(right.id) || 0) - (movementCountByFirm.get(left.id) || 0))[0];

  const pattern = FIRM_PATTERNS.find((item) => item.bank.test(text));
  if (pattern) {
    const existing = pickFirm(firms.filter((firm) => pattern.firm.test(normalizeText(firm.name))));
    return { kind: "firm", name: pattern.name, type: pattern.type, firmId: existing?.id };
  }

  const platform = PLATFORM_PATTERNS.find((item) => item.bank.test(text));
  if (platform) return { kind: "platform", name: platform.name };

  /* Nombres de 4 letras como poco: con menos, "fx" o "ea" encajarian en medio extracto. */
  const byName = pickFirm(
    firms.filter((firm) => {
      const name = normalizeText(firm.name).replace(/\s*\d+\s*k?$/, "").trim();
      return name.length >= 4 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
    }),
  );
  if (byName) return { kind: "firm", name: byName.name, type: "other", firmId: byName.id };
  return undefined;
}

export function guessMovement(row: BankRow, match: BankMatch): { kind: MovementKind; category: MovementCategory } {
  if (row.amount < 0) return { kind: "expense", category: match.kind === "platform" ? "platform" : "challenge" };
  /* Una transferencia de la firma es un cobro; lo que vuelve a la tarjeta, una devolucion. */
  if (match.kind === "firm" && row.channel === "transfer") return { kind: "income", category: "payout" };
  return { kind: "income", category: "refund" };
}

/**
 * Filas que se anulan entre si: un cargo y su devolucion por el mismo importe en pocos
 * dias (las verificaciones de tarjeta de 1 $, o un challenge cancelado). Importarlas
 * sumaria gasto e ingreso que no han existido, asi que salen desmarcadas.
 */
export function findReversedKeys(rows: { row: BankRow; label: string }[]) {
  const reversed = new Set<string>();
  const DAY = 86_400_000;
  rows.forEach((charge) => {
    if (charge.row.amount >= 0 || reversed.has(charge.row.key)) return;
    const refund = rows.find(
      (candidate) =>
        candidate.row.amount > 0 &&
        !reversed.has(candidate.row.key) &&
        candidate.label === charge.label &&
        Math.abs(candidate.row.amount + charge.row.amount) < 0.01 &&
        Math.abs(Date.parse(candidate.row.date) - Date.parse(charge.row.date)) <= 10 * DAY,
    );
    if (refund) {
      reversed.add(charge.row.key);
      reversed.add(refund.row.key);
    }
  });
  return reversed;
}

/* Cuanto puede separarse la fecha del banco de la que apunto el usuario a mano. Un cargo
   casi siempre cae el mismo dia o el siguiente; un payout se apunta el dia que se pide y
   llega al banco dias despues (medido en una cuenta real: 2 y 7 dias). */
const MATCH_DAYS: Record<MovementKind, number> = { expense: 3, income: 10 };
/* Con cambio de divisa el importe no coincide al centimo: quien apunta 19,60 $ ve en el
   banco 16,84 EUR, y el cambio del BCE de ese dia da 19,70 $. La tarjeta aplica el suyo. */
const CONVERTED_TOLERANCE = 0.03;

export type ImportCandidate = {
  key: string;
  date: string;
  kind: MovementKind;
  firmId: string;
  amount: number;
  /** El importe sale de convertir otra divisa: se compara con margen, no al centimo. */
  converted: boolean;
};

function dayDistance(left: string, right: string) {
  return Math.abs(Date.parse(`${left}T12:00:00Z`) - Date.parse(`${right}T12:00:00Z`)) / 86_400_000;
}

/* Segundo nivel: misma empresa y mismo tipo con un dia de diferencia como mucho, aunque el
   importe no cuadre. Es quien apunto la compra de memoria: en una cuenta real, 30 $ para
   un cargo de 30,67 EUR (35,84 $) y 19 $ para uno de 18,02 EUR (20,83 $). No se da por
   seguro, pero sale desmarcado para no duplicarlo sin querer. */
const POSSIBLE_MATCH_DAYS = 1;

export type ImportMatch = { movementId: string; exact: boolean };

/**
 * Las filas que ya estan guardadas, con el movimiento con el que casan. Importar el mismo
 * extracto dos veces no duplica nada, y tampoco lo que el usuario ya habia apuntado a mano
 * antes de importar, que casi nunca coincide al dia ni al centimo con el banco (ver
 * MATCH_DAYS y CONVERTED_TOLERANCE). Cada movimiento guardado casa con una sola fila, y
 * la mas cercana en fecha se lo queda: tres cargos de 50 $ en tres dias no pueden ser el
 * mismo movimiento. `exact: false` es el segundo nivel (POSSIBLE_MATCH_DAYS).
 */
export function findAlreadyImported(
  candidates: ImportCandidate[],
  movements: Pick<Movement, "id" | "date" | "kind" | "firmId" | "amount">[],
) {
  const matches = new Map<string, ImportMatch>();
  const used = new Set<string>();
  /* Todas las parejas posibles, y se reparten de la mas cercana a la mas lejana. Ir fila a
     fila en orden de fecha fallaba: con cargos los dias 19, 20 y 23 y apuntados el 19 y el
     23, el del 20 se quedaba el del 23 (a tres dias, dentro del margen) y el del 23, que
     casaba exacto, se importaba duplicado. */
  const pairs: { key: string; id: string; days: number; diff: number }[] = [];
  candidates.forEach((candidate) => {
    movements.forEach((movement) => {
      if (movement.kind !== candidate.kind || (movement.firmId || "") !== candidate.firmId) return;
      const days = dayDistance(movement.date, candidate.date);
      if (days > MATCH_DAYS[candidate.kind]) return;
      const diff = Math.abs(movement.amount - candidate.amount);
      const allowed = candidate.converted
        ? Math.max(0.5, CONVERTED_TOLERANCE * Math.max(movement.amount, candidate.amount))
        : 0.005;
      if (diff <= allowed) pairs.push({ key: candidate.key, id: movement.id, days, diff });
    });
  });
  pairs
    .sort((left, right) => left.days - right.days || left.diff - right.diff)
    .forEach((pair) => {
      if (matches.has(pair.key) || used.has(pair.id)) return;
      used.add(pair.id);
      matches.set(pair.key, { movementId: pair.id, exact: true });
    });
  /* Despues, y solo con lo que haya quedado libre: un emparejamiento seguro nunca cede su
     movimiento a uno dudoso. Mismo reparto por cercania. */
  const possiblePairs: { key: string; id: string; days: number; diff: number }[] = [];
  candidates.forEach((candidate) => {
    if (matches.has(candidate.key)) return;
    movements.forEach((movement) => {
      if (used.has(movement.id) || movement.kind !== candidate.kind || (movement.firmId || "") !== candidate.firmId) return;
      const days = dayDistance(movement.date, candidate.date);
      if (days <= POSSIBLE_MATCH_DAYS) {
        possiblePairs.push({ key: candidate.key, id: movement.id, days, diff: Math.abs(movement.amount - candidate.amount) });
      }
    });
  });
  possiblePairs
    .sort((left, right) => left.days - right.days || left.diff - right.diff)
    .forEach((pair) => {
      if (matches.has(pair.key) || used.has(pair.id)) return;
      used.add(pair.id);
      matches.set(pair.key, { movementId: pair.id, exact: false });
    });
  return matches;
}
