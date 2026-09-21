import { parseAccountSizeAmount } from "./db";
import type { AccountInput, AccountKind, DrawdownType } from "../types";

/**
 * Planes de prop firms con sus reglas oficiales, para rellenar una cuenta eligiendo el
 * plan en vez de teclear ocho numeros que casi nadie se sabe de memoria. Existe porque
 * las reglas de cobro se desplegaron el 20 de septiembre de 2026 y, un dia despues,
 * ninguna cuenta las tenia puestas.
 *
 * Solo Lucid de momento: es la firma de 20 de los 30 usuarios que han creado alguna.
 * Anadir otra es anadir un objeto a `firmCatalog` — el formulario no sabe de firmas
 * concretas.
 *
 * ESTOS DATOS CADUCAN. Las firmas cambian sus reglas a menudo (Lucid subio la
 * consistencia de Pro del 35 al 40 % en noviembre de 2025), y un valor precargado
 * equivocado es peor que un campo vacio, porque parece un dato. Por eso cada firma lleva
 * la fecha en la que se comprobo y de donde sale, y el formulario la ensena. Al
 * revisarlos, sacarlos siempre de la pagina de soporte oficial, no de blogs.
 *
 * Elegir un plan COPIA sus valores a la cuenta; la cuenta no guarda de que plan viene.
 * Asi una revision del catalogo no cambia en silencio las reglas de cuentas que ya
 * existen — que es justo lo que hacen las firmas (Lucid mantuvo el 35 % a las cuentas
 * compradas antes del cambio).
 */

type PhaseRules = {
  /** Solo evaluacion: en una fondeada no hay objetivo de fase. */
  phaseTarget?: number;
  maxDrawdown: number;
  drawdownType: DrawdownType;
  trailLockOffset?: number;
  dailyDrawdown?: number;
  consistencyPct?: number;
  minProfitDays?: number;
  profitDayMin?: number;
  payoutMin?: number;
  withdrawMinProfit?: number;
};

export type CatalogPlan = {
  id: string;
  /** El programa de la firma ("Flex", "Pro"): va en el nombre propuesto de la cuenta. */
  program: string;
  size: number;
  evaluation: PhaseRules;
  funded: PhaseRules;
};

export type CatalogFirm = {
  id: string;
  name: string;
  /** Trozos que, apareciendo en el nombre de la empresa, la identifican. Los nombres los
   *  escribe cada usuario ("lucid", "Lucid Trading", "lucid 1"), asi que se busca por
   *  contenido y no por igualdad. */
  match: string[];
  /** Cuando se comprobaron los valores contra la fuente oficial (AAAA-MM-DD). */
  verifiedAt: string;
  sources: string[];
  plans: CatalogPlan[];
};

/* Lucid, revisado el 21 de septiembre de 2026 contra support.lucidtrading.com. Los dos
   programas comparten objetivo y MLL por tamano, y en los dos el MLL es EOD trailing y
   se bloquea en el balance inicial + 100 $. Lo que los separa:

   Flex — evaluacion con consistencia del 50 % y sin limite diario. Fondeada sin
   consistencia, con 5 dias rentables por ciclo (de 100/150/200/250 $ segun tamano).
   Retiro minimo de 500 $ con tope del 50 % del beneficio: hacen falta 1.000 $ de
   beneficio en la cuenta para poder pedir el minimo. El ciclo solo tiene que acabar en
   positivo (1 $), y eso no se carga como objetivo: "210 / 1 $" se leeria como un error.

   Pro — evaluacion sin consistencia y con limite diario (salvo en 25K). Fondeada con
   consistencia del 40 % (35 % en cuentas compradas antes del 28/11/2025) y un objetivo
   por ciclo de 250/500/750/1.000 $. No se puede retirar del colchon, que es el MLL
   inicial + 100 $, asi que con el retiro minimo de 500 $ hacen falta MLL + 600 $ de
   beneficio. Su limite diario fondeado pasa a ser el 60 % del mejor cierre una vez
   superado el balance de trail; eso no se puede expresar con un numero fijo y se carga el
   de la primera fase. */
const lucidSizes = [
  { size: 25_000, target: 1_250, mll: 1_000, dailyLimit: undefined, flexDayMin: 100, proCycleGoal: 250 },
  { size: 50_000, target: 3_000, mll: 2_000, dailyLimit: 1_200, flexDayMin: 150, proCycleGoal: 500 },
  { size: 100_000, target: 6_000, mll: 3_000, dailyLimit: 1_800, flexDayMin: 200, proCycleGoal: 750 },
  { size: 150_000, target: 9_000, mll: 4_500, dailyLimit: 2_700, flexDayMin: 250, proCycleGoal: 1_000 },
];

const LUCID_LOCK_OFFSET = 100;
const LUCID_MIN_WITHDRAWAL = 500;

