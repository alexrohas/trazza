import { useMemo, useState } from "react";
import { Activity, CircleDollarSign, Gauge, Percent, Target, TrendingUp, WalletCards } from "lucide-react";
import { CapitalCurve } from "./CapitalCurve";
import { DatePicker } from "./DatePicker";
import { FilterToggleButton } from "./FilterToggle";
import { InfoHint } from "./InfoHint";
import { MetricCard } from "./MetricCard";
import { MovementsTable } from "./MovementsTable";
import { Select } from "./Select";
import {
  calculateDashboardModel,
  formatMoney,
  formatPercent,
  signedTone,
} from "../lib/metrics";
import { useI18n, useT } from "../lib/i18n/context";
import type { Language } from "../lib/i18n/context";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [summaryRange, setSummaryRange] = useState<SummaryRange>("6m");
  const t = useT();
  const { language } = useI18n();
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
  const scopeLabel = buildScopeLabel(filters, firms, accounts, t);
  const expenseRows = useMemo(() => buildExpenseRows(dashboardModel.scopedMovements, t), [dashboardModel.scopedMovements, t]);
  const monthlyRows = useMemo(() => buildMonthlyMovementRows(dashboardModel.scopedMovements, summaryRange), [dashboardModel.scopedMovements, summaryRange]);
  /* Los totales salen de las mismas filas que dibuja el grafico, no del modelo global:
     asi el rango elegido manda sobre toda la tarjeta y lo que se lee arriba siempre es
     exactamente la suma de las barras de abajo. */
  const rangeTotals = useMemo(() => {
    const expenses = monthlyRows.reduce((total, row) => total + row.expenses, 0);
    const income = monthlyRows.reduce((total, row) => total + row.income, 0);
    return { expenses, income, net: income - expenses };
  }, [monthlyRows]);
  const accountRows = useMemo(
    () => buildAccountRows(filteredAccounts, dashboardModel.scopedMovements, firms, t),
    [dashboardModel.scopedMovements, filteredAccounts, firms, t],
  );
  const firmFilterOptions = useMemo(
    () => [{ label: t("common.all"), value: "all" }, ...firms.map((firm) => ({ label: firm.name, value: firm.id }))],
    [firms, t],
  );
  const accountFilterOptions = useMemo(
    () => [
      { label: t("common.all"), value: "all" },
      ...accounts
        .filter((account) => filters.firmId === "all" || account.firmId === filters.firmId)
        .map((account) => ({ label: account.name, value: account.id })),
    ],
    [accounts, filters.firmId, t],
  );
  const summaryRangeOptions = useMemo(() => getSummaryRangeOptions(t), [t]);
  const periodOptions = useMemo(
    () => [
      { label: t("dashboard.filter.periodAll"), value: "all" },
      { label: t("dashboard.filter.period30d"), value: "30d" },
      { label: t("dashboard.filter.period90d"), value: "90d" },
      { label: t("dashboard.filter.periodMonth"), value: "month" },
      { label: t("dashboard.filter.periodCustom"), value: "custom" },
    ],
    [t],
  );
  const hasActiveFilters =
    filters.firmId !== "all" ||
    filters.accountId !== "all" ||
    filters.period !== "all" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="view-stack">
      <div className="dashboard-filter-bar">
        <FilterToggleButton active={hasActiveFilters} isOpen={filtersOpen} onClick={() => setFiltersOpen((current) => !current)} />
      </div>
      {filtersOpen && (
      <section className="panel dashboard-filter-panel">
        <div className="dashboard-filters">
          <label>
            <span>{t("dashboard.filter.firm")}</span>
            <Select
              onChange={(next) => setFilters((current) => ({ ...current, firmId: next, accountId: "all" }))}
              options={firmFilterOptions}
              value={filters.firmId}
            />
          </label>
          <label>
            <span>{t("dashboard.filter.account")}</span>
            <Select
              onChange={(next) => setFilters((current) => ({ ...current, accountId: next }))}
              options={accountFilterOptions}
              value={filters.accountId}
            />
          </label>
          <label>
            <span>{t("dashboard.filter.period")}</span>
            <Select
              onChange={(next) => {
                const period = next as PeriodFilter;
                setFilters((current) => ({
                  ...current,
                  period,
                  ...(period === "custom" ? {} : { from: "", to: "" }),
                }));
              }}
              options={periodOptions}
              value={filters.period}
            />
          </label>
          <label>
            <span>{t("dashboard.filter.from")}</span>
            <DatePicker
              onChange={(next) => setFilters((current) => ({ ...current, from: next, period: "custom" }))}
              value={filters.from}
            />
          </label>
          <label>
            <span>{t("dashboard.filter.to")}</span>
            <DatePicker
              onChange={(next) => setFilters((current) => ({ ...current, to: next, period: "custom" }))}
              value={filters.to}
            />
          </label>
          <button className="secondary-action" type="button" onClick={() => setFilters(initialFilters)}>
            {t("dashboard.filter.reset")}
          </button>
        </div>
      </section>
      )}

      <section className="metric-grid" aria-label={t("dashboard.metrics.label")}>
        <MetricCard
          hint={scopeLabel}
          icon={<TrendingUp size={16} strokeWidth={2.2} />}
          label={t("dashboard.metric.netTotal")}
          featured
          tone={signedTone(dashboardModel.net)}
          value={formatMoney(dashboardModel.net, currency)}
        />
        <MetricCard
          hint={t("dashboard.metric.expensesRecorded")}
          icon={<Target size={16} strokeWidth={2.2} />}
          label={t("dashboard.metric.totalExpense")}
          tone={dashboardModel.expenses > 0 ? "negative" : "neutral"}
          value={formatMoney(dashboardModel.expenses, currency)}
        />
        <MetricCard
          hint={t("dashboard.metric.withdrawalsRefunds")}
          icon={<CircleDollarSign size={16} strokeWidth={2.2} />}
          label={t("dashboard.metric.withdrawals")}
          tone="positive"
          value={formatMoney(dashboardModel.income, currency)}
        />
        <MetricCard
          hint={`${dashboardModel.activeAccounts} ${t("dashboard.metric.activeSuffix")}`}
          icon={<Percent size={16} strokeWidth={2.2} />}
          label={t("dashboard.metric.roi")}
          tone={signedTone(dashboardModel.roi)}
          value={formatPercent(dashboardModel.roi)}
        />
        <MetricCard
          hint={t("dashboard.metric.toCoverCosts")}
          icon={<WalletCards size={16} strokeWidth={2.2} />}
          label={t("dashboard.metric.breakEven")}
          tone={breakEven > 0 ? "negative" : "positive"}
          value={formatMoney(breakEven, currency)}
        />
        <MetricCard
          hint={`${filteredAccounts.length} ${t("dashboard.metric.accountsInFilter")}`}
          icon={<Activity size={16} strokeWidth={2.2} />}
          label={t("dashboard.metric.active")}
          tone="neutral"
          value={String(dashboardModel.activeAccounts)}
        />
      </section>

      <div className="dashboard-grid">
        <CapitalCurve currency={currency} movements={dashboardModel.scopedMovements} points={dashboardModel.curve} />
        <section className="panel period-summary-panel">
          <div className="panel-heading">
            <div className="panel-title-row">
              <h2>{t("dashboard.period.title")}</h2>
              <InfoHint text={scopeLabel} />
            </div>
            <div className="period-range-tabs" aria-label={t("dashboard.monthly.rangeLabel")}>
              {summaryRangeOptions.map((option) => (
                <button
                  className={summaryRange === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => setSummaryRange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="period-summary-list">
            <div>
              <span>{t("dashboard.period.expense")}</span>
              <strong className="negative">{formatMoney(rangeTotals.expenses, currency)}</strong>
            </div>
            <div>
              <span>{t("dashboard.period.withdrawals")}</span>
              <strong className="positive">{formatMoney(rangeTotals.income, currency)}</strong>
            </div>
            <div>
              <span>{t("dashboard.period.net")}</span>
              <strong className={signedTone(rangeTotals.net)}>{formatMoney(rangeTotals.net, currency)}</strong>
            </div>
          </div>
          <MonthlyMovementBars currency={currency} language={language} rows={monthlyRows} t={t} />
        </section>
      </div>

      <section className="dashboard-insights">
        <InsightPanel
          currency={currency}
          emptyText={t("dashboard.insights.noExpenses")}
          rows={expenseRows.map((row) => ({ label: row.label, value: row.amount }))}
          title={t("dashboard.insights.expensesByCategory")}
          tone="negative"
        />
        <InsightPanel
          currency={currency}
          emptyText={t("dashboard.insights.noMovementsByAccount")}
          rows={accountRows.map((row) => ({ detail: row.firmName, label: row.accountName, value: row.net }))}
          title={t("dashboard.insights.resultByAccount")}
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

function buildScopeLabel(filters: DashboardFilters, firms: Firm[], accounts: TradingAccount[], t: ReturnType<typeof useT>) {
  const firmName = filters.firmId === "all" ? t("dashboard.scope.allFirms") : firms.find((firm) => firm.id === filters.firmId)?.name;
  const accountName = filters.accountId === "all" ? "" : accounts.find((account) => account.id === filters.accountId)?.name;
  return accountName || firmName || t("dashboard.scope.allAccounts");
}

function buildExpenseRows(movements: Movement[], t: ReturnType<typeof useT>) {
  const labels: Record<Movement["category"], string> = {
    activation: t("dashboard.expenseCategory.activation"),
    challenge: t("dashboard.expenseCategory.challenge"),
    commission: t("dashboard.expenseCategory.commission"),
    other: t("dashboard.expenseCategory.other"),
    payout: t("dashboard.expenseCategory.payout"),
    platform: t("dashboard.expenseCategory.platform"),
    refund: t("dashboard.expenseCategory.refund"),
    reset: t("dashboard.expenseCategory.reset"),
    subscription: t("dashboard.expenseCategory.subscription"),
  };
  const grouped = new Map<string, number>();
  movements
    .filter((movement) => movement.kind === "expense")
    .forEach((movement) => grouped.set(movement.category, (grouped.get(movement.category) || 0) + movement.amount));
  return [...grouped.entries()]
    .map(([category, amount]) => ({ amount, label: labels[category as Movement["category"]] || category }))
    .sort((left, right) => right.amount - left.amount);
}

function buildAccountRows(accounts: TradingAccount[], movements: Movement[], firms: Firm[], t: ReturnType<typeof useT>) {
  const firmNameById = new Map(firms.map((firm) => [firm.id, firm.name]));
  return accounts
    .map((account) => {
      const accountMovements = movements.filter((movement) => movement.accountId === account.id);
      const income = accountMovements.filter((movement) => movement.kind === "income").reduce((total, movement) => total + movement.amount, 0);
      const expenses = accountMovements.filter((movement) => movement.kind === "expense").reduce((total, movement) => total + movement.amount, 0);
      return {
        accountName: account.name,
        firmName: firmNameById.get(account.firmId) || t("account.card.noFirm"),
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

function formatMonthLabel(month: string, language: Language) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, (monthNumber || 1) - 1, 1);
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { month: "short" }).format(date).replace(".", "");
}

function formatLongMonthLabel(month: string, language: Language) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, (monthNumber || 1) - 1, 1);
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { month: "long", year: "numeric" }).format(date);
}

function getSummaryRangeOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: SummaryRange }> {
  return [
    { label: t("dashboard.monthly.range3m"), value: "3m" },
    { label: t("dashboard.monthly.range6m"), value: "6m" },
    { label: t("dashboard.monthly.range12m"), value: "12m" },
    { label: t("dashboard.monthly.rangeAll"), value: "all" },
  ];
}

function MonthlyMovementBars({
  currency,
  language,
  rows,
  t,
}: {
  currency: Currency;
  language: Language;
  rows: Array<{ expenses: number; income: number; month: string }>;
  t: ReturnType<typeof useT>;
}) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.expenses, row.income]));
  const activeRow = activeMonth ? rows.find((row) => row.month === activeMonth) : undefined;

  return (
    <div className="period-month-chart" aria-label={t("dashboard.monthly.label")}>
      <div className="period-month-chart-head">
        <div className="panel-title-row">
          <span>{t("dashboard.monthly.title")}</span>
          <InfoHint text={t("dashboard.monthly.subtitle")} />
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
                    title={`${t("dashboard.period.withdrawals")} ${formatMoney(row.income, currency)}`}
                  />
                  <i
                    className="expense"
                    style={{ height: `${expenseHeight}%` }}
                    title={`${t("dashboard.period.expense")} ${formatMoney(row.expenses, currency)}`}
                  />
                </div>
                <span>{formatMonthLabel(row.month, language)}</span>
              </div>
            );
          })}
          {activeRow && (
            <div className="period-month-tooltip">
              <span>{formatLongMonthLabel(activeRow.month, language)}</span>
              <strong className={signedTone(activeRow.income - activeRow.expenses)}>{formatMoney(activeRow.income - activeRow.expenses, currency)}</strong>
              <small>
                {t("dashboard.period.withdrawals")} <b className="positive">{formatMoney(activeRow.income, currency)}</b>
              </small>
              <small>
                {t("dashboard.period.expense")} <b className="negative">{formatMoney(activeRow.expenses, currency)}</b>
              </small>
            </div>
          )}
        </div>
      ) : (
        <p className="inline-muted">{t("dashboard.monthly.empty")}</p>
      )}
    </div>
  );
}

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
