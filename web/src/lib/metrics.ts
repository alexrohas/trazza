import type {
  CapitalPoint,
  Currency,
  DashboardModel,
  JournalEntry,
  Movement,
  TradingAccount,
} from "../types";

const activeAccountStatuses = new Set(["active", "evaluation", "passed", "funded"]);

const accountIsActive = (account: TradingAccount) => activeAccountStatuses.has(account.status);

const byDate = <T extends { date: string }>(left: T, right: T) => left.date.localeCompare(right.date);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/* Lo que la cuenta lleva ganado o perdido operando. Sale del journal y no de los
   movimientos a proposito: los movimientos son costes y retiros (la cuota del
   challenge, un payout), no resultado de trading, y meterlos aqui desplazaria el
   balance de la cuenta por haber pagado la inscripcion. */
export function getAccountPnl(entries: JournalEntry[], accountId: string) {
  return sum(entries.filter((entry) => entry.accountId === accountId).map((entry) => entry.pnl));
}

export function getAccountTradingDays(entries: JournalEntry[], accountId: string) {
  return new Set(entries.filter((entry) => entry.accountId === accountId).map((entry) => entry.date)).size;
}

export type AccountProgress = {
  /** Balance de partida: el tamano nominal de la cuenta. */
  start: number;
  /** Balance ahora mismo, segun el journal. */
  current: number;
  pnl: number;
  /** Suelo: donde salta el drawdown maximo. undefined si la cuenta no tiene limite. */
  floor?: number;
  /** Techo: donde se supera el objetivo. undefined en fondeadas y capital propio. */
  ceiling?: number;
  /** Posicion en la barra, de 0 a 1, con 0,5 siempre en el balance de partida. */
  position: number;
  reachedTarget: boolean;
  breachedFloor: boolean;
};

/* Suelo de un drawdown EOD trailing: sube con el balance de cierre mas alto alcanzado
   (arrancando en el balance de partida, que ya es un cierre valido antes de operar) y
   se bloquea en cuanto ese pico llega a partida + drawdown, quedandose fijo en el
   balance de partida a partir de ahi. Es la convencion habitual en Apex/Topstep/etc. */
function getTrailingFloor(entries: JournalEntry[], accountId: string, start: number, maxDrawdown: number) {
  const pnlByDate = new Map<string, number>();
  entries
    .filter((entry) => entry.accountId === accountId)
    .forEach((entry) => {
      pnlByDate.set(entry.date, (pnlByDate.get(entry.date) || 0) + entry.pnl);
    });

  let balance = start;
  let peak = start;
  [...pnlByDate.keys()].sort().forEach((date) => {
    balance += pnlByDate.get(date) || 0;
    if (balance > peak) peak = balance;
  });

  return Math.min(peak - maxDrawdown, start);
}

/* Geometria de la barra de progreso. El 0,5 es siempre el balance de partida, no el
   punto medio entre suelo y techo: asi la mitad izquierda es lo que puedes perder y la
   derecha lo que te falta, aunque las dos distancias sean muy distintas. Con un
   objetivo de 1.250 y un drawdown de 1.000 las escalas no coinciden, y eso es correcto:
   lo que importa es cuanto te queda de cada lado, no que sean comparables entre si. */
export function getAccountProgress(account: TradingAccount, entries: JournalEntry[]): AccountProgress {
  const start = account.size;
  const pnl = getAccountPnl(entries, account.id);
  const current = start + pnl;
  const floor =
    account.maxDrawdown > 0
      ? account.drawdownType === "trailing"
        ? getTrailingFloor(entries, account.id, start, account.maxDrawdown)
        : start - account.maxDrawdown
      : undefined;
  const ceiling = account.phaseTarget > 0 ? start + account.phaseTarget : undefined;
  const reachedTarget = ceiling !== undefined && current >= ceiling;
  const breachedFloor = floor !== undefined && current <= floor;

  /* Un trailing bloqueado deja el suelo igual al balance de partida: ahi el margen de
     perdida es 0, y dividir por el rompe el calculo de mas abajo. Resolver primero si
     ya se rompio el suelo o se supero el techo evita esa division por cero. */
  let position = 0.5;
  if (breachedFloor) {
    position = 0;
  } else if (reachedTarget) {
    position = 1;
  } else if (pnl > 0) {
    const margen = ceiling ? ceiling - start : account.maxDrawdown || start;
    position = 0.5 + Math.min(pnl / margen, 1) * 0.5;
  } else if (pnl < 0) {
    const margen = floor !== undefined ? start - floor : account.phaseTarget || start;
    position = 0.5 - Math.min(Math.abs(pnl) / margen, 1) * 0.5;
  }

  return {
    start,
    current,
    pnl,
    floor,
    ceiling,
    position,
    reachedTarget,
    breachedFloor,
  };
}

