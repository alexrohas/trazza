/* Calculadora publica "¿Puedo cobrar ya en Lucid?" (web/calculadora-lucid/index.html).
 *
 * Es la puerta de entrada sin registro: resuelve en un minuto la pregunta que mas cuesta
 * en las prop firms de futuros y, al final, enseña que Trazza la responde sola con cada
 * cuenta. Por eso no tiene reglas propias: el calculo es lib/payoutCalculator.ts, que
 * monta una cuenta y un journal y se los pasa al mismo motor que usa la app.
 *
 * Como la landing, es progresiva y no trae React. El castellano esta en el HTML y aqui
 * solo el ingles; lo que se pinta segun el resultado (veredicto, filas, tablas) lleva
 * sus dos idiomas en `copy`, porque no existe en el HTML.
 *
 * Lo que escribe el visitante no sale del navegador: se guarda solo en la direccion
 * (para poder compartir el calculo), y la analitica de Vercel no lee la query.
 */

import { setUpSite, type Language } from "../landing/site";
import {
  firmCatalog,
  formatCatalogDate,
  applyCatalogPlan,
  type CatalogPlan,
  type WithdrawalRules,
} from "../lib/firmCatalog";
import { formatAmount, formatPercentCompact } from "../lib/metrics";
import { evaluatePayoutCycle, parseAmount, type CalculatorPhase, type CalculatorResult } from "../lib/payoutCalculator";
import type { AccountRuleCheck } from "../lib/accountRules";

import "../landing/landing.css";
import "./calculator.css";

const lucid = firmCatalog.find((firm) => firm.id === "lucid")!;

const en: Record<string, string> = {
  "nav.skip": "Skip to the calculator",
  "nav.sectionsAria": "Sections",
  "nav.calculator": "Calculator",
  "nav.rules": "Lucid rules",
  "nav.faq": "Questions",
  "nav.trazza": "What is Trazza",
  "nav.languageAria": "Cambiar a español",
  "nav.themeAria": "Switch theme",
  "nav.signin": "Log in",
  "nav.signup": "Sign up",

  "hero.kicker": "Free calculator · Lucid Trading",
  "hero.title": "Can I get paid yet on Lucid?",
  "hero.lede":
    "Pick your plan, enter each day's result and we'll tell you what's left according to Lucid's official rules. No sign-up.",

  "form.program": "Program",
  "form.size": "Size",
  "form.phase": "Phase",
  "form.challenge": "Evaluation",
  "form.funded": "Funded",
  "form.paidBefore": "I've already been paid out from this account",
  "form.balance": "Current account balance ($)",
  "form.addDay": "Add day",
  "form.hint": "Each closed day's net result, after fees. Days without trading don't count.",

  "result.fine":
    "Lucid's official rules, checked on September 21, 2026. With daily closes we can't see what happens during the day, and Lucid may change its terms: always confirm them with its support. Trazza is not affiliated with Lucid Trading.",
  "result.source": "Lucid support",
  "result.ctaText":
    "Trazza does this on its own for every one of your accounts, from your journal. And it also tracks your costs, your payouts and the quarterly summary for your accountant.",
  "result.cta": "Try Trazza free for 14 days",

  "rules.kicker": "Lucid rules",
  "rules.title": "Every plan's rules, in one table.",
  "rules.lede":
    "These are the ones the calculator uses. They come from Lucid's support pages, not from blogs, and carry the date they were checked.",
  "rules.challenge": "Evaluation",
  "rules.funded": "Funded",
  "rules.note":
    "The MLL is an end-of-day trailing drawdown that locks at the starting balance plus $100. The funded Pro daily limit becomes 60% of the best close once the trail balance is passed; this shows the first-phase one. On Pro, the max per payout goes up from the second one.",

  "faq.kicker": "Questions",
  "faq.title": "What people ask most about getting paid on Lucid.",
  "faq.q1": "How does Lucid's consistency rule work?",
  "faq.a1":
    "Your best day can't weigh more than a share of the profit: 50% in the Flex evaluation and 40% in funded Pro accounts (35% if you bought it before November 28, 2025). If your best day weighs too much, you need to make more on other days: making it on that same day raises both figures at once.",
  "faq.q2": "How many profitable days does Lucid Flex require to get paid?",
  "faq.a2":
    "A funded Flex account needs five profitable days per cycle, and a day only counts if it clears a minimum that depends on the size: $100 on 25K, $150 on 50K, $200 on 100K and $250 on 150K.",
  "faq.q3": "How much can I withdraw on Lucid?",
  "faq.a3":
    "Lucid asks for a $500 minimum withdrawal, and you receive 90% of each payout. On Flex you withdraw half of the profit, so you need $1,000 in the account, capped per payout at $1,000 (25K), $2,000 (50K), $2,500 (100K) or $3,000 (150K). On Pro you withdraw whatever is above the cushion of the MLL plus $100 (on a 50K you need $2,600 for the minimum), with the same caps on the first payout and $1,500, $2,500, $3,000 or $3,500 from the second.",
  "faq.q4": "How does Lucid's MLL work?",
  "faq.a4": "It's an end-of-day trailing drawdown: it rises with your best close and locks once it reaches the starting balance plus $100.",
  "faq.q5": "What is Trazza?",
  "faq.a5":
    "A journal and finance tracker for funded futures accounts. It runs this calculation on its own for each of your accounts, from what you log, and it also tracks your costs, your payouts and a quarterly summary. 14 days free, no card.",

  "footer.tagline": "Payout rules, journal and finances for funded accounts.",
  "footer.navAria": "Links",
  "footer.home": "Home",
  "footer.legal": "Legal notice",
  "footer.privacy": "Privacy",
  "footer.cookies": "Cookies",
  "footer.terms": "Terms",
};

