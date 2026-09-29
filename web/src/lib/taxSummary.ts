import { getPayoutGrossAmount } from "./metrics";
import type { Currency, Movement } from "../types";

/**
 * Resumen por trimestre para llevarle a la gestoria, en euros.
 *
 * **Esto no asesora y no debe empezar a hacerlo.** No estima cuotas, no dice si hay que
 * declarar ni decide si el coste de un challenge es deducible — las fuentes se contradicen
 * en eso, y afirmarlo seria inventarse una respuesta que solo puede dar quien lleve los
 * impuestos de cada uno. Lo unico que hace es ordenar los movimientos que el usuario ya
 * tiene: cobros por un lado, gastos por otro, cada uno en su trimestre y pasado a euros.
 * Si algun dia se añade una cifra "a pagar", eso ya es otra cosa y hay que pensarlo.
 *
 * El cambio es el oficial del BCE del dia de cada movimiento (ver `fxRates.ts`), que es el
 * mismo que usa la importacion del extracto: asi el informe y los movimientos importados
 * no se contradicen.
 */

export type TaxQuarter = {
  /** 1 a 4. */
  quarter: number;
  /** Payouts, por el importe que llega (neto). */
  payouts: number;
  /** Devoluciones de las firmas (refunds). */
  refunds: number;
  /** Todo lo gastado: challenges, resets, activaciones, plataformas, comisiones. */
  expenses: number;
  movements: number;
};

export type TaxSummary = {
  year: number;
  quarters: TaxQuarter[];
  totals: Omit<TaxQuarter, "quarter">;
  /** Movimientos del año sin cambio publicado para su fecha: quedan fuera de las sumas. */
  missingRate: number;
};

export type TaxRow = {
  movement: Movement;
  quarter: number;
  /** Importe con signo en la divisa del perfil (negativo si es gasto). */
  amount: number;
  rate?: number;
  eur?: number;
};

export function getMovementYears(movements: Movement[]) {
  const years = new Set<number>();
  movements.forEach((movement) => {
    const year = Number(movement.date.slice(0, 4));
    if (Number.isFinite(year)) years.add(year);
  });
  return [...years].sort((left, right) => right - left);
}

function quarterOf(date: string) {
  return Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Las filas de un año, ya convertidas. `rateFor` viene de `loadEcbRates`; con la divisa
 * del perfil ya en euros devuelve 1 y no se llama a nadie.
 */
export function buildTaxRows(movements: Movement[], year: number, rateFor: (date: string) => number | undefined): TaxRow[] {
  return movements
    .filter((movement) => Number(movement.date.slice(0, 4)) === year)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((movement) => {
      /* El payout se cuenta por lo que llega (neto), que es lo que entro en el banco. El
         bruto es lo que salio de la cuenta de la firma, y esa diferencia es el reparto,
         que nunca paso por aqui. */
      const amount = movement.kind === "income" ? movement.amount : -movement.amount;
      const rate = rateFor(movement.date);
      return { movement, quarter: quarterOf(movement.date), amount, rate, eur: rate === undefined ? undefined : round(amount * rate) };
    });
}

export function summarizeTaxRows(rows: TaxRow[], year: number): TaxSummary {
  const quarters: TaxQuarter[] = [1, 2, 3, 4].map((quarter) => ({ quarter, payouts: 0, refunds: 0, expenses: 0, movements: 0 }));
  let missingRate = 0;
  rows.forEach((row) => {
    if (row.eur === undefined) {
      missingRate += 1;
      return;
    }
    const bucket = quarters[row.quarter - 1];
    bucket.movements += 1;
    if (row.movement.kind === "expense") bucket.expenses += Math.abs(row.eur);
    else if (row.movement.category === "refund") bucket.refunds += row.eur;
    else bucket.payouts += row.eur;
  });
  const totals = quarters.reduce(
    (total, quarter) => ({
      payouts: round(total.payouts + quarter.payouts),
      refunds: round(total.refunds + quarter.refunds),
      expenses: round(total.expenses + quarter.expenses),
      movements: total.movements + quarter.movements,
    }),
    { payouts: 0, refunds: 0, expenses: 0, movements: 0 },
  );
  return {
    year,
    quarters: quarters.map((quarter) => ({
      ...quarter,
      payouts: round(quarter.payouts),
      refunds: round(quarter.refunds),
      expenses: round(quarter.expenses),
    })),
    totals,
    missingRate,
  };
}

/** Lo que el payout movio en la cuenta de la firma, solo para la columna del CSV. */
export function taxRowGross(row: TaxRow) {
  return row.movement.category === "payout" ? getPayoutGrossAmount(row.movement) : 0;
}

function escapeCsvValue(value: string | number) {
  const source = String(value);
  return /[",\r\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

/**
 * Un CSV con una fila por movimiento, no solo los totales: es lo que una gestoria puede
 * comprobar. Lleva el importe original, el cambio aplicado y el resultado en euros, para
 * que cada cifra se pueda rehacer a mano.
 */
export function exportTaxCsv(
  rows: TaxRow[],
  year: number,
  currency: Currency,
  names: {
    firm: (movement: Movement) => string;
    account: (movement: Movement) => string;
    category: (movement: Movement) => string;
    income: string;
    expense: string;
  },
  headers: string[],
) {
  const lines = rows.map((row) =>
    [
      row.movement.date,
      `T${row.quarter}`,
      row.movement.kind === "income" ? names.income : names.expense,
      names.category(row.movement),
      names.firm(row.movement),
      names.account(row.movement),
      row.amount,
      currency,
      row.rate ?? "",
      row.eur ?? "",
      taxRowGross(row) || "",
      row.movement.note || "",
    ]
      .map(escapeCsvValue)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `trazza-resumen-fiscal-${year}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
