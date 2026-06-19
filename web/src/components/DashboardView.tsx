import { useMemo, useState } from "react";
import { Activity, CircleDollarSign, Gauge, Percent, Target, TrendingUp, WalletCards } from "lucide-react";
import { CapitalCurve } from "./CapitalCurve";
import { MetricCard } from "./MetricCard";
import { MovementsTable } from "./MovementsTable";
import {
  calculateDashboardModel,
  formatMoney,
  formatPercent,
  signedTone,
} from "../lib/metrics";
import type { Currency, Firm, JournalEntry, Movement, TradingAccount } from "../types";

type DashboardViewProps = {
  accounts: TradingAccount[];
  currency: Currency;
  firms: Firm[];
  journalEntries: JournalEntry[];
  movements: Movement[];
};

type PeriodFilter = "all" | "30d" | "90d" | "month" | "custom";
type SummaryRange = "3m" | "6m" | "12m" | "all";

type DashboardFilters = {
  accountId: string;
  firmId: string;
  from: string;
  period: PeriodFilter;
  to: string;
};

const initialFilters: DashboardFilters = {
  accountId: "all",
  firmId: "all",
  from: "",
  period: "all",
  to: "",
};

export function DashboardView({ accounts, currency, firms, journalEntries, movements }: DashboardViewProps) {
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [summaryRange, setSummaryRange] = useState<SummaryRange>("6m");
  const periodRange = useMemo(() => getPeriodRange(filters), [filters]);
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (filters.firmId !== "all" && account.firmId !== filters.firmId) return false;
      if (filters.accountId !== "all" && account.id !== filters.accountId) return false;
      return true;
    });
  }, [accounts, filters.accountId, filters.firmId]);
  const allowedAccountIds = useMemo(() => new Set(filteredAccounts.map((account) => account.id)), [filteredAccounts]);
  const scopedMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (filters.firmId !== "all" && movement.firmId !== filters.firmId) return false;
        if (filters.accountId !== "all" && movement.accountId !== filters.accountId) return false;
        if (!matchesPeriod(movement.date, periodRange)) return false;
        if (filters.accountId === "all" && filters.firmId !== "all") return movement.firmId === filters.firmId;
        return true;
      }),
    [filters.accountId, filters.firmId, movements, periodRange],
  );
  const scopedJournal = useMemo(
    () =>
      journalEntries.filter((entry) => {
        if (filters.accountId !== "all" && entry.accountId !== filters.accountId) return false;
        if (filters.firmId !== "all" && entry.firmId !== filters.firmId && !allowedAccountIds.has(entry.accountId)) return false;
        return matchesPeriod(entry.date, periodRange);
      }),
    [allowedAccountIds, filters.accountId, filters.firmId, journalEntries, periodRange],
  );
  const dashboardModel = useMemo(
    () => calculateDashboardModel(filteredAccounts, scopedMovements, scopedJournal, "all"),
    [filteredAccounts, scopedJournal, scopedMovements],
  );
  const breakEven = Math.max(0, dashboardModel.expenses - dashboardModel.income);
  const scopeLabel = buildScopeLabel(filters, firms, accounts);
  const expenseRows = useMemo(() => buildExpenseRows(dashboardModel.scopedMovements), [dashboardModel.scopedMovements]);
  const monthlyRows = useMemo(() => buildMonthlyMovementRows(dashboardModel.scopedMovements, summaryRange), [dashboardModel.scopedMovements, summaryRange]);
  const accountRows = useMemo(
    () => buildAccountRows(filteredAccounts, dashboardModel.scopedMovements, firms),
    [dashboardModel.scopedMovements, filteredAccounts, firms],
  );

  return (
    <div className="view-stack">
      <section className="panel dashboard-filter-panel">
        <div className="dashboard-filters">
          <label>
            <span>Empresa</span>
            <select
              value={filters.firmId}
              onChange={(event) => setFilters((current) => ({ ...current, firmId: event.target.value, accountId: "all" }))}
            >
              <option value="all">Todas</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cuenta</span>
            <select value={filters.accountId} onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}>
              <option value="all">Todas</option>
              {accounts
                .filter((account) => filters.firmId === "all" || account.firmId === filters.firmId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Periodo</span>
            <select
              value={filters.period}
              onChange={(event) => {
                const period = event.target.value as PeriodFilter;
                setFilters((current) => ({
                  ...current,
                  period,
                  ...(period === "custom" ? {} : { from: "", to: "" }),
                }));
              }}
            >
              <option value="all">Todo</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
              <option value="month">Mes actual</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <label>
            <span>Desde</span>
            <input
              type="date"
              value={filters.from}
              onClick={() => setFilters((current) => ({ ...current, period: "custom" }))}
              onFocus={() => setFilters((current) => ({ ...current, period: "custom" }))}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, period: "custom" }))}
            />
          </label>
          <label>
            <span>Hasta</span>
            <input
              type="date"
              value={filters.to}
              onClick={() => setFilters((current) => ({ ...current, period: "custom" }))}
              onFocus={() => setFilters((current) => ({ ...current, period: "custom" }))}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, period: "custom" }))}
            />
          </label>
          <button className="secondary-action" type="button" onClick={() => setFilters(initialFilters)}>
            Reset
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Metricas principales">
        <MetricCard
          hint={scopeLabel}
          icon={<TrendingUp size={16} strokeWidth={2.2} />}
          label="Neto total"
          featured
          tone={signedTone(dashboardModel.net)}
          value={formatMoney(dashboardModel.net, currency)}
        />
        <MetricCard
          hint="Costes registrados"
          icon={<Target size={16} strokeWidth={2.2} />}
          label="Gasto total"
          tone={dashboardModel.expenses > 0 ? "negative" : "neutral"}
          value={formatMoney(dashboardModel.expenses, currency)}
        />
        <MetricCard
          hint="Retiros y refunds"
          icon={<CircleDollarSign size={16} strokeWidth={2.2} />}
          label="Retiros"
          tone="positive"
          value={formatMoney(dashboardModel.income, currency)}
        />
        <MetricCard
          hint={`${dashboardModel.activeAccounts} activas`}
          icon={<Percent size={16} strokeWidth={2.2} />}
          label="ROI"
          tone={signedTone(dashboardModel.roi)}
          value={formatPercent(dashboardModel.roi)}
        />
        <MetricCard
          hint="Para cubrir costes"
          icon={<WalletCards size={16} strokeWidth={2.2} />}
          label="Break-even"
          tone={breakEven > 0 ? "negative" : "positive"}
          value={formatMoney(breakEven, currency)}
        />
        <MetricCard
          hint={`${filteredAccounts.length} cuentas en el filtro`}
          icon={<Activity size={16} strokeWidth={2.2} />}
          label="Activas"
          tone="neutral"
          value={String(dashboardModel.activeAccounts)}
        />
      </section>

      <div className="dashboard-grid">
        <CapitalCurve currency={currency} movements={dashboardModel.scopedMovements} points={dashboardModel.curve} />
        <section className="panel period-summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Resumen del periodo</h2>
              <p>{scopeLabel}</p>
            </div>
          </div>
          <div className="period-summary-list">
            <div>
              <span>Gasto</span>
              <strong className="negative">{formatMoney(dashboardModel.expenses, currency)}</strong>
            </div>
            <div>
              <span>Retiros</span>
              <strong className="positive">{formatMoney(dashboardModel.income, currency)}</strong>
            </div>
            <div>
              <span>Neto</span>
              <strong className={signedTone(dashboardModel.net)}>{formatMoney(dashboardModel.net, currency)}</strong>
            </div>
          </div>
          <MonthlyMovementBars currency={currency} range={summaryRange} rows={monthlyRows} onRangeChange={setSummaryRange} />
        </section>
      </div>

      <section className="dashboard-insights">
        <InsightPanel
          currency={currency}
          emptyText="Sin gastos en el filtro"
          rows={expenseRows.map((row) => ({ label: row.label, value: row.amount }))}
          title="Gastos por categoría"
          tone="negative"
        />
        <InsightPanel
          currency={currency}
          emptyText="Sin movimientos por cuenta"
          rows={accountRows.map((row) => ({ detail: row.firmName, label: row.accountName, value: row.net }))}
          title="Resultado por cuenta"
        />
        <MovementsTable accounts={filteredAccounts} currency={currency} movements={dashboardModel.scopedMovements} />
      </section>
    </div>
  );
}