export function formatMoney(value: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    /* El espanol omite el separador de miles en numeros de cuatro cifras (5000, no
       5.000). Es correcto al escribir, pero en una columna de importes deja "5000,00"
       junto a "25.000,00" y cuesta compararlos de un vistazo.
       Se usa `true` y no "always" porque la version de TypeScript del proyecto aun tipa
       esta opcion como booleana; el resultado es identico. */
    useGrouping: true,
  }).format(value);
}

/* Igual que formatMoney pero sin simbolo de divisa: para un par "actual / objetivo"
   repetir la divisa en los dos numeros no cabe en el ancho de una caja de tarjeta y no
   aporta nada que el segundo numero no diga ya. */
export function formatAmount(value: number) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    useGrouping: true,
  }).format(value);
}

/* Tercer formato de importe, un escalon por debajo de formatAmount, para cajas donde
   tampoco cabe ese: las celdas del calendario del Journal dan poco texto util y
   "-41,00 US$" pide bastante mas, asi que las celdas con P&L se truncaban con elipsis
   ("-425,00 US$" se leia "-425,00..."). Un importe cortado es peor que ninguno, porque
   parece un dato y no lo es.
   Lleva divisa a proposito (a diferencia de un compacto sin ella): sin el simbolo no se
   leia como dinero, y "US$" completo no cabe ni con el calendario a ancho completo
   (measured: 60px de "-129 US$" contra ~55 utiles). currencyDisplay: "narrowSymbol" da
   el simbolo estrecho de la divisa ("$", "€") en vez del largo ("US$"), que si entra
   (42-54px). signDisplay: "exceptZero" añade el "+" explicito en positivos, como hace
   formatSignedMoney en el legado — sin el, un dia ganador y un dia a cero se leian
   igual de neutros. El dato exacto y sin recortar sigue completo en el aria-label de la
   celda y en el panel de detalle. */
export function formatMoneyCompactSigned(value: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
    style: "currency",
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}

/* Sin decimales, para cajas muy estrechas donde "55,56 %" no cabe — mismo criterio que
   formatMoneyCompact con el dinero: si un numero no cabe, se cambia el formato y no el
   tamaño de letra (encoger la letra solo mueve el problema a la siguiente cifra larga).
   Usado en las barras de "Dias de semana" cuando comparten fila con Balance y Winrate
   por sesion. */
