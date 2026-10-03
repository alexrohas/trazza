import { describe, expect, it } from "vitest";
import { firmCatalog } from "./firmCatalog";
import { evaluatePayoutCycle, parseAmount } from "./payoutCalculator";

/* La calculadora publica no tiene reglas propias: monta una cuenta y un journal y se los
   pasa al motor de la app. Estos casos son los del 2 de octubre de 2026, con las reglas
   de Lucid revisadas el 21 de septiembre. Si el catalogo cambia, cambian con el. */

const plan = (id: string) => {
  const found = firmCatalog[0].plans.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Plan ${id} no existe en el catalogo`);
  return found;
};
const rule = (result: ReturnType<typeof evaluatePayoutCycle>, id: string) =>
  result.rules?.checks.find((check) => check.id === id);

describe("evaluatePayoutCycle", () => {
  it("da por superada una evaluacion Flex 50K con objetivo y consistencia", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [500, 600, 700, 1300] });
    expect(result.ready).toBe(true);
    expect(result.target?.met).toBe(true);
    expect(rule(result, "consistency")?.met).toBe(true);
  });

  it("con el objetivo cumplido pero la consistencia rota, dice cuanto falta en otros dias", () => {
    // 1.600 / 3.100 = 51,6 % > 50 %: hacen falta 1.600 / 0,5 − 3.100 = 100 mas.
    const result = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [1600, 1500] });
    expect(result.ready).toBe(false);
    expect(result.target?.met).toBe(true);
    expect(rule(result, "consistency")?.met).toBe(false);
    expect(Math.round(rule(result, "consistency")?.missing ?? 0)).toBe(100);
  });

  it("detecta la rotura del MLL el dia en que ocurre", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [-1000, -1100] });
    expect(result.breachedDay).toBe(1);
    expect(result.breach).toEqual({ close: 47900, floor: 48000 });
    expect(result.ready).toBe(false);
  });

  it("sube el MLL con el mejor cierre (trailing)", () => {
    const holds = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [1500, -1000, -600] });
    expect(holds.breachedDay).toBeUndefined();
    expect(holds.floor).toBe(49500);

    const breaks = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [1500, -2100] });
    expect(breaks.breachedDay).toBe(1);
  });

  it("bloquea el MLL en el balance inicial + 100", () => {
    const holds = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [2500, -2350] });
    expect(holds.breachedDay).toBeUndefined();
    expect(holds.floor).toBe(50100);

    const breaks = evaluatePayoutCycle({ plan: plan("lucid-flex-50k"), phase: "challenge", days: [2500, -2450] });
    expect(breaks.breachedDay).toBe(1);
  });

  it("Pro 50K fondeada, primer ciclo: objetivo cumplido y faltan 2.100 para retirar", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-pro-50k"), phase: "funded", days: [200, 150, 150] });
    expect(result.ready).toBe(false);
    expect(rule(result, "payoutMin")?.met).toBe(true);
    expect(rule(result, "withdrawMin")?.missing).toBe(2100);
    expect(rule(result, "consistency")?.met).toBe(true);
  });

  it("reproduce la maqueta de la landing: 46 % de consistencia y +95", () => {
    const result = evaluatePayoutCycle({
      plan: plan("lucid-pro-50k"),
      phase: "funded",
      days: [294, 100, 120, 126],
      paidBefore: true,
      balance: 52840,
    });
    const consistency = rule(result, "consistency");
    expect(result.ready).toBe(false);
    expect(rule(result, "payoutMin")?.met).toBe(true);
    expect(rule(result, "withdrawMin")?.current).toBe(2840);
    expect(Math.round(consistency?.current ?? 0)).toBe(46);
    expect(Math.round(consistency?.missing ?? 0)).toBe(95);
    /* Ya cobro: el MLL depende de una historia que nadie ha escrito. */
    expect(result.balance).toBeUndefined();
  });

  it("Flex 50K fondeada con cinco dias de 150 o mas y 1.200 en cuenta: lista", () => {
    const result = evaluatePayoutCycle({
      plan: plan("lucid-flex-50k"),
      phase: "funded",
      days: [150, 150, 200, 160, 300],
      paidBefore: true,
      balance: 51200,
    });
    expect(result.ready).toBe(true);
  });

  it("un dia de 149 no cuenta como rentable con minimo de 150", () => {
    const result = evaluatePayoutCycle({
      plan: plan("lucid-flex-50k"),
      phase: "funded",
      days: [149, 150, 200, 151, 160],
      paidBefore: true,
      balance: 51200,
    });
    expect(result.ready).toBe(false);
    expect(rule(result, "profitDays")?.current).toBe(4);
  });

  it("Pro 50K evaluacion: sin reglas de cobro, basta el objetivo", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-pro-50k"), phase: "challenge", days: [3000] });
    expect(result.ready).toBe(true);
    expect(result.rules).toBeNull();
  });

  it("sin dias no hay veredicto", () => {
    const result = evaluatePayoutCycle({ plan: plan("lucid-flex-25k"), phase: "funded", days: [] });
    expect(result.ready).toBe(false);
    expect(result.rules).toBeNull();
  });
});

describe("parseAmount", () => {
  it.each([
    ["150", 150],
    ["-120", -120],
    ["+250 $", 250],
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["1.250", 1250],
    ["12,75", 12.75],
    ["−300", -300],
  ])("lee %s como %d", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3x"])("devuelve null con %j", (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});
