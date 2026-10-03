import { describe, expect, it } from "vitest";
import { applyCatalogPlan, firmCatalog } from "./firmCatalog";
import { evaluatePayoutCycle } from "./payoutCalculator";
import { getAccountWithdrawal, getWithdrawal } from "./withdrawal";
import type { JournalEntry, Movement, TradingAccount } from "../types";

/* Cuanto se puede pedir en un payout de Lucid (topes del 3 de octubre de 2026): Flex el
   50 % del beneficio, Pro lo que pasa del colchon (MLL + 100), los dos con 500 de minimo,
   tope por tamano y, en Pro, un tope menor en el primer payout. */

const plan = (id: string) => {
  const found = firmCatalog[0].plans.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Plan ${id} no existe en el catalogo`);
  return found;
};
const rulesOf = (id: string) => {
  const withdrawal = plan(id).funded.withdrawal;
  if (!withdrawal) throw new Error(`Plan ${id} sin reglas de retiro`);
  return withdrawal;
};
const withdraw = (id: string, profit: number, firstPayout = true) => getWithdrawal(rulesOf(id), profit, firstPayout);

describe("getWithdrawal: Flex", () => {
  it("retira la mitad del beneficio (1.000 → 500) y llega el 90 %", () => {
    const result = withdraw("lucid-flex-50k", 1000);
    expect(result).toMatchObject({ amount: 500, net: 450, capped: false, belowMinimum: false });
  });

  it("aplica el tope por payout (5.000 → 2.000 en 50K)", () => {
    expect(withdraw("lucid-flex-50k", 5000)).toMatchObject({ amount: 2000, net: 1800, capped: true });
  });

  it("por debajo de 500 no hay retiro", () => {
    expect(withdraw("lucid-flex-50k", 900)).toMatchObject({ amount: 0, net: 0, belowMinimum: true });
  });

  it("tope de 1.000 en 25K", () => {
    expect(withdraw("lucid-flex-25k", 2345.55)).toMatchObject({ amount: 1000, cap: 1000 });
  });

  it("redondea al centimo hacia abajo", () => {
    expect(withdraw("lucid-flex-100k", 1234.55)).toMatchObject({ amount: 617.27, net: 555.54 });
  });

  it("el tope es el mismo en todos los payouts", () => {
    expect(withdraw("lucid-flex-150k", 8000, false)).toMatchObject({ amount: 3000, cap: 3000 });
  });
});

describe("getWithdrawal: Pro", () => {
  it("retira lo que pasa del colchon (2.840 − 2.100 = 740)", () => {
    expect(withdraw("lucid-pro-50k", 2840)).toMatchObject({ amount: 740, net: 666, cap: 2000 });
  });

  it("primer payout con tope de 2.000", () => {
    expect(withdraw("lucid-pro-50k", 5000)).toMatchObject({ amount: 2000, capped: true });
  });

  it("desde el segundo, tope de 2.500", () => {
    expect(withdraw("lucid-pro-50k", 5000, false)).toMatchObject({ amount: 2500, cap: 2500 });
  });

  it("por debajo del minimo no hay retiro", () => {
    expect(withdraw("lucid-pro-50k", 2500)).toMatchObject({ amount: 0, belowMinimum: true });
  });

  it("tope de 3.500 en 150K desde el segundo payout", () => {
    expect(withdraw("lucid-pro-150k", 20000, false).amount).toBe(3500);
  });

  it("en perdidas no hay retiro", () => {
    expect(withdraw("lucid-pro-25k", -300)).toMatchObject({ amount: 0, belowMinimum: true });
  });
});

describe("getWithdrawal frente al beneficio minimo que ya guardaba el motor", () => {
  /* withdrawMinProfit (lo que pide la regla de "beneficio para retirar") y el calculo del
     retiro tienen que coincidir plan a plan: con ese beneficio se llega justo al minimo. */
  it.each(firmCatalog[0].plans.map((candidate) => [candidate.id]))("%s", (id) => {
    const needed = plan(id).funded.withdrawMinProfit ?? 0;
    expect(withdraw(id, needed).amount).toBe(500);
    expect(withdraw(id, needed - 1).belowMinimum).toBe(true);
  });
});

describe("evaluatePayoutCycle con retiro", () => {
  it("Flex 50K que ya cobro, balance 51.200 → 600 y no es el primer payout", () => {
    const result = evaluatePayoutCycle({
      plan: plan("lucid-flex-50k"),
      phase: "funded",
      days: [150, 150, 200, 160, 300],
      paidBefore: true,
      balance: 51200,
    });
    expect(result.ready).toBe(true);
    expect(result.withdrawal).toMatchObject({ amount: 600, firstPayout: false });
  });

  it("Flex 50K sin cobros: 1.000 en el ciclo → 500, primer payout", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "funded", days: [400, 300, 300] });
    expect(result.withdrawal).toMatchObject({ amount: 500, firstPayout: true });
  });

  it("la maqueta: 740 aunque falte la consistencia", () => {
    const result = evaluatePayoutCycle({
      plan: plan("lucid-pro-50k"),
      phase: "funded",
      days: [294, 100, 120, 126],
      paidBefore: true,
      balance: 52840,
    });
    expect(result.ready).toBe(false);
    expect(result.withdrawal?.amount).toBe(740);
  });

  it("ya cobro pero sin balance escrito: no se inventa la cifra", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-pro-50k"), phase: "funded", days: [300, 200], paidBefore: true });
    expect(result.withdrawal).toBeUndefined();
  });

  it("en evaluacion o sin dias no hay retiro", () => {
    expect(evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [500, 600] }).withdrawal).toBeUndefined();
    expect(evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "funded", days: [] }).withdrawal).toBeUndefined();
  });
});

describe("getAccountWithdrawal (la app)", () => {
  /* Una cuenta como la guarda la app: las reglas del plan copiadas con applyCatalogPlan. */
  function account(id: string, planId: string, kind: "funded" | "challenge" = "funded", tweak: Partial<TradingAccount> = {}) {
    const source = plan(planId);
    const rules = applyCatalogPlan(source, kind);
    return {
      id,
      firmId: "f1",
      name: id,
      status: kind === "funded" ? "funded" : "evaluation",
      kind,
      drawdownType: rules.drawdownType ?? "static",
      size: source.size,
      sizeLabel: rules.size,
      purchasedAt: "2026-09-01",
      phaseTarget: rules.phaseTarget ?? 0,
      maxDrawdown: rules.maxDrawdown ?? 0,
      dailyDrawdown: rules.dailyDrawdown ?? 0,
      consistencyPct: rules.consistencyPct,
      minProfitDays: rules.minProfitDays,
      profitDayMin: rules.profitDayMin,
      payoutMin: rules.payoutMin,
      withdrawMinProfit: rules.withdrawMinProfit,
      trailLockOffset: rules.trailLockOffset,
      ...tweak,
    } as TradingAccount;
  }
  const day = (accountId: string, date: string, pnl: number) =>
    ({
      id: `${accountId}-${date}`,
      date,
      accountId,
      firmId: "f1",
      symbol: "NQ",
      direction: "long",
      pnl,
      rMultiple: 0,
      discipline: 0,
      emotion: "other",
      notes: "",
    }) as JournalEntry;
  const payout = (accountId: string, date: string, amount: number, payoutGrossAmount?: number) =>
    ({ id: `p-${accountId}-${date}`, date, kind: "income", category: "payout", amount, payoutGrossAmount, firmId: "f1", accountId }) as Movement;

  const proDays = [day("pro", "2026-09-02", 3000), day("pro", "2026-09-05", 2000), day("pro", "2026-09-20", 1500)];

  it("Flex 50K sin cobros, 1.000 de beneficio → 500 en el primer payout", () => {
    const flexDays = [day("flex", "2026-09-02", 600), day("flex", "2026-09-03", 400)];
    expect(getAccountWithdrawal(account("flex", "lucid-flex-50k"), "Lucid Trading", flexDays, [])).toMatchObject({
      amount: 500,
      firstPayout: true,
      net: 450,
    });
  });

  it("reconoce la empresa aunque el usuario la llame \"lucid 1\"", () => {
    const flexDays = [day("flex", "2026-09-02", 1000)];
    expect(getAccountWithdrawal(account("flex", "lucid-flex-50k"), "lucid 1", flexDays, [])?.amount).toBe(500);
  });

  it("descuenta lo retirado en bruto y aplica el tope del segundo payout", () => {
    // 6.500 − 2.000 bruto = 4.500; menos el colchon de 2.100 = 2.400; tope 2.500.
    const result = getAccountWithdrawal(account("pro", "lucid-pro-50k"), "Lucid Trading", proDays, [
      payout("pro", "2026-09-10", 1800, 2000),
    ]);
    expect(result).toMatchObject({ accountProfit: 4500, amount: 2400, firstPayout: false, cap: 2500 });
  });

  it("sin payouts, el mismo beneficio choca con el tope del primero", () => {
    expect(getAccountWithdrawal(account("pro", "lucid-pro-50k"), "Lucid Trading", proDays, [])).toMatchObject({
      amount: 2000,
      capped: true,
      firstPayout: true,
    });
  });

  it("los payouts de otra cuenta no cuentan", () => {
    const result = getAccountWithdrawal(account("pro", "lucid-pro-50k"), "Lucid Trading", proDays, [
      payout("otra", "2026-09-10", 900, 1000),
    ]);
    expect(result).toMatchObject({ firstPayout: true, accountProfit: 6500 });
  });

  it("una cuenta que ya no sigue el plan (35 % de antes de noviembre de 2025) no enseña cifra", () => {
    const old = account("old", "lucid-pro-50k", "funded", { consistencyPct: 35 });
    expect(getAccountWithdrawal(old, "Lucid Trading", proDays, [])).toBeUndefined();
  });

  it("no sale en evaluaciones, firmas fuera del catalogo ni cuentas sin empresa", () => {
    expect(getAccountWithdrawal(account("ev", "lucid-flex-50k", "challenge"), "Lucid Trading", proDays, [])).toBeUndefined();
    expect(getAccountWithdrawal(account("apex", "lucid-flex-50k"), "Apex Trader Funding", proDays, [])).toBeUndefined();
    expect(getAccountWithdrawal(account("nofirm", "lucid-flex-50k"), undefined, proDays, [])).toBeUndefined();
  });
});