const lucid: CatalogFirm = {
  id: "lucid",
  name: "Lucid Trading",
  match: ["lucid"],
  verifiedAt: "2026-09-21",
  sources: [
    "https://support.lucidtrading.com/en/articles/12945790-lucidflex-evaluation-account",
    "https://support.lucidtrading.com/en/articles/12945815-lucidflex-drawdown",
    "https://support.lucidtrading.com/en/articles/12945796-lucidflex-payouts",
    "https://support.lucidtrading.com/en/articles/12890029-lucidpro-evaluation-account",
    "https://support.lucidtrading.com/en/articles/12890136-lucidpro-drawdown",
    "https://support.lucidtrading.com/en/articles/12890122-lucidpro-daily-loss-limit",
    "https://support.lucidtrading.com/en/articles/12890092-lucidpro-payouts",
  ],
  plans: [
    ...lucidSizes.map(
      (tier): CatalogPlan => ({
        id: `lucid-flex-${tier.size / 1000}k`,
        program: "Flex",
        size: tier.size,
        evaluation: {
          phaseTarget: tier.target,
          maxDrawdown: tier.mll,
          drawdownType: "trailing",
          trailLockOffset: LUCID_LOCK_OFFSET,
          consistencyPct: 50,
        },
        funded: {
          maxDrawdown: tier.mll,
          drawdownType: "trailing",
          trailLockOffset: LUCID_LOCK_OFFSET,
          minProfitDays: 5,
          profitDayMin: tier.flexDayMin,
          /* El retiro minimo, a un tope del 50 %, pide el doble de beneficio. */
          withdrawMinProfit: LUCID_MIN_WITHDRAWAL * 2,
        },
      }),
    ),
    ...lucidSizes.map(
      (tier): CatalogPlan => ({
        id: `lucid-pro-${tier.size / 1000}k`,
        program: "Pro",
        size: tier.size,
        evaluation: {
          phaseTarget: tier.target,
          maxDrawdown: tier.mll,
          drawdownType: "trailing",
          trailLockOffset: LUCID_LOCK_OFFSET,
          dailyDrawdown: tier.dailyLimit,
        },
        funded: {
          maxDrawdown: tier.mll,
          drawdownType: "trailing",
          trailLockOffset: LUCID_LOCK_OFFSET,
          dailyDrawdown: tier.dailyLimit,
          consistencyPct: 40,
          payoutMin: tier.proCycleGoal,
          /* El colchon (MLL + 100) no se puede retirar, y por encima hay que llegar al
             retiro minimo. */
          withdrawMinProfit: tier.mll + LUCID_LOCK_OFFSET + LUCID_MIN_WITHDRAWAL,
        },
      }),
    ),
  ],
};

export const firmCatalog: CatalogFirm[] = [lucid];

function normalizeFirmName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCatalogFirm(firmName?: string): CatalogFirm | undefined {
  const key = normalizeFirmName(firmName || "");
  if (!key) return undefined;
  return firmCatalog.find((firm) => firm.match.some((token) => key.includes(token)));
}

/** "Flex 50K": la etiqueta del plan en el selector. */
export function formatPlanLabel(plan: CatalogPlan) {
  return `${plan.program} ${plan.size / 1000}K`;
}

/**
 * Los campos que el plan pone en el formulario para ese tipo de cuenta. Devuelve TODOS
 * los campos de reglas, tambien los que el plan no tiene (en undefined): al pasar de un
 * Pro a un Flex tiene que desaparecer el limite diario y la consistencia del Pro, no
 * quedarse colgados de la eleccion anterior. Capital propio no tiene plan.
 */
export function applyCatalogPlan(plan: CatalogPlan, kind: AccountKind): Partial<AccountInput> {
  if (kind === "own") return {};
  const rules = kind === "funded" ? plan.funded : plan.evaluation;
  return {
    size: `${plan.size / 1000}K`,
    phaseTarget: kind === "challenge" ? rules.phaseTarget : undefined,
    maxDrawdown: rules.maxDrawdown,
    drawdownType: rules.drawdownType,
    trailLockOffset: rules.trailLockOffset,
    dailyDrawdown: rules.dailyDrawdown,
    consistencyPct: rules.consistencyPct,
    minProfitDays: rules.minProfitDays,
    profitDayMin: rules.profitDayMin,
    payoutMin: rules.payoutMin,
    withdrawMinProfit: rules.withdrawMinProfit,
  };
}

const ruleFields = [
  "phaseTarget",
  "maxDrawdown",
  "drawdownType",
  "trailLockOffset",
  "dailyDrawdown",
  "consistencyPct",
  "minProfitDays",
  "profitDayMin",
  "payoutMin",
  "withdrawMinProfit",
] as const;

/**
 * El plan cuyas reglas coinciden EXACTAMENTE con las del formulario, o undefined. Es lo
 * que permite no guardar el plan en la cuenta: al abrir una cuenta rellenada desde el
 * catalogo el selector vuelve a mostrar su plan, y en cuanto el usuario cambia un solo
 * numero deja de coincidir y el selector lo dice (vuelve a "elige un plan"), en vez de
 * afirmar que la cuenta sigue un plan que ya no sigue.
 * Flex y Pro se distinguen aunque compartan objetivo y MLL: el limite diario, la
 * consistencia o los dias rentables siempre son distintos entre los dos.
 */
export function matchCatalogPlan(firm: CatalogFirm, input: AccountInput): CatalogPlan | undefined {
  if (input.kind === "own") return undefined;
  const size = parseAccountSizeAmount(input.size);
  return firm.plans.find((plan) => {
    if (plan.size !== size) return false;
    const expected = applyCatalogPlan(plan, input.kind);
    /* Un 0 que llegue de la base de datos cuenta como "sin valor", igual que undefined:
       los tres limites antiguos (objetivo y drawdowns) se guardan a 0 cuando no hay. */
    return ruleFields.every((field) => (expected[field] || undefined) === (input[field] || undefined));
  });
}