/* Lo que depende del resultado y no esta en el HTML. "+" y sin verbo en lo que falta,
   como en la app: el signo funciona igual en los dos idiomas y se salta la concordancia. */
const copy = {
  es: {
    daysLabel: {
      challenge: "Resultado de cada día de la evaluación ($)",
      fundedStart: "Resultado de cada día desde el inicio ($)",
      fundedCycle: "Resultado de cada día desde el último payout ($)",
    },
    day: "Día",
    removeDay: "Quitar el día",
    empty: { title: "Apunta tus días", text: "Con el resultado de cada día te diremos qué te falta." },
    readyFunded: { title: "Puedes pedir el payout", text: "Cumples todas las reglas de cobro de tu plan." },
    readyChallenge: { title: "Evaluación superada", text: "Llegas al objetivo y cumples las reglas de la evaluación." },
    breached: {
      title: "Has tocado el MLL",
      text: (day: number, close: string, limit: string) =>
        `El día ${day} cerraste en ${close}, y el límite estaba en ${limit}. La cuenta estaría perdida.`,
    },
    pending: {
      title: "Todavía no",
      text: (count: number) => (count === 1 ? "Te falta cumplir 1 regla." : `Te faltan ${count} reglas por cumplir.`),
    },
    cycleProfit: "Beneficio del ciclo",
    profitSoFar: "Beneficio",
    balance: "Balance",
    floor: "MLL",
    target: "Objetivo",
    payoutMin: "Objetivo del ciclo",
    withdrawMin: "Beneficio para retirar",
    profitDays: "Días rentables",
    consistency: "Consistencia",
    minPrefix: "mín.",
    limitPrefix: "límite",
    noProfitYet: "Sin beneficio todavía",
    dayUnit: "día",
    daysUnit: "días",
    share: "Copiar enlace con tu cálculo",
    shared: "Enlace copiado",
    withdraw: {
      ready: "Retiro disponible",
      pending: "Retiro al cumplir las reglas",
      share: (pct: string, profit: string, cap: string) =>
        `El ${pct} de tu beneficio (${profit}), con un tope de ${cap} por payout.`,
      buffer: (profit: string, buffer: string, cap: string, first: boolean) =>
        `Tu beneficio (${profit}) menos el colchón de ${buffer} (MLL + 100 $), con un tope de ${cap} ${
          first ? "en el primer payout" : "por payout"
        }.`,
      net: (net: string, pct: string) => `Te llegan ${net} con el reparto del ${pct}.`,
      belowMinimum: (min: string) => `Lucid pide retirar ${min} como poco, y aún no llegas.`,
    },
    table: {
      plan: "Plan",
      target: "Objetivo",
      mll: "MLL",
      daily: "Límite diario",
      consistency: "Consistencia",
      profitDays: "Días rentables",
      payoutMin: "Objetivo del ciclo",
      withdrawMin: "Beneficio para retirar",
      withdrawMax: "Máx. por payout",
      none: "—",
      checked: "Revisadas el",
    },
  },
  en: {
    daysLabel: {
      challenge: "Each day's result in the evaluation ($)",
      fundedStart: "Each day's result since the start ($)",
      fundedCycle: "Each day's result since your last payout ($)",
    },
    day: "Day",
    removeDay: "Remove day",
    empty: { title: "Enter your days", text: "With each day's result we'll tell you what's left." },
    readyFunded: { title: "You can request a payout", text: "You meet every payout rule of your plan." },
    readyChallenge: { title: "Evaluation passed", text: "You hit the target and meet the evaluation rules." },
    breached: {
      title: "You hit the MLL",
      text: (day: number, close: string, limit: string) =>
        `On day ${day} you closed at ${close}, and the limit was at ${limit}. The account would be lost.`,
    },
    pending: {
      title: "Not yet",
      text: (count: number) => (count === 1 ? "1 rule still to meet." : `${count} rules still to meet.`),
    },
    cycleProfit: "Cycle profit",
    profitSoFar: "Profit",
    balance: "Balance",
    floor: "MLL",
    target: "Target",
    payoutMin: "Cycle target",
    withdrawMin: "Profit to withdraw",
    profitDays: "Profitable days",
    consistency: "Consistency",
    minPrefix: "min.",
    limitPrefix: "limit",
    noProfitYet: "No profit yet",
    dayUnit: "day",
    daysUnit: "days",
    share: "Copy link to your calculation",
    shared: "Link copied",
    withdraw: {
      ready: "Available to withdraw",
      pending: "Withdrawable once you meet the rules",
      share: (pct: string, profit: string, cap: string) => `${pct} of your profit (${profit}), capped at ${cap} per payout.`,
      buffer: (profit: string, buffer: string, cap: string, first: boolean) =>
        `Your profit (${profit}) minus the ${buffer} buffer (MLL + 100 $), capped at ${cap} ${
          first ? "on the first payout" : "per payout"
        }.`,
      net: (net: string, pct: string) => `You receive ${net} after the ${pct} split.`,
      belowMinimum: (min: string) => `Lucid's minimum withdrawal is ${min}, and you're not there yet.`,
    },
    table: {
      plan: "Plan",
      target: "Target",
      mll: "MLL",
      daily: "Daily limit",
      consistency: "Consistency",
      profitDays: "Profitable days",
      payoutMin: "Cycle target",
      withdrawMin: "Profit to withdraw",
      withdrawMax: "Max per payout",
      none: "—",
      checked: "Checked on",
    },
  },
} as const;

