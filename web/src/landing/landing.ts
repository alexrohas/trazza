/* Comportamiento de la landing publica.
 *
 * Todo lo de aqui es progresivo: si este script no llega a ejecutarse, la pagina sigue
 * siendo legible y navegable en castellano, con el tema claro y el precio anual. Es la
 * razon de que el estado inicial del scroll-reveal dependa de una clase que pone el
 * propio script (.js-reveal) y no de una regla suelta en el CSS.
 *
 * Tema, idioma, cabecera y analitica viven en site.ts, que comparte con la calculadora
 * de Lucid. Aqui queda solo lo propio de esta pagina: el diccionario ingles, el precio y
 * la entrada por scroll.
 */

import { setUpSite, type Language } from "./site";

import "./landing.css";

/* El castellano vive en el HTML y este diccionario solo contiene el ingles (ver site.ts). */
const en: Record<string, string> = {
  "nav.skip": "Skip to content",
  "nav.sectionsAria": "Sections",
  "nav.payout": "Payouts",
  "nav.finance": "Finances",
  "nav.journal": "Journal",
  "nav.pricing": "Pricing",
  "nav.calculator": "Calculator",
  "nav.languageAria": "Cambiar a español",
  "nav.themeAria": "Switch theme",
  "nav.signin": "Log in",
  "nav.signup": "Sign up",

  "hero.eyebrow": "14 days free, no card",
  "hero.titleA": "Know when you can get paid",
  "hero.titleB": "and what you really make.",
  "hero.lede":
    "Trazza tracks your funded accounts with your firm's rules and tells you what's left before you can request a payout. And it cleans up what you spend and what you earn, from your bank statement to the summary for your accountant.",
  "hero.ctaPrimary": "Start 14-day free trial",
  "hero.ctaSecondary": "Can I get paid yet?",
  "hero.trust1": "No card to get started",
  "hero.trust2": "Cancel whenever you want",
  "hero.trust3": "Your data stays yours",

  "payout.kicker": "Payout rules",
  "payout.title": "Stop guessing whether you can request a payout.",
  "payout.lede":
    "Pick your account's plan and Trazza loads its official rules. From what you log in the journal it tells you what's missing: profitable days, consistency, cycle target and minimum profit to withdraw.",
  "payout.b1": "Lucid plans preloaded: Flex and Pro, from 25K to 150K",
  "payout.b2": "Any other firm: enter its rules once and you're set",
  "payout.b3": "Trailing drawdown and room to the limit, always in sight",
  "payout.b4": "If an account hits its limit, mark it failed or reset it in one click",
  "payout.cta": "Try it without signing up",
  "payout.mock.since": "Funded · since the last payout",
  "payout.mock.pending": "1 pending",
  "payout.mock.cycle": "Cycle target",
  "payout.mock.withdraw": "Profit to withdraw",
  "payout.mock.consistency": "Consistency",
  "payout.mock.consistencyValue": "46 % · limit 40 %",

  "finance.kicker": "Finances",
  "finance.title": "Your trading money, clean and without typing it in.",
  "finance.lede":
    "Upload your Revolut or Wise statement and Trazza pulls out your account purchases and payouts, converts them to your currency at the official ECB rate and skips what you already had. Costs and earnings, side by side.",
  "finance.s1.label": "Real net",
  "finance.s1.text": "What is left after costs and withdrawals.",
  "finance.s2.label": "ROI",
  "finance.s2.text": "Return on what you have put in.",
  "finance.s3.label": "Break-even",
  "finance.s3.text": "How far you are from flat.",
  "finance.s4.label": "Third quarter",
  "finance.s4.text": "Earnings minus costs, in euros, ready for your accountant.",
  "finance.l1": "Challenge purchase · Lucid Flex 50K",
  "finance.l2": "Payout · Lucid Flex 50K #2",
  "finance.l3": "Reset · Topstep 100K",
  "finance.l4": "Activation · Topstep 100K",
  "finance.manual": "By hand",
  "finance.t1": "Your statement never leaves your browser",
  "finance.t2": "Official ECB rate for each day",
  "finance.t3": "Quarterly summary with a CSV for your accountant",

  "journal.kicker": "Journal",
  "journal.title": "Turn every session into something you can use.",
  "journal.lede":
    "Screenshot, instrument, direction, discipline, mindset, mistakes and P&L all live in the same entry. Reviewing your week stops being an act of memory.",
  "journal.f1.title": "Visual journal",
  "journal.f1.text":
    "Save every trade with its screenshot, your notes and the mistakes you made, so you can see fast what works and what keeps repeating.",
  "journal.f2.title": "P&L calendar",
  "journal.f2.text":
    "Green days, red days, weekly totals and the month's shape without adding anything up by hand. Streaks show up before they hurt.",
  "journal.f3.title": "Metrics that mean something",
  "journal.f3.text":
    "Winrate, profit factor, avg win/loss and discipline computed from your real entries. Not one figure you had to type twice.",

  "product.kicker": "Product",
  "product.title": "From a single trade to the whole picture.",
  "product.lede":
    "The dashboard sums up how you are doing. The detail views let you drop down to one specific trade when you need the context. Same data, told at two altitudes.",
  "product.b1": "Filters by firm, account, period and instrument",
  "product.b2": "Payout rules, target and drawdown for every account, always in sight",
  "product.b3": "Evaluation and funded accounts linked, with one shared history",
  "product.b4": "Privacy mode to review in public without showing figures",

  "pricing.kicker": "Pricing",
  "pricing.title": "One simple plan, no surprises.",
  "pricing.lede":
    "14 days free, no card. After that, a single plan with everything included.",
  "pricing.switchAria": "Billing period",
  "pricing.monthly": "Monthly",
  "pricing.annual": "Yearly",
  "pricing.save": "Save 30%",
  "pricing.plan": "Trazza complete",
  "pricing.f1": "Payout rules, with Lucid plans preloaded",
  "pricing.f2": "Revolut and Wise statement import",
  "pricing.f3": "Quarterly summary in euros for your accountant",
  "pricing.f4": "Full journal with calendar and metrics",
  "pricing.f5": "Unlimited accounts, firms and movements",
  "pricing.f6": "Cancel from inside the app, no emails to write",
  "pricing.cta": "Start free trial",
  "pricing.fine": "14 days free · We do not ask for a card",

  "closing.title": "Know what's left before your next payout.",
  "closing.text":
    "Fourteen days to load your accounts, log your days and finally see when you can get paid and what you really keep.",
  "closing.cta": "Start 14-day free trial",

  "footer.tagline": "Payout rules, journal and finances for funded accounts.",
  "footer.navAria": "Links",
  "footer.calculator": "Lucid payout calculator",
  "footer.legal": "Legal notice",
  "footer.privacy": "Privacy",
  "footer.cookies": "Cookies",
  "footer.terms": "Terms",
};

