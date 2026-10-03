import { accountToInput } from "./accountInput";
import { findCatalogFirm, matchCatalogPlan, type WithdrawalRules } from "./firmCatalog";
import { getAccountPnl, getAccountWithdrawn } from "./metrics";
import type { JournalEntry, Movement, TradingAccount } from "../types";

/**
 * Cuanto se puede pedir en el proximo payout de una fondeada. Lo usan la calculadora
 * publica y la app, con la misma cuenta, para que las dos no puedan decir cifras
 * distintas del mismo beneficio.
 */
export type Withdrawal = {
  rules: WithdrawalRules;
  /** Beneficio que queda en la cuenta: lo ganado operando menos lo ya retirado en bruto. */
  accountProfit: number;
  /** El tope que aplica a este payout (el primero o los siguientes). */
  cap: number;
  firstPayout: boolean;
  /** Lo que se puede pedir, en bruto: 0 si no llega al minimo. */
  amount: number;
  /** Lo que llega al trader de ese importe. */
  net: number;
  belowMinimum: boolean;
  /** El tope recorta lo que permitiria el beneficio. */
  capped: boolean;
};

/* Abajo, al centimo: redondear al alto podria pasar del tope o del minimo por una
   fraccion. El 1e-6 absorbe el error de coma flotante (0,29 * 100 = 28,999...). */
const floorCents = (value: number) => Math.floor(value * 100 + 1e-6) / 100;

export function getWithdrawal(rules: WithdrawalRules, accountProfit: number, firstPayout: boolean): Withdrawal {
  const allowed =
    rules.profitShare !== undefined ? accountProfit * rules.profitShare : accountProfit - (rules.buffer ?? 0);
  const cap = firstPayout ? rules.maxFirst : rules.maxLater;
  const raw = Math.min(allowed, cap);
  const belowMinimum = raw < rules.minimum;
  const amount = belowMinimum ? 0 : floorCents(raw);
  return {
    rules,
    accountProfit,
    cap,
    firstPayout,
    amount,
    net: floorCents(amount * rules.traderSplit),
    belowMinimum,
    capped: allowed > cap,
  };
}

/**
 * El retiro de una cuenta de la app, o undefined si no se puede saber. Solo hay topes
 * para las fondeadas que siguen un plan del catalogo: la cuenta no guarda los topes (no
 * hay columnas), asi que se sacan del plan que se deduce de sus reglas. Una cuenta que
 * cambio un solo numero ya no sigue el plan y no se le inventa un tope — igual que el
 * selector de plan del formulario vuelve a "Elige el plan".
 */
export function getAccountWithdrawal(
  account: TradingAccount,
  firmName: string | undefined,
  entries: JournalEntry[],
  movements: Movement[],
): Withdrawal | undefined {
  if (account.kind !== "funded") return undefined;
  const firm = findCatalogFirm(firmName);
  const rules = firm ? matchCatalogPlan(firm, accountToInput(account))?.funded.withdrawal : undefined;
  if (!rules) return undefined;

  /* Lo mismo que mide la regla de beneficio para retirar (accountRules.ts). */
  const accountProfit = getAccountPnl(entries, account.id) - getAccountWithdrawn(movements, account.id);
  const paidBefore = movements.some((movement) => movement.category === "payout" && movement.accountId === account.id);
  return getWithdrawal(rules, accountProfit, !paidBefore);
}