/* Dinero de Lucid: siempre en dolares. Mismo formato que la app (es-ES) para que una
   cifra se lea igual aqui que dentro del producto, pero con "$" y no "US$": aqui no hay
   otra divisa con la que confundirlo, y en un movil esos dos caracteres por cifra partian
   en dos lineas los nombres de las reglas. */
const money = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(value);
const moneyRound = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(value);

/* ─── ESTADO ─────────────────────────────────────────────────────────────────── */

type Program = "Flex" | "Pro";
const SIZES = [25_000, 50_000, 100_000, 150_000];
const MAX_DAYS = 60;

const state = {
  program: "Flex" as Program,
  size: 50_000,
  phase: "funded" as CalculatorPhase,
  paidBefore: false,
  balance: "",
  days: ["", "", ""] as string[],
};

let language: Language = "es";

/* El calculo viaja en la direccion para poder compartirlo (en Discord, en Telegram): es
   la forma de que una respuesta de la calculadora llegue a quien no la ha abierto. */
function readUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const program = params.get("p");
  if (program === "flex" || program === "pro") state.program = program === "pro" ? "Pro" : "Flex";
  const size = Number(params.get("s")) * 1000;
  if (SIZES.includes(size)) state.size = size;
  const phase = params.get("f");
  if (phase === "e" || phase === "f") state.phase = phase === "e" ? "challenge" : "funded";
  const balance = params.get("b");
  if (balance && parseAmount(balance) !== null) {
    state.paidBefore = true;
    state.balance = balance;
  }
  const days = params.get("d");
  if (days) {
    const parsed = days.split(",").filter((value) => parseAmount(value) !== null).slice(0, MAX_DAYS);
    if (parsed.length) state.days = parsed;
  }
}

