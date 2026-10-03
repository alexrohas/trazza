import { getAccountRuleStatus, type AccountRuleStatus } from "./accountRules";
import { applyCatalogPlan, formatPlanLabel, type CatalogPlan } from "./firmCatalog";
import { getAccountLossLimitPnl, getAccountProgress, localIsoDate } from "./metrics";
import { getWithdrawal, type Withdrawal } from "./withdrawal";
import type { JournalEntry, Movement, TradingAccount } from "../types";

/**
 * La calculadora publica "¿Puedo cobrar ya en Lucid?" (web/calculadora-lucid).
 *
 * No tiene reglas propias: monta con lo que escribe el visitante una cuenta y un journal
 * como los de la app y se los pasa al mismo motor (accountRules.ts y metrics.ts). Asi la
 * calculadora y la app no pueden dar respuestas distintas a la misma pregunta, y una
 * correccion del motor o del catalogo llega a las dos a la vez.
 *
 * Lo que entra son resultados de dias cerrados, en orden. Se fechan hacia atras desde
 * ayer, para que todos cuenten como cerrados en el MLL EOD trailing (el motor no cuenta
 * el dia de hoy hasta su cierre).
 */

export type CalculatorPhase = "challenge" | "funded";

export type CalculatorInput = {
  plan: CatalogPlan;
  phase: CalculatorPhase;
  /** Resultado de cada dia cerrado, en orden: en evaluacion desde el principio, y en
   *  fondeada desde el ultimo payout (o desde el principio si no ha cobrado nunca). */
  days: number[];
  /** Una fondeada que ya ha cobrado algun payout: el siguiente tiene otro tope en Pro. */
  paidBefore?: boolean;
  /** Solo en una fondeada que ya ha cobrado: el balance de ahora. Es lo unico que hace
   *  falta saber de antes del ciclo, porque el beneficio para retirar mide lo que queda
   *  en la cuenta (balance menos tamaño), no lo del ciclo. */
  balance?: number;
};

export type CalculatorTarget = { required: number; current: number; missing: number; met: boolean };

export type CalculatorResult = {
  account: TradingAccount;
  /** Las reglas de cobro que comprueba el motor (null si el plan no tiene ninguna en esa
   *  fase, como la evaluacion Pro). */
  rules: AccountRuleStatus | null;
  /** Solo en evaluacion: el objetivo de fase, que el motor deja a la barra de recorrido. */
  target?: CalculatorTarget;
  cycleProfit: number;
  /** Balance y MLL solo cuando se conoce la historia entera de la cuenta: en una
   *  fondeada que ya cobro, el MLL depende de todo lo de antes del ciclo, y el
   *  visitante no lo ha escrito. */
  balance?: number;
  floor?: number;
  /** Primer dia (desde 0) en que el cierre toco el MLL. Con cierres no se ve lo que pasa
   *  dentro del dia, asi que es una cota: si un dia bajo mas que su cierre, pudo romperse
   *  antes. */
  breachedDay?: number;
  /** El cierre de ese dia y el MLL que regia, en balance: lo que hace falta para contar
   *  que paso sin volver a calcularlo. */
  breach?: { close: number; floor: number };
  /** Solo en fondeada, con dias apuntados y sabiendo el balance si ya cobro. */
  withdrawal?: Withdrawal;
  ready: boolean;
};

const ACCOUNT_ID = "calculator";
const FIRM_ID = "lucid";

function journalDay(date: string, pnl: number): JournalEntry {
  return {
    id: `calculator-${date}`,
    date,
    accountId: ACCOUNT_ID,
    firmId: FIRM_ID,
    symbol: "",
    direction: "none",
    pnl,
    rMultiple: 0,
    discipline: 0,
    emotion: "other",
    notes: "",
  };
}