export function formatPercentCompact(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

/* El texto de respaldo se recibe traducido en vez de estar escrito aqui: esta funcion
   la llaman pantallas de los dos idiomas, y un literal en castellano se colaba tal cual
   en la interfaz en ingles. */
export function formatAccountSize(account: TradingAccount, currency: Currency = "EUR", fallback: string) {
  if (account.size > 0) return formatMoney(account.size, currency);
  return account.sizeLabel || fallback;
}

export function signedTone(value: number) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export function getDisciplineScale(entries: Array<Pick<JournalEntry, "discipline">>) {
  return entries.some((entry) => entry.discipline > 5) ? 10 : 5;
}

export function formatDisciplineScore(value: number, scale = value > 5 ? 10 : 5) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted}/${scale}`;
}

/* Mismo motivo que en formatAccountSize: el respaldo llega traducido desde quien llama.
   Este era el caso mas visible — 16 de 25 movimientos reales no tienen cuenta asociada,
   asi que dos tercios de la columna mostraban castellano con la app en ingles. */
export function getAccountName(accounts: TradingAccount[], accountId: string | undefined, fallback: string) {
  return accounts.find((account) => account.id === accountId)?.name ?? fallback;
}

/* Cuentas que se ofrecen en un desplegable: las visibles, mas la que ya estuviera
   elegida aunque se haya ocultado despues (isAccountSelectable en el legado). Sin esto,
   ocultar una cuenta borraria de su propio desplegable el valor que una entrada o un
   movimiento ya guardado tiene apuntado, y volver a guardarlos la perderia. selectedId
   acepta "", "all" o undefined sin efecto: no coinciden con ningun id real.
   Solo para desplegables de "que cuenta es esta" (formularios, filtros); las cuentas
   ocultas siguen sumando en totales y desgloses, que no pasan por aqui. */
export function getSelectableAccounts(accounts: TradingAccount[], selectedId: string | undefined) {
  return accounts.filter((account) => account.visible !== false || account.id === selectedId);
}

export function calculatePayoutNetAmount(grossAmount: number, profitSplit: number) {
  const safeGross = Number.isFinite(grossAmount) ? Math.max(0, grossAmount) : 0;
  const safeSplit = Number.isFinite(profitSplit) ? Math.min(100, Math.max(0, profitSplit)) : 100;
  return Math.round(safeGross * (safeSplit / 100) * 100) / 100;
}

export function getPayoutGrossAmount(movement: Pick<Movement, "amount" | "category" | "payoutGrossAmount">) {
  if (movement.category !== "payout") return 0;
  return movement.payoutGrossAmount && movement.payoutGrossAmount > 0 ? movement.payoutGrossAmount : movement.amount;
}

export function filterMovementsByAccount(movements: Movement[], accountId: string) {
  if (accountId === "all") return movements;
  return movements.filter((movement) => movement.accountId === accountId);
}

export function filterJournalByAccount(entries: JournalEntry[], accountId: string) {
  if (accountId === "all") return entries;
  return entries.filter((entry) => entry.accountId === accountId);
}

export function calculateDashboardModel(
  accounts: TradingAccount[],
  movements: Movement[],
  journalEntries: JournalEntry[],
  selectedAccountId: string,
): DashboardModel {
  const scopedAccounts =
    selectedAccountId === "all" ? accounts : accounts.filter((account) => account.id === selectedAccountId);
  const accountIds = new Set(scopedAccounts.map((account) => account.id));
  const scopedMovements = filterMovementsByAccount(movements, selectedAccountId);
  const scopedJournalEntries = filterJournalByAccount(journalEntries, selectedAccountId);

  const expenses = sum(scopedMovements.filter((movement) => movement.kind === "expense").map((movement) => movement.amount));
  const income = sum(scopedMovements.filter((movement) => movement.kind === "income").map((movement) => movement.amount));
  const journalPnl = sum(scopedJournalEntries.map((entry) => entry.pnl));
  const net = income - expenses;
  const wins = scopedJournalEntries.filter((entry) => entry.pnl > 0);
  const losses = scopedJournalEntries.filter((entry) => entry.pnl < 0);
  const grossProfit = sum(wins.map((entry) => entry.pnl));
  const grossLoss = Math.abs(sum(losses.map((entry) => entry.pnl)));

  return {
    expenses,
    income,
    journalPnl,
    net,
    roi: expenses > 0 ? net / expenses : 0,
    activeAccounts: scopedAccounts.filter(accountIsActive).length,
    winRate: scopedJournalEntries.length > 0 ? wins.length / scopedJournalEntries.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0,
    averageDiscipline:
      scopedJournalEntries.length > 0
        ? sum(scopedJournalEntries.map((entry) => entry.discipline)) / scopedJournalEntries.length
        : 0,
    curve: buildCapitalCurve(scopedMovements, [], accountIds),
    scopedMovements,
    scopedJournalEntries,
  };
}

function buildCapitalCurve(
  movements: Movement[],
  journalEntries: JournalEntry[],
  accountIds: Set<string>,
): CapitalPoint[] {
  const datedValues = [
    ...movements.map((movement) => ({
      date: movement.date,
      value: movement.kind === "income" ? movement.amount : -movement.amount,
    })),
    ...journalEntries
      .filter((entry) => accountIds.size === 0 || accountIds.has(entry.accountId))
      .map((entry) => ({ date: entry.date, value: entry.pnl })),
  ].sort(byDate);

  let runningTotal = 0;

  return datedValues.map((item) => {
    runningTotal += item.value;
    return {
      date: item.date,
      value: runningTotal,
    };
  });
}