function writeUrl(): void {
  const params = new URLSearchParams();
  params.set("p", state.program.toLowerCase());
  params.set("s", String(state.size / 1000));
  params.set("f", state.phase === "challenge" ? "e" : "f");
  const days = state.days.map((value) => parseAmount(value)).filter((value): value is number => value !== null);
  if (days.length) params.set("d", days.join(","));
  const balance = parseAmount(state.balance);
  if (state.phase === "funded" && state.paidBefore && balance !== null) params.set("b", String(balance));
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

function currentPlan(): CatalogPlan {
  return lucid.plans.find((plan) => plan.program === state.program && plan.size === state.size)!;
}

/* ─── FORMULARIO ─────────────────────────────────────────────────────────────── */

const form = document.querySelector<HTMLFormElement>(".calc-form")!;
const daysList = document.querySelector<HTMLOListElement>("[data-days]")!;
const daysLabel = document.querySelector<HTMLElement>("[data-days-label]")!;
const paidBefore = document.querySelector<HTMLInputElement>("[data-paid-before]")!;
const balanceRow = document.querySelector<HTMLElement>("[data-balance-row]")!;
const balanceInput = document.querySelector<HTMLInputElement>("[data-balance]")!;
const fundedOnly = document.querySelector<HTMLElement>("[data-funded-only]")!;

function paintChoices(): void {
  const selected: Record<string, string> = {
    program: state.program,
    size: String(state.size),
    phase: state.phase,
  };
  form.querySelectorAll<HTMLElement>("[data-group]").forEach((group) => {
    group.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === selected[group.dataset.group!]));
    });
  });
  fundedOnly.hidden = state.phase !== "funded";
  paidBefore.checked = state.paidBefore;
  balanceRow.hidden = !(state.phase === "funded" && state.paidBefore);
  balanceInput.value = state.balance;
}

function paintDays(focusIndex?: number): void {
  const text = copy[language];
  daysList.replaceChildren(
    ...state.days.map((value, index) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      label.className = "calc-day";
      const name = document.createElement("span");
      name.textContent = `${text.day} ${index + 1}`;
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.placeholder = "0";
      input.value = value;
      input.dataset.index = String(index);
      input.setAttribute("aria-invalid", String(value.trim() !== "" && parseAmount(value) === null));
      label.append(name, input);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "calc-remove";
      remove.dataset.remove = String(index);
      remove.disabled = state.days.length <= 1;
      remove.setAttribute("aria-label", `${text.removeDay} ${index + 1}`);
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

      item.append(label, remove);
      return item;
    }),
  );
  if (focusIndex !== undefined) daysList.querySelectorAll("input")[focusIndex]?.focus();
}

function paintDaysLabel(): void {
  const labels = copy[language].daysLabel;
  daysLabel.textContent =
    state.phase === "challenge" ? labels.challenge : state.paidBefore ? labels.fundedCycle : labels.fundedStart;
}

form.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const choice = target.closest<HTMLButtonElement>("[data-group] button");
  if (choice) {
    const group = choice.closest<HTMLElement>("[data-group]")!.dataset.group;
    const value = choice.dataset.value!;
    if (group === "program") state.program = value as Program;
    if (group === "size") state.size = Number(value);
    if (group === "phase") state.phase = value as CalculatorPhase;
    update();
    return;
  }
  const remove = target.closest<HTMLButtonElement>("[data-remove]");
  if (remove && state.days.length > 1) {
    state.days.splice(Number(remove.dataset.remove), 1);
    paintDays();
    update();
  }
});

