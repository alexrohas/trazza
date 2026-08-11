import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CalendarDays, Check, CircleAlert, Flag, Pencil, Plus, Shield, Trash2, WalletCards } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { FilterToggleButton } from "./FilterToggle";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { formatAccountSize, formatMoney } from "../lib/metrics";
import { useT } from "../lib/i18n/context";
import { matchesSearch } from "../lib/search";
import type {
  AccountInput,
  AccountStatus,
  Currency,
  DataMode,
  Firm,
  JournalEntry,
  Movement,
  TradingAccount,
} from "../types";

type AccountsViewProps = {
  accounts: TradingAccount[];
  currency: Currency;
  dataMode: DataMode;
  firms: Firm[];
  journalEntries: JournalEntry[];
  movements: Movement[];
  mutationError?: string | null;
  mutating?: boolean;
  newAccountToken?: number;
  searchQuery: string;
  onDeleteAccount: (accountId: string) => Promise<boolean>;
  onNewAccountRequestHandled?: () => void;
  onSaveAccount: (input: AccountInput, accountId?: string) => Promise<boolean>;
};

function getAccountStatusOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: AccountStatus }> {
  return [
    { label: t("account.status.active"), value: "active" },
    { label: t("account.status.evaluation"), value: "evaluation" },
    { label: t("account.status.passed"), value: "passed" },
    { label: t("account.status.funded"), value: "funded" },
    { label: t("account.status.failed"), value: "failed" },
    { label: t("account.status.closed"), value: "closed" },
  ];
}

const activeAccountStatuses = new Set<AccountStatus>(["active", "evaluation", "passed", "funded"]);
const blockedAccountStatuses = new Set<AccountStatus>(["failed", "closed"]);

const emptyAccountInput: AccountInput = {
  firmId: "",
  name: "",
  status: "active",
  size: "",
  purchasedAt: "",
  phaseTarget: undefined,
  maxDrawdown: undefined,
  dailyDrawdown: undefined,
};