function getPeriodRange(filters: DashboardFilters) {
  const now = new Date();
  const today = dateToIso(now);

  if (filters.period === "all") return { from: "", to: "" };
  if (filters.period === "custom") return { from: filters.from, to: filters.to };
  if (filters.period === "month") {
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { from, to: today };
  }

  const days = filters.period === "30d" ? 30 : 90;
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);
  return { from: dateToIso(fromDate), to: today };
}

function matchesPeriod(date: string, range: { from: string; to: string }) {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildScopeLabel(filters: DashboardFilters, firms: Firm[], accounts: TradingAccount[]) {
  const firmName = filters.firmId === "all" ? "Todas las empresas" : firms.find((firm) => firm.id === filters.firmId)?.name;
  const accountName = filters.accountId === "all" ? "" : accounts.find((account) => account.id === filters.accountId)?.name;
  return accountName || firmName || "Todas las cuentas";
}

function buildExpenseRows(movements: Movement[]) {
  const labels: Record<Movement["category"], string> = {
    activation: "Activacion",
    challenge: "Compra challenge",
    commission: "Comision",
    other: "Otro",
    payout: "Payout",
    platform: "Plataforma",
    refund: "Refund",
    reset: "Reset",
    subscription: "Mensualidad",
  };
  const grouped = new Map<string, number>();
  movements
    .filter((movement) => movement.kind === "expense")
    .forEach((movement) => grouped.set(movement.category, (grouped.get(movement.category) || 0) + movement.amount));
  return [...grouped.entries()]
    .map(([category, amount]) => ({ amount, label: labels[category as Movement["category"]] || category }))
    .sort((left, right) => right.amount - left.amount);
}

function buildAccountRows(accounts: TradingAccount[], movements: Movement[], firms: Firm[]) {
  const firmNameById = new Map(firms.map((firm) => [firm.id, firm.name]));
  return accounts
    .map((account) => {
      const accountMovements = movements.filter((movement) => movement.accountId === account.id);
      const income = accountMovements.filter((movement) => movement.kind === "income").reduce((total, movement) => total + movement.amount, 0);
      const expenses = accountMovements.filter((movement) => movement.kind === "expense").reduce((total, movement) => total + movement.amount, 0);
      return {
        accountName: account.name,
        firmName: firmNameById.get(account.firmId) || "Sin empresa",
        net: income - expenses,
      };
    })
    .filter((row) => row.net !== 0)
    .sort((left, right) => right.net - left.net);
}

function buildMonthlyMovementRows(movements: Movement[], range: SummaryRange) {
  const grouped = new Map<string, { expenses: number; income: number; month: string }>();

  movements.forEach((movement) => {
    const month = movement.date.slice(0, 7);
    const current = grouped.get(month) || { expenses: 0, income: 0, month };
    if (movement.kind === "income") current.income += movement.amount;
    else current.expenses += movement.amount;
    grouped.set(month, current);
  });

  const sorted = [...grouped.values()].sort((left, right) => left.month.localeCompare(right.month));
  const limitByRange: Record<SummaryRange, number> = {
    "3m": 3,
    "6m": 6,
    "12m": 12,
    all: sorted.length,
  };

  return sorted.slice(-limitByRange[range]);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, (monthNumber || 1) - 1, 1);
  return new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date).replace(".", "");
}

function formatLongMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, (monthNumber || 1) - 1, 1);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}

function MonthlyMovementBars({
  currency,
  onRangeChange,
  range,
  rows,
}: {
  currency: Currency;
  onRangeChange: (range: SummaryRange) => void;
  range: SummaryRange;
  rows: Array<{ expenses: number; income: number; month: string }>;
}) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.expenses, row.income]));
  const activeRow = activeMonth ? rows.find((row) => row.month === activeMonth) : undefined;

  return (
    <div className="period-month-chart" aria-label="Gastos y retiros por mes">
      <div className="period-month-chart-head">
        <div>
          <span>Mensual</span>
          <small>Gastos vs retiros</small>
        </div>
        <div className="period-range-tabs" aria-label="Rango del resumen mensual">
          {summaryRangeOptions.map((option) => (
            <button
              className={range === option.value ? "active" : ""}
              key={option.value}
              onClick={() => {
                setActiveMonth(null);
                onRangeChange(option.value);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="period-month-bars" onPointerLeave={() => setActiveMonth(null)}>
          {rows.map((row) => {
            const expenseHeight = Math.max(6, (row.expenses / maxValue) * 100);
            const incomeHeight = Math.max(6, (row.income / maxValue) * 100);
            return (
              <div
                className={`period-month-group ${activeMonth === row.month ? "active" : ""}`}
                key={row.month}
                onFocus={() => setActiveMonth(row.month)}
                onPointerEnter={() => setActiveMonth(row.month)}
                onPointerMove={() => setActiveMonth(row.month)}
                tabIndex={0}
              >
                <div className="period-month-columns">
                  <i
                    className="income"
                    style={{ height: `${incomeHeight}%` }}
                    title={`Retiros ${formatMoney(row.income, currency)}`}
                  />
                  <i
                    className="expense"
                    style={{ height: `${expenseHeight}%` }}
                    title={`Gastos ${formatMoney(row.expenses, currency)}`}
                  />
                </div>
                <span>{formatMonthLabel(row.month)}</span>
              </div>
            );
          })}
          {activeRow && (
            <div className="period-month-tooltip">
              <span>{formatLongMonthLabel(activeRow.month)}</span>
              <strong className={signedTone(activeRow.income - activeRow.expenses)}>{formatMoney(activeRow.income - activeRow.expenses, currency)}</strong>
              <small>
                Retiros <b className="positive">{formatMoney(activeRow.income, currency)}</b>
              </small>
              <small>
                Gastos <b className="negative">{formatMoney(activeRow.expenses, currency)}</b>
              </small>
            </div>
          )}
        </div>
      ) : (
        <p className="inline-muted">Sin movimientos mensuales en el filtro.</p>
      )}
    </div>
  );
}

const summaryRangeOptions: Array<{ label: string; value: SummaryRange }> = [
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "12M", value: "12m" },
  { label: "Todo", value: "all" },
];

function InsightPanel({
  currency,
  emptyText,
  rows,
  tone = "auto",
  title,
}: {
  currency: Currency;
  emptyText: string;
  rows: Array<{ detail?: string; label: string; value: number }>;
  tone?: "auto" | "negative";
  title: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <section className={`panel insight-panel ${tone === "negative" ? "is-negative" : ""}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="insight-list">
        {rows.length ? (
          rows.slice(0, 6).map((row) => (
            <div className="insight-row" key={`${row.label}-${row.value}`}>
              <div>
                <span>
                  <strong>{row.label}</strong>
                  <b className={tone === "negative" ? "negative" : signedTone(row.value)}>{formatMoney(row.value, currency)}</b>
                </span>
                {row.detail && <small>{row.detail}</small>}
                <i style={{ width: `${Math.max(5, (Math.abs(row.value) / maxValue) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="inline-muted">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