/* El precio no es una cadena mas: cambia de formato entre idiomas (42 € / €42) y ademas
   depende del periodo elegido. Se mantiene aparte para que las dos variables —idioma y
   ciclo— se combinen en un solo sitio y no en cuatro cadenas sueltas. */
const pricing: Record<Language, Record<"monthly" | "annual", { amount: string; cycle: string; note: string }>> = {
  es: {
    monthly: { amount: "4,99 €", cycle: "/mes", note: "Facturado cada mes" },
    annual: { amount: "42 €", cycle: "/año", note: "Equivale a 3,50 € al mes" },
  },
  en: {
    monthly: { amount: "€4.99", cycle: "/month", note: "Billed every month" },
    annual: { amount: "€42", cycle: "/year", note: "Works out at €3.50 a month" },
  },
};

let cycle: "monthly" | "annual" = "annual";
let language: Language = "es";

function applyPricing(): void {
  const plan = pricing[language][cycle];
  const amount = document.querySelector("[data-price-amount]");
  const cycleNode = document.querySelector("[data-price-cycle]");
  const note = document.querySelector("[data-price-note]");

  if (amount) amount.textContent = plan.amount;
  if (cycleNode) cycleNode.textContent = plan.cycle;
  if (note) note.textContent = plan.note;

  document.querySelectorAll<HTMLButtonElement>(".pricing-option").forEach((option) => {
    const active = option.dataset.cycle === cycle;
    option.classList.toggle("is-active", active);
    option.setAttribute("aria-pressed", String(active));
  });
}

document.querySelectorAll<HTMLButtonElement>(".pricing-option").forEach((option) => {
  option.addEventListener("click", () => {
    const next = option.dataset.cycle;
    if (next !== "monthly" && next !== "annual") return;
    cycle = next;
    applyPricing();
  });
});

/* ─── ENTRADA POR SCROLL ────────────────────────────────────────────────────── */

/* Se marcan los bloques a revelar desde JS y no a mano en el HTML: la lista de que entra
   escalonado es una decision de presentacion, y tenerla aqui evita salpicar el marcado
   con atributos que no significan nada para quien lo lee. */
function setUpReveal(): void {
  if (!("IntersectionObserver" in window)) return;

  const targets = [
    ...document.querySelectorAll(".hero-copy, .hero-figure"),
    ...document.querySelectorAll(".block-head, .feature, .split-copy, .split-figure"),
    ...document.querySelectorAll(".stat, .ledger, .ledger-trust, .pricing-switch, .price-card, .closing-inner"),
  ];

  if (targets.length === 0) return;

  document.documentElement.classList.add("js-reveal");
  targets.forEach((node) => node.setAttribute("data-reveal", ""));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  targets.forEach((node) => observer.observe(node));

  /* Escalonado por hermanos dentro de cada rejilla: la segunda tarjeta entra 60ms
     despues que la primera, no 60ms despues de que se cruce el umbral. Sin esto las tres
     tarjetas de una fila aparecen a la vez y el efecto no se lee. */
  document.querySelectorAll(".feature-grid, .stat-grid").forEach((grid) => {
    [...grid.children].forEach((child, index) => {
      if (child instanceof HTMLElement) child.style.setProperty("--reveal-delay", `${index * 60}ms`);
    });
  });
}

/* ─── ARRANQUE ──────────────────────────────────────────────────────────────── */

setUpSite({
  en,
  name: "landing",
  onLanguage: (next) => {
    language = next;
    applyPricing();
  },
});
setUpReveal();