export function AccountsView({
  accounts,
  currency,
  dataMode,
  firms,
  journalEntries,
  movements,
  mutationError,
  mutating = false,
  newAccountToken = 0,
  searchQuery,
  onDeleteAccount,
  onNewAccountRequestHandled,
  onSaveAccount,
}: AccountsViewProps) {
  const [draft, setDraft] = useState<AccountInput>(emptyAccountInput);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [firmFilter, setFirmFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [firmRequiredError, setFirmRequiredError] = useState(false);
  const [screen, setScreen] = useState<"list" | "form">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const t = useT();
  const accountStatusOptions = useMemo(() => getAccountStatusOptions(t), [t]);
  const accountStatusFilters = useMemo(() => [{ label: t("common.all"), value: "all" as const }, ...accountStatusOptions], [accountStatusOptions, t]);
  const accountStatusLabelByValue = useMemo(() => new Map(accountStatusOptions.map((option) => [option.value, option.label])), [accountStatusOptions]);
  const firmOptions = useMemo(() => firms.map((firm) => ({ label: firm.name, value: firm.id })), [firms]);
  const firmFilterOptions = useMemo(() => [{ label: t("common.all"), value: "all" }, ...firmOptions], [firmOptions, t]);
  const canWrite = dataMode === "cloud" && firms.length > 0;
  const firmNameById = useMemo(() => new Map(firms.map((firm) => [firm.id, firm.name])), [firms]);
  const statusCounts = useMemo(() => {
    const counts: Record<AccountStatus, number> = {
      active: 0,
      closed: 0,
      evaluation: 0,
      failed: 0,
      funded: 0,
      passed: 0,
    };
    accounts.forEach((account) => {
      counts[account.status] += 1;
    });
    return counts;
  }, [accounts]);
  const accountOverview = useMemo(() => {
    return accounts.reduce(
      (total, account) => {
        total.accounts += 1;
        if (activeAccountStatuses.has(account.status)) total.active += 1;
        if (account.status === "funded") total.funded += 1;
        if (blockedAccountStatuses.has(account.status)) total.inactive += 1;
        return total;
      },
      { accounts: 0, active: 0, funded: 0, inactive: 0 },
    );
  }, [accounts]);
  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (firmFilter !== "all" && account.firmId !== firmFilter) return false;
        if (statusFilter !== "all" && account.status !== statusFilter) return false;
        return matchesSearch(searchQuery, [
          account.name,
          firmNameById.get(account.firmId),
          account.status,
          account.sizeLabel,
          account.size,
          account.purchasedAt,
        ]);
      }),
    [accounts, firmFilter, firmNameById, searchQuery, statusFilter],
  );

  const resetForm = () => {
    setDraft(emptyAccountInput);
    setEditingId(undefined);
  };

  const closeForm = () => {
    resetForm();
    setScreen("list");
  };

  const openNewAccount = () => {
    resetForm();
    setScreen("form");
  };

  const openEditAccount = (account: TradingAccount) => {
    setEditingId(account.id);
    setDraft({
      firmId: account.firmId,
      name: account.name,
      status: account.status,
      size: account.sizeLabel || String(account.size || ""),
      purchasedAt: account.purchasedAt,
      phaseTarget: account.phaseTarget || undefined,
      maxDrawdown: account.maxDrawdown || undefined,
      dailyDrawdown: account.dailyDrawdown || undefined,
    });
    setScreen("form");
  };

  useEffect(() => {
    if (!newAccountToken) return;
    openNewAccount();
    onNewAccountRequestHandled?.();
  }, [newAccountToken, onNewAccountRequestHandled]);

  return (
    <div className="firms-workspace">
      {screen === "form" && (
      <Modal
        onClose={closeForm}
        title={editingId ? t("account.modal.editTitle") : t("account.modal.newTitle")}
        subtitle={canWrite ? t("account.modal.subtitleWrite") : t("account.modal.subtitleReadonly")}
        width="wide"
      >
        <form
          className="entity-form resource-form-grid modal-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.firmId) {
              setFirmRequiredError(true);
              return;
            }
            setFirmRequiredError(false);
            const saved = await onSaveAccount(draft, editingId);
            if (saved) closeForm();
          }}
        >
          <label>
            <span>{t("account.field.firm")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => {
                setFirmRequiredError(false);
                setDraft((current) => ({ ...current, firmId: next }));
              }}
              options={firmOptions}
              placeholder={t("account.field.selectFirm")}
              value={draft.firmId}
            />
            {firmRequiredError && <p className="mutation-message error">{t("account.field.selectFirmRequired")}</p>}
          </label>

          <label>
            <span>{t("account.field.name")}</span>
            <input
              disabled={!canWrite || mutating}
              minLength={2}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("account.field.namePlaceholder")}
              required
              type="text"
              value={draft.name}
            />
          </label>

          <label>
            <span>{t("account.field.status")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => setDraft((current) => ({ ...current, status: next as AccountStatus }))}
              options={accountStatusOptions}
              value={draft.status}
            />
          </label>

          <label>
            <span>{t("account.field.size")}</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}
              placeholder={t("account.field.sizePlaceholder")}
              required
              type="text"
              value={draft.size}
            />
          </label>

          <label>
            <span>{t("account.field.purchase")}</span>
            <DatePicker
              disabled={!canWrite || mutating}
              onChange={(next) => setDraft((current) => ({ ...current, purchasedAt: next }))}
              value={draft.purchasedAt || ""}
            />
          </label>

          <NumberField
            disabled={!canWrite || mutating}
            label={t("account.field.target")}
            onChange={(value) => setDraft((current) => ({ ...current, phaseTarget: value }))}
            value={draft.phaseTarget}
          />
          <NumberField
            disabled={!canWrite || mutating}
            label={t("account.field.maxDrawdown")}
            onChange={(value) => setDraft((current) => ({ ...current, maxDrawdown: value }))}
            value={draft.maxDrawdown}
          />
          <NumberField
            disabled={!canWrite || mutating}
            label={t("account.field.dailyDrawdown")}
            onChange={(value) => setDraft((current) => ({ ...current, dailyDrawdown: value }))}
            value={draft.dailyDrawdown}
          />

          {mutationError && <p className="mutation-message error">{mutationError}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeForm} type="button">
              {t("common.cancel")}
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? t("common.saving") : editingId ? t("common.saveChanges") : t("account.modal.create")}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <>
      <section className="panel accounts-overview-panel">
        <div className="accounts-overview-copy">
          <span className="section-kicker">{t("account.overview.kicker")}</span>
          <h2>{t("account.overview.title")}</h2>
          <p>{t("account.overview.subtitle")}</p>
        </div>
        <div className="accounts-overview-stats" aria-label={t("account.overview.summaryLabel")}>
          <span>
            <WalletCards size={18} strokeWidth={2.2} />
            <strong>{accountOverview.accounts}</strong>
            <small>{t("account.overview.accounts")}</small>
          </span>
          <span>
            <BadgeCheck size={18} strokeWidth={2.2} />
            <strong>{accountOverview.funded}</strong>
            <small>{t("account.overview.funded")}</small>
          </span>
          <span>
            <Shield size={18} strokeWidth={2.2} />
            <strong>{accountOverview.active}</strong>
            <small>{t("account.overview.active")}</small>
          </span>
          <span>
            <CircleAlert size={18} strokeWidth={2.2} />
            <strong>{accountOverview.inactive}</strong>
            <small>{t("account.overview.inactive")}</small>
          </span>
        </div>
      </section>

      <section className="panel account-filter-panel">
        <div className="account-filter-head">
          <div>
            <h2>{t("account.filter.title")}</h2>
            <p>{t("account.filter.subtitle")}</p>
          </div>
          <div className="account-filter-head-actions">
            <span className="result-count">
              {filteredAccounts.length} {t("common.of")} {accounts.length} {t("account.filter.countSuffix")}
            </span>
            <FilterToggleButton active={firmFilter !== "all"} isOpen={filtersOpen} onClick={() => setFiltersOpen((current) => !current)} />
          </div>
        </div>
        {filtersOpen && (
        <div className="account-filter-row">
          <label>
            <span>{t("account.field.firm")}</span>
            <Select onChange={setFirmFilter} options={firmFilterOptions} value={firmFilter} />
          </label>
          <button
            className="secondary-action"
            onClick={() => {
              setFirmFilter("all");
              setStatusFilter("all");
            }}
            type="button"
          >
            {t("account.filter.resetFilters")}
          </button>
        </div>
        )}
        <div className="account-status-tabs" role="tablist" aria-label={t("account.filter.tabsLabel")}>
          {accountStatusFilters.map((option) => {
            const count = option.value === "all" ? accounts.length : statusCounts[option.value];
            const selected = statusFilter === option.value;
            return (
              <button
                aria-selected={selected}
                className={selected ? "is-active" : ""}
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                role="tab"
                type="button"
              >
                <span>{option.label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="account-card-grid" aria-label={t("account.card.gridLabel")}>
        {filteredAccounts.map((account) => {
          const relatedMovements = movements.some((movement) => movement.accountId === account.id);
          const relatedJournal = journalEntries.some((entry) => entry.accountId === account.id);
          const deleteDisabled = !canWrite || mutating || relatedMovements || relatedJournal;
          const hasDailyDrawdown = Boolean(account.dailyDrawdown);

          return (
            <article className={`account-card ${account.status}`} key={account.id}>
              <div className="account-card-head">
                <div>
                  <span className={`account-status-pill ${account.status}`}>{accountStatusLabelByValue.get(account.status) || account.status}</span>
                  <h2>{account.name}</h2>
                  <p>
                    <Building2 size={14} strokeWidth={2.2} />
                    {firmNameById.get(account.firmId) || t("account.card.noFirm")}
                  </p>
                </div>
                <strong>{formatAccountSize(account, currency)}</strong>
              </div>

              <div className="account-card-rules">
                <span>
                  <Flag size={15} strokeWidth={2.2} />
                  <small>{t("account.card.target")}</small>
                  <strong>{formatMoney(account.phaseTarget, currency)}</strong>
                </span>
                <span>
                  <Shield size={15} strokeWidth={2.2} />
                  <small>{t("account.card.maxDrawdown")}</small>
                  <strong>{formatMoney(account.maxDrawdown, currency)}</strong>
                </span>
                <span>
                  <CalendarDays size={15} strokeWidth={2.2} />
                  <small>{t("account.card.dailyDrawdown")}</small>
                  <strong>{hasDailyDrawdown ? formatMoney(account.dailyDrawdown, currency) : t("account.card.noLimit")}</strong>
                </span>
              </div>

              <div className="account-card-meta">
                <span>{t("account.card.purchasePrefix")} {account.purchasedAt || t("account.card.noDate")}</span>
                <span>
                  {relatedMovements || relatedJournal
                    ? `${relatedMovements ? t("account.card.movements") : ""}${relatedMovements && relatedJournal ? " + " : ""}${relatedJournal ? t("account.card.journal") : ""}`
                    : t("account.card.noActivity")}
                </span>
              </div>

              <div className="account-card-actions">
                <button
                  className="secondary-action"
                  disabled={!canWrite || mutating}
                  onClick={() => openEditAccount(account)}
                  type="button"
                >
                  <Pencil size={16} strokeWidth={2.2} />
                  {t("common.edit")}
                </button>
                <button
                  className="danger-action"
                  disabled={deleteDisabled}
                  onClick={() => {
                    if (!window.confirm(`${t("common.deleteConfirmPrefix")} ${account.name}?`)) return;
                    void onDeleteAccount(account.id);
                  }}
                  title={deleteDisabled ? t("account.card.deleteTitleBlocked") : t("account.card.deleteTitleAllowed")}
                  type="button"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                  {t("common.delete")}
                </button>
              </div>
            </article>
          );
        })}
        {filteredAccounts.length === 0 && (
          <article className="empty-panel inline-empty">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{accounts.length ? t("common.noResults") : t("account.empty.none")}</strong>
            <span>{accounts.length ? t("common.adjustFilters") : t("account.empty.createFirst")}</span>
          </article>
        )}
      </section>
      </>
    </div>
  );
}

function NumberField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: number | undefined) => void;
  value?: number;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        placeholder="0.00"
        step="0.01"
        type="number"
        value={value ?? ""}
      />
    </label>
  );
}
