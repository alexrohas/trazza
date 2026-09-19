import { getAccountPnlByDate } from "./metrics";
import type { JournalEntry, Movement, TradingAccount } from "../types";

/**
 * Las reglas que deciden si se puede COBRAR, que son distintas de las que miden el
 * recorrido de la cuenta (objetivo y drawdowns, que ya pinta la barra). Aqui viven las
 * tres que en las prop firms de futuros denegan un payout aunque el balance este bien:
 * consistencia, dias rentables e importe minimo. Las columnas y su porque estan en
 * supabase-accounts-payout-rules.sql.
 *
 * Todo se calcula con el journal, que es lo unico que la app sabe de la operativa. No
 * hace falta ninguna integracion: si el usuario apunta su dia, Trazza puede decirle que
 * le falta para cobrar.
 */

export type AccountRuleId = "payoutMin" | "profitDays" | "consistency";

export type AccountRuleCheck = {
  id: AccountRuleId;
  met: boolean;
  /** Lo que pide la regla: dinero en payoutMin, dias en profitDays, % en consistency. */
  required: number;
  /** Donde vas, en la misma unidad que `required`. */
  current: number;
  /** Cuanto falta, en la unidad de la regla. undefined cuando todavia no se puede decir
   *  (la consistencia no significa nada mientras el ciclo no tenga beneficio). */
  missing?: number;
};

export type AccountCycle = {
  /** Fecha del ultimo payout, que es lo que cierra un ciclo. undefined si no hay
   *  ninguno y el ciclo es toda la vida de la cuenta. */
  closedAt?: string;
  /** Resultado acumulado del ciclo, segun el journal. */
  profit: number;
  /** El mejor dia del ciclo. 0 si no hay ninguno en verde. */
  bestDay: number;
  /** Dias que cuentan como rentables (ver profitDayMin). */
  profitDays: number;
  /** Dias con actividad apuntada, ganen o pierdan. */
  tradingDays: number;
};

export type AccountRuleStatus = {
  cycle: AccountCycle;
  /** Solo las reglas configuradas, en orden de lectura: cuanto llevas, cuantos dias,
   *  y por ultimo la consistencia, que es la que mas cuesta entender. */
  checks: AccountRuleCheck[];
  /** true cuando se cumplen todas las configuradas. Con `checks` vacio no se devuelve
   *  status, asi que `ready` nunca es un "si" sacado de no haber comprobado nada. */
  ready: boolean;
};

/** El ciclo de cobro: lo que va desde el ultimo payout de la cuenta hasta hoy. */
export function getAccountCycle(
  account: TradingAccount,
  entries: JournalEntry[],
  movements: Movement[],
): AccountCycle {
  /* Cierra ciclo el payout, no cualquier ingreso: un refund devuelve dinero pero no
     reinicia nada de lo que mide la firma. */
  const closedAt = movements
    .filter((movement) => movement.category === "payout" && movement.accountId === account.id && movement.date)
    .map((movement) => movement.date)
    .sort()
    .pop();

  const pnlByDate = getAccountPnlByDate(entries, account.id, { after: closedAt });
  const days = [...pnlByDate.values()];
  /* Un dia cuenta como rentable si supera el minimo que pide la firma (Topstep: 200 $).
     Sin minimo configurado vale cualquier dia en verde, y el 0 no cuenta como verde. */
  const profitDayFloor = account.profitDayMin && account.profitDayMin > 0 ? account.profitDayMin : 0;

  return {
    closedAt,
    profit: days.reduce((total, pnl) => total + pnl, 0),
    bestDay: days.reduce((best, pnl) => (pnl > best ? pnl : best), 0),
    profitDays: days.filter((pnl) => pnl > 0 && pnl >= profitDayFloor).length,
    tradingDays: days.length,
  };
}

/**
 * El estado de las reglas de cobro de una cuenta, o null si no hay ninguna que
 * comprobar. Devolver null y no un status vacio es deliberado: quien pinta esto tiene
 * que poder distinguir "esta cuenta no tiene reglas puestas" (y ofrecer ponerlas) de
 * "las tiene y le falta algo".
 */
export function getAccountRuleStatus(
  account: TradingAccount,
  entries: JournalEntry[],
  movements: Movement[],
): AccountRuleStatus | null {
  /* Capital propio no tiene firma detras que imponga nada. El formulario ya no ensena
     estos campos para ese tipo, pero una cuenta que cambio de tipo puede conservar
     valores viejos en la fila. */
  if (account.kind === "own") return null;

  const cycle = getAccountCycle(account, entries, movements);
  const checks: AccountRuleCheck[] = [];

  /* Minimo para cobrar: solo en fondeadas. En una evaluacion el umbral equivalente es el
     objetivo de fase, que ya sale en la barra de recorrido — repetirlo aqui seria decir
     dos veces lo mismo con dos nombres distintos. */
  if (account.kind === "funded" && account.payoutMin && account.payoutMin > 0) {
    checks.push({
      id: "payoutMin",
      met: cycle.profit >= account.payoutMin,
      required: account.payoutMin,
      current: cycle.profit,
      missing: Math.max(0, account.payoutMin - cycle.profit),
    });
  }

  if (account.minProfitDays && account.minProfitDays > 0) {
    checks.push({
      id: "profitDays",
      met: cycle.profitDays >= account.minProfitDays,
      required: account.minProfitDays,
      current: cycle.profitDays,
      missing: Math.max(0, account.minProfitDays - cycle.profitDays),
    });
  }

  /* Consistencia: el mejor dia no puede pasar del X% del beneficio del ciclo.
     `missing` no son los dolares que faltan para el objetivo sino los que hay que ganar
     EN OTROS DIAS para que el mejor deje de pesar demasiado — si los ganas en el propio
     mejor dia, el porcentaje no baja. Sale de despejar best / (profit + x) = limite.
     Con el ciclo en perdidas o a cero la regla no dice nada todavia (dividir por ese
     beneficio daria un porcentaje absurdo o infinito), asi que se marca como no cumplida
     pero sin cifra: lo que falta ahi es beneficio, y eso ya lo dicen las otras dos. */
  if (account.consistencyPct && account.consistencyPct > 0) {
    const limit = account.consistencyPct / 100;
    const hasProfit = cycle.profit > 0 && cycle.bestDay > 0;
    const share = hasProfit ? (cycle.bestDay / cycle.profit) * 100 : 0;

    checks.push({
      id: "consistency",
      /* Sin beneficio no hay nada que repartir, asi que tampoco hay regla que romper:
         se da por cumplida hasta que exista un dia en verde. Marcarla en rojo desde el
         primer dia seria avisar de un problema que aun no ha ocurrido. */
      met: !hasProfit || share <= account.consistencyPct,
      required: account.consistencyPct,
      current: share,
      missing: hasProfit ? Math.max(0, cycle.bestDay / limit - cycle.profit) : undefined,
    });
  }

  if (!checks.length) return null;

  return { cycle, checks, ready: checks.every((check) => check.met) };
}

/** La regla pendiente que conviene ensenar cuando solo cabe una (la tarjeta de Cuentas). */
export function getPendingRuleCheck(status: AccountRuleStatus): AccountRuleCheck | undefined {
  return status.checks.find((check) => !check.met);
}