export function evaluatePayoutCycle(input: CalculatorInput, today = new Date()): CalculatorResult {
  const { plan, phase, days } = input;
  const rules = applyCatalogPlan(plan, phase);
  const account: TradingAccount = {
    id: ACCOUNT_ID,
    firmId: FIRM_ID,
    name: formatPlanLabel(plan),
    status: "active",
    kind: phase,
    drawdownType: rules.drawdownType ?? "static",
    size: plan.size,
    sizeLabel: rules.size,
    purchasedAt: "",
    phaseTarget: rules.phaseTarget ?? 0,
    maxDrawdown: rules.maxDrawdown ?? 0,
    dailyDrawdown: rules.dailyDrawdown ?? 0,
    consistencyPct: rules.consistencyPct,
    minProfitDays: rules.minProfitDays,
    profitDayMin: rules.profitDayMin,
    payoutMin: rules.payoutMin,
    withdrawMinProfit: rules.withdrawMinProfit,
    trailLockOffset: rules.trailLockOffset,
  };

  /* El dia `offset` antes de hoy, a mediodia para que el cambio de hora no lo mueva. */
  const dayBefore = (offset: number) =>
    localIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 12));

  const dates = days.map((_, index) => dayBefore(days.length - index));
  const entries = days.map((pnl, index) => journalDay(dates[index], pnl));
  const movements: Movement[] = [];
  const cycleProfit = days.reduce((total, pnl) => total + pnl, 0);
  const knownHistory = phase === "challenge" || input.balance === undefined;

  if (!knownHistory && input.balance !== undefined) {
    /* Todo lo de antes del ciclo, resumido en un dia y cerrado por un payout ese mismo
       dia. Al motor solo le importan dos cosas de ahi: que hubo un payout (el ciclo
       empieza despues) y cuanto queda en la cuenta (ganado menos retirado). El payout va
       a cero y el dia lleva todo lo que queda, que da exactamente balance - tamaño. */
    const closedAt = dayBefore(days.length + 1);
    entries.unshift(journalDay(closedAt, input.balance - plan.size - cycleProfit));
    movements.push({
      id: "calculator-payout",
      date: closedAt,
      kind: "income",
      category: "payout",
      amount: 0,
      firmId: FIRM_ID,
      accountId: ACCOUNT_ID,
    });
  }

  const status = days.length ? getAccountRuleStatus(account, entries, movements) : null;

  let breachedDay: number | undefined;
  let breach: CalculatorResult["breach"];
  let balance: number | undefined;
  let floor: number | undefined;
  if (knownHistory) {
    const progress = getAccountProgress(account, entries, movements);
    balance = progress.current;
    floor = progress.floor;
    /* Dia a dia, con el MLL que regia ese dia (el de los cierres anteriores): una cuenta
       que rompio el limite el dia 3 y se recupero el 10 estaba perdida desde el 3, y el
       balance final no lo diria. */
    let cumulative = 0;
    for (let index = 0; index < days.length; index += 1) {
      cumulative += days[index];
      const limit = getAccountLossLimitPnl(account, entries, movements, dates[index]);
      if (limit !== undefined && cumulative <= limit) {
        breachedDay = index;
        breach = { close: plan.size + cumulative, floor: plan.size + limit };
        break;
      }
    }
  }

  const target: CalculatorTarget | undefined =
    phase === "challenge" && account.phaseTarget > 0
      ? {
          required: account.phaseTarget,
          current: cycleProfit,
          missing: Math.max(0, account.phaseTarget - cycleProfit),
          met: cycleProfit >= account.phaseTarget,
        }
      : undefined;

  const rulesReady = status ? status.ready : phase === "challenge";
  const ready = days.length > 0 && breachedDay === undefined && rulesReady && (target ? target.met : true);

  const withdrawalRules = phase === "funded" ? plan.funded.withdrawal : undefined;
  /* Si ya cobro y no se sabe el balance, el beneficio de antes del ciclo es desconocido:
     cualquier cifra seria inventada. */
  const profitKnown = !input.paidBefore || input.balance !== undefined;
  const withdrawal =
    withdrawalRules && days.length && profitKnown
      ? getWithdrawal(withdrawalRules, knownHistory ? cycleProfit : input.balance! - plan.size, !input.paidBefore)
      : undefined;

  return { account, rules: status, target, cycleProfit, balance, floor, breachedDay, breach, withdrawal, ready };
}

/* "1.234,5", "1,234.5", "-120", "+250 $": lo que la gente escribe de verdad. Con punto y
   coma a la vez manda el ultimo como decimal; con solo puntos en grupos de tres, son
   miles (como lo escribe el castellano). Devuelve null si no es un numero. */
export function parseAmount(raw: string): number | null {
  let value = raw.replace(/[\s$€]/g, "").replace(/^\+/, "").replace("−", "-");
  if (!value) return null;
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    value = value.replaceAll(decimal === "," ? "." : ",", "").replace(decimal, ".");
  } else if (lastComma !== -1) {
    value = value.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replaceAll(".", "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}