document.querySelector("[data-add-day]")!.addEventListener("click", () => addDay());

function addDay(): void {
  if (state.days.length >= MAX_DAYS) return;
  state.days.push("");
  paintDays(state.days.length - 1);
  update();
}

daysList.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  const index = Number(input.dataset.index);
  state.days[index] = input.value;
  input.setAttribute("aria-invalid", String(input.value.trim() !== "" && parseAmount(input.value) === null));
  update();
});

/* Intro en el ultimo dia añade otro: apuntar una semana entera sin tocar el raton. */
daysList.addEventListener("keydown", (event) => {
  const input = event.target as HTMLInputElement;
  if (event.key !== "Enter" || !input.dataset.index) return;
  event.preventDefault();
  const index = Number(input.dataset.index);
  if (index === state.days.length - 1) addDay();
  else daysList.querySelectorAll("input")[index + 1]?.focus();
});

paidBefore.addEventListener("change", () => {
  state.paidBefore = paidBefore.checked;
  update();
  if (state.paidBefore) balanceInput.focus();
});

balanceInput.addEventListener("input", () => {
  state.balance = balanceInput.value;
  balanceInput.setAttribute("aria-invalid", String(balanceInput.value.trim() !== "" && parseAmount(balanceInput.value) === null));
  update();
});

form.addEventListener("submit", (event) => event.preventDefault());

/* ─── RESULTADO ─────────────────────────────────────────────────────────────── */

const verdict = document.querySelector<HTMLElement>("[data-verdict]")!;
const verdictTitle = document.querySelector<HTMLElement>("[data-verdict-title]")!;
const verdictText = document.querySelector<HTMLElement>("[data-verdict-text]")!;
const summary = document.querySelector<HTMLElement>("[data-summary]")!;
const withdrawBox = document.querySelector<HTMLElement>("[data-withdraw]")!;
const withdrawLabel = document.querySelector<HTMLElement>("[data-withdraw-label]")!;
const withdrawAmount = document.querySelector<HTMLElement>("[data-withdraw-amount]")!;
const withdrawText = document.querySelector<HTMLElement>("[data-withdraw-text]")!;
const rulesList = document.querySelector<HTMLUListElement>("[data-rules]")!;
const shareButton = document.querySelector<HTMLButtonElement>("[data-share]")!;
const shareLabel = document.querySelector<HTMLElement>("[data-share-label]")!;

type Row = { name: string; extra?: string; value: string; missing?: string; met: boolean };

function checkRow(check: AccountRuleCheck, result: CalculatorResult): Row {
  const text = copy[language];
  const missing =
    check.missing !== undefined && check.missing > 0
      ? check.id === "profitDays"
        ? `+${check.missing} ${check.missing === 1 ? text.dayUnit : text.daysUnit}`
        : `+${money(check.missing)}`
      : undefined;

  if (check.id === "profitDays") {
    return {
      name: text.profitDays,
      extra: result.account.profitDayMin ? `${text.minPrefix} ${moneyRound(result.account.profitDayMin)}` : undefined,
      value: `${check.current} / ${check.required}`,
      missing,
      met: check.met,
    };
  }
  if (check.id === "payoutMin" || check.id === "withdrawMin") {
    return {
      name: check.id === "payoutMin" ? text.payoutMin : text.withdrawMin,
      value: `${formatAmount(check.current)} / ${money(check.required)}`,
      missing,
      met: check.met,
    };
  }
  return {
    name: text.consistency,
    value:
      !check.missing && !check.current
        ? text.noProfitYet
        : `${formatPercentCompact(check.current / 100)} · ${text.limitPrefix} ${formatPercentCompact(check.required / 100)}`,
    missing,
    met: check.met,
  };
}

