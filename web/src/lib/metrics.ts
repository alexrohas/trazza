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

export function formatMoney(value: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAccountSize(account: TradingAccount, currency: Currency = "EUR") {
  if (account.size > 0) return formatMoney(account.size, currency);
  return account.sizeLabel || "Sin tamano";
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

export function getAccountName(accounts: TradingAccount[], accountId?: string) {
  return accounts.find((account) => account.id === accountId)?.name ?? "Sin cuenta";
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
