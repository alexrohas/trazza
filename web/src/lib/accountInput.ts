import type { AccountInput, TradingAccount } from "../types";

/**
 * Una cuenta guardada, en la forma del formulario. Vive aqui y no dentro de AccountsView
 * porque tambien la necesita quien deduce de que plan del catalogo es una cuenta
 * (`matchCatalogPlan` compara entradas de formulario) fuera de esa pantalla.
 */
export function accountToInput(account: TradingAccount): AccountInput {
  return {
    firmId: account.firmId,
    name: account.name,
    status: account.status,
    kind: account.kind,
    drawdownType: account.drawdownType,
    parentAccountId: account.parentAccountId,
    size: account.sizeLabel || String(account.size || ""),
    purchasedAt: account.purchasedAt,
    phaseTarget: account.phaseTarget || undefined,
    maxDrawdown: account.maxDrawdown || undefined,
    dailyDrawdown: account.dailyDrawdown || undefined,
    /* Sin `|| undefined` como los de arriba: estos ya llegan como undefined cuando no
       hay regla, y ese o-logico convertiria un 0 legitimo en "sin regla" (un minimo de
       dia rentable de 0 $ significa "cualquier dia en verde vale", que es un dato). */
    consistencyPct: account.consistencyPct,
    minProfitDays: account.minProfitDays,
    profitDayMin: account.profitDayMin,
    payoutMin: account.payoutMin,
    withdrawMinProfit: account.withdrawMinProfit,
    trailLockOffset: account.trailLockOffset,
  };
}