function paintResult(): void {
  const text = copy[language];
  const plan = currentPlan();
  const days = state.days.map((value) => parseAmount(value)).filter((value): value is number => value !== null);
  const balance = state.phase === "funded" && state.paidBefore ? parseAmount(state.balance) ?? undefined : undefined;
  const paidBefore = state.phase === "funded" && state.paidBefore;
  const result = evaluatePayoutCycle({ plan, phase: state.phase, days, paidBefore, balance });

  /* Veredicto. */
  let tone: "empty" | "ready" | "breached" | "pending" = "pending";
  const rows: Row[] = [];
  if (result.target) {
    rows.push({
      name: text.target,
      value: `${formatAmount(result.target.current)} / ${money(result.target.required)}`,
      missing: result.target.missing > 0 ? `+${money(result.target.missing)}` : undefined,
      met: result.target.met,
    });
  }
  result.rules?.checks.forEach((check) => rows.push(checkRow(check, result)));

  if (!days.length) {
    tone = "empty";
    verdictTitle.textContent = text.empty.title;
    verdictText.textContent = text.empty.text;
  } else if (result.breachedDay !== undefined && result.breach) {
    tone = "breached";
    verdictTitle.textContent = text.breached.title;
    verdictText.textContent = text.breached.text(result.breachedDay + 1, money(result.breach.close), money(result.breach.floor));
  } else if (result.ready) {
    tone = "ready";
    const ready = state.phase === "funded" ? text.readyFunded : text.readyChallenge;
    verdictTitle.textContent = ready.title;
    verdictText.textContent = ready.text;
  } else {
    const pending = rows.filter((row) => !row.met).length;
    verdictTitle.textContent = text.pending.title;
    verdictText.textContent = text.pending.text(pending);
  }
  verdict.dataset.tone = tone;

  /* Cuanto se puede retirar: es la cifra que se viene a buscar con una fondeada, asi que
     sale tambien con reglas pendientes, como lo que daria el balance de ahora; la etiqueta
     dice que aun no. Con el MLL roto no hay nada que pedir. */
  const withdrawal = tone === "breached" ? undefined : result.withdrawal;
  withdrawBox.hidden = !withdrawal;
  if (withdrawal) {
    const { rules } = withdrawal;
    const settled = result.ready || withdrawal.belowMinimum;
    withdrawBox.dataset.tone = withdrawal.belowMinimum ? "empty" : result.ready ? "ready" : "pending";
    withdrawLabel.textContent = settled ? text.withdraw.ready : text.withdraw.pending;
    withdrawAmount.textContent = money(withdrawal.amount);
    const basis =
      rules.profitShare !== undefined
        ? text.withdraw.share(formatPercentCompact(rules.profitShare), money(withdrawal.accountProfit), moneyRound(withdrawal.cap))
        : text.withdraw.buffer(
            money(withdrawal.accountProfit),
            moneyRound(rules.buffer ?? 0),
            moneyRound(withdrawal.cap),
            withdrawal.firstPayout && rules.maxFirst !== rules.maxLater,
          );
    const outcome = withdrawal.belowMinimum
      ? text.withdraw.belowMinimum(moneyRound(rules.minimum))
      : text.withdraw.net(money(withdrawal.net), formatPercentCompact(rules.traderSplit));
    withdrawText.textContent = `${basis} ${outcome}`;
  }

  /* Resumen: el beneficio del ciclo siempre, y balance y MLL solo cuando se conoce toda
     la historia de la cuenta (en una fondeada que ya cobro, el MLL depende de lo de antes
     del ciclo). */
  summary.hidden = !days.length;
  const parts: string[] = [];
  parts.push(`${state.phase === "funded" ? text.cycleProfit : text.profitSoFar} <b>${money(result.cycleProfit)}</b>`);
  if (result.balance !== undefined) parts.push(`${text.balance} <b>${money(result.balance)}</b>`);
  if (result.floor !== undefined) parts.push(`${text.floor} <b>${money(result.floor)}</b>`);
  summary.innerHTML = parts.map((part) => `<span>${part}</span>`).join("");

  /* Con el MLL roto la cuenta ya no tiene payout que pedir: "+5.100 $ para el objetivo" o
     una consistencia "cumplida" se leerian como si aun quedara algo por hacer en ella. */
  rulesList.hidden = !days.length || !rows.length || tone === "breached";
  rulesList.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement("li");
      item.className = row.met ? "is-met" : "is-pending";
      const name = document.createElement("span");
      name.textContent = row.name;
      if (row.extra) {
        const extra = document.createElement("small");
        extra.textContent = row.extra;
        name.append(extra);
      }
      const value = document.createElement("b");
      value.textContent = row.value;
      const missing = document.createElement("em");
      missing.textContent = row.missing ?? "";
      item.append(name, value, missing);
      return item;
    }),
  );

  shareButton.hidden = !days.length;
}

shareButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareLabel.textContent = copy[language].shared;
    window.setTimeout(() => (shareLabel.textContent = copy[language].share), 2000);
  } catch {
    /* Sin permiso de portapapeles: la direccion ya lleva el calculo y se puede copiar a mano. */
  }
});

/* ─── TABLAS DE REGLAS ──────────────────────────────────────────────────────── */

/* Salen del catalogo, no del HTML: si el catalogo se revisa, las tablas no pueden decir
   otra cosa que lo que calcula la calculadora. */
function paintTables(): void {
  const text = copy[language].table;
  const none = text.none;
  const cell = (value: number | undefined, format: (value: number) => string) => (value ? format(value) : none);
  const percent = (value: number) => `${value} %`;
  /* En Pro el primer payout tiene un tope menor que los siguientes: "2.000 $ → 2.500 $". */
  const withdrawMaxCell = (withdrawal: WithdrawalRules | undefined) => {
    if (!withdrawal) return none;
    if (withdrawal.maxFirst === withdrawal.maxLater) return moneyRound(withdrawal.maxFirst);
    return `${moneyRound(withdrawal.maxFirst)} → ${moneyRound(withdrawal.maxLater)}`;
  };

  const build = (phase: CalculatorPhase) => {
    const columns =
      phase === "challenge"
        ? [text.plan, text.target, text.mll, text.daily, text.consistency]
        : [text.plan, text.profitDays, text.payoutMin, text.consistency, text.withdrawMin, text.withdrawMax, text.mll];
    const rows = lucid.plans.map((plan) => {
      const rules = applyCatalogPlan(plan, phase);
      const name = `${plan.program} ${plan.size / 1000}K`;
      if (phase === "challenge") {
        return [
          name,
          cell(rules.phaseTarget, moneyRound),
          cell(rules.maxDrawdown, moneyRound),
          cell(rules.dailyDrawdown, moneyRound),
          cell(rules.consistencyPct, percent),
        ];
      }
      return [
        name,
        rules.minProfitDays ? `${rules.minProfitDays} × ${moneyRound(rules.profitDayMin ?? 0)}` : none,
        cell(rules.payoutMin, moneyRound),
        cell(rules.consistencyPct, percent),
        cell(rules.withdrawMinProfit, moneyRound),
        withdrawMaxCell(plan.funded.withdrawal),
        cell(rules.maxDrawdown, moneyRound),
      ];
    });
    return { columns, rows };
  };

  document.querySelectorAll<HTMLTableElement>("[data-table]").forEach((table) => {
    const { columns, rows } = build(table.dataset.table as CalculatorPhase);
    const head = `<thead><tr>${columns.map((column) => `<th scope="col">${column}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${rows
      .map((row) => `<tr>${row.map((value, index) => (index === 0 ? `<th scope="row">${value}</th>` : `<td>${value}</td>`)).join("")}</tr>`)
      .join("")}</tbody>`;
    table.innerHTML = `<caption>${text.checked} ${formatCatalogDate(lucid.verifiedAt, language)}</caption>${head}${body}`;
  });
}

/* ─── ARRANQUE ──────────────────────────────────────────────────────────────── */

function update(): void {
  paintChoices();
  paintDaysLabel();
  paintResult();
  writeUrl();
}

readUrl();
setUpSite({
  en,
  name: "calculadora",
  onLanguage: (next) => {
    language = next;
    paintDays();
    paintTables();
    shareLabel.textContent = copy[language].share;
    update();
  },
});
