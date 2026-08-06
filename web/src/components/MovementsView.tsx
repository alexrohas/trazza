import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { calculatePayoutNetAmount, formatMoney, getAccountName, getPayoutGrossAmount } from "../lib/metrics";
import { useT } from "../lib/i18n/context";
import { matchesSearch } from "../lib/search";
import type {
  Currency,
  DataMode,
  Firm,
  Movement,
  MovementCategory,
  MovementInput,
  MovementKind,
  TradingAccount,
} from "../types";

type MovementsViewProps = {
  accounts: TradingAccount[];
  currency: Currency;
  dataMode: DataMode;
  firms: Firm[];
  movements: Movement[];
  mutationError?: string | null;
  mutating?: boolean;
  newMovementToken?: number;
  searchQuery: string;
  onDeleteMovement: (movementId: string) => Promise<boolean>;
  onNewMovementRequestHandled?: () => void;
  onSaveMovement: (input: MovementInput, movementId?: string) => Promise<boolean>;
};

const expenseCategories: MovementCategory[] = ["challenge", "reset", "activation", "subscription", "platform", "commission", "other"];
const incomeCategories: MovementCategory[] = ["payout", "refund", "other"];
const allCategories = [...expenseCategories, ...incomeCategories.filter((category) => !expenseCategories.includes(category))];

export function getMovementCategoryLabels(t: ReturnType<typeof useT>): Record<MovementCategory, string> {
  return {
    challenge: t("movement.category.challenge"),
    reset: t("movement.category.reset"),
    activation: t("movement.category.activation"),
    subscription: t("movement.category.subscription"),
    platform: t("movement.category.platform"),
    commission: t("movement.category.commission"),
    payout: t("movement.category.payout"),
    refund: t("movement.category.refund"),
    other: t("movement.category.other"),
  };
}

const emptyMovementInput: MovementInput = {
  date: new Date().toISOString().slice(0, 10),
  kind: "expense",
  category: "challenge",
  amount: 0,
  payoutProfitSplit: 100,
  firmId: "",
  accountId: "",
  note: "",
};

export function MovementsView({
  accounts,
  currency,
  dataMode,
  firms,
  movements,
  mutationError,
  mutating = false,
  newMovementToken = 0,
  searchQuery,
  onDeleteMovement,
  onNewMovementRequestHandled,
  onSaveMovement,
}: MovementsViewProps) {
  const [draft, setDraft] = useState<MovementInput>(emptyMovementInput);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<"all" | MovementCategory>("all");
  const [firmFilter, setFirmFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | MovementKind>("all");
  const [screen, setScreen] = useState<"list" | "form">("list");
  const [toFilter, setToFilter] = useState("");
  const t = useT();
  const categoryLabels = useMemo(() => getMovementCategoryLabels(t), [t]);
  const canWrite = dataMode === "cloud";
  const categories = draft.kind === "income" ? incomeCategories : expenseCategories;
  const isPayout = draft.kind === "income" && draft.category === "payout";
  const payoutGrossAmount = draft.payoutGrossAmount || 0;
  const payoutProfitSplit = draft.payoutProfitSplit || 100;
  const accountsForFirm = useMemo(
    () => (draft.firmId ? accounts.filter((account) => account.firmId === draft.firmId) : accounts),
    [accounts, draft.firmId],
  );
  const firmNameById = useMemo(() => new Map(firms.map((firm) => [firm.id, firm.name])), [firms]);
  const accountNameById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (firmFilter !== "all" && movement.firmId !== firmFilter) return false;
        if (kindFilter !== "all" && movement.kind !== kindFilter) return false;
        if (categoryFilter !== "all" && movement.category !== categoryFilter) return false;
        if (fromFilter && movement.date < fromFilter) return false;
        if (toFilter && movement.date > toFilter) return false;
        return matchesSearch(searchQuery, [
          movement.date,
          movement.kind,
          categoryLabels[movement.category],
          movement.category,
          movement.note,
          movement.amount,
          firmNameById.get(movement.firmId),
          accountNameById.get(movement.accountId || ""),
        ]);
      }),
    [accountNameById, categoryFilter, firmFilter, firmNameById, fromFilter, kindFilter, movements, searchQuery, toFilter],
  );

  const resetForm = () => {
    setDraft(emptyMovementInput);
    setEditingId(undefined);
  };

  const closeForm = () => {
    resetForm();
    setScreen("list");
  };

  const openNewMovement = () => {
    resetForm();
    setScreen("form");
  };

  const openEditMovement = (movement: Movement) => {
    setEditingId(movement.id);
    setDraft({
      date: movement.date,
      kind: movement.kind,
      category: movement.category,
      amount: movement.amount,
      payoutGrossAmount: movement.category === "payout" ? getPayoutGrossAmount(movement) : undefined,
      payoutProfitSplit: movement.category === "payout" ? movement.payoutProfitSplit || 100 : undefined,
      firmId: movement.firmId,
      accountId: movement.accountId || "",
      note: movement.note || "",
    });
    setScreen("form");
  };

  useEffect(() => {
    if (!newMovementToken) return;
    openNewMovement();
    onNewMovementRequestHandled?.();
  }, [newMovementToken, onNewMovementRequestHandled]);

  return (
    <div className="firms-workspace">
      {screen === "form" && (
      <Modal
        onClose={closeForm}
        title={editingId ? t("movement.modal.editTitle") : t("movement.modal.newTitle")}
        subtitle={t("movement.modal.subtitle")}
      >
        <form
          className="entity-form resource-form-grid modal-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            const input = isPayout
              ? {
                  ...draft,
                  amount: calculatePayoutNetAmount(payoutGrossAmount, payoutProfitSplit),
                  payoutGrossAmount,
                  payoutProfitSplit,
                }
              : { ...draft, payoutGrossAmount: undefined, payoutProfitSplit: undefined };
            const saved = await onSaveMovement(input, editingId);
            if (saved) closeForm();
          }}
        >
          <label>
            <span>{t("movement.field.date")}</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              required
              type="date"
              value={draft.date}
            />
          </label>
          <label>
            <span>{t("movement.field.kind")}</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => {
                const kind = event.target.value as MovementKind;
                setDraft((current) => ({
                  ...current,
                  kind,
                  category: kind === "income" ? "payout" : "challenge",
                  amount: kind === "income" ? calculatePayoutNetAmount(current.amount, 100) : current.amount,
                  payoutGrossAmount: kind === "income" ? current.amount || undefined : undefined,
                  payoutProfitSplit: kind === "income" ? 100 : undefined,
                }));
              }}
              value={draft.kind}
            >
              <option value="expense">{t("movement.kind.expense")}</option>
              <option value="income">{t("movement.kind.income")}</option>
            </select>
          </label>
          <label>
            <span>{t("movement.field.category")}</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => {
                const category = event.target.value as MovementCategory;
                setDraft((current) => ({
                  ...current,
                  category,
                  payoutGrossAmount: category === "payout" ? current.payoutGrossAmount || current.amount || undefined : undefined,
                  payoutProfitSplit: category === "payout" ? current.payoutProfitSplit || 100 : undefined,
                }));
              }}
              value={draft.category}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          {isPayout ? (
            <>
              <label>
                <span>{t("movement.field.payoutRequested")}</span>
                <input
                  disabled={!canWrite || mutating}
                  min="0.01"
                  onChange={(event) => {
                    const grossAmount = Number(event.target.value);
                    setDraft((current) => ({
                      ...current,
                      amount: calculatePayoutNetAmount(grossAmount, current.payoutProfitSplit || 100),
                      payoutGrossAmount: grossAmount,
                    }));
                  }}
                  required
                  step="0.01"
                  type="number"
                  value={draft.payoutGrossAmount || ""}
                />
              </label>
              <label>
                <span>{t("movement.field.profitSplit")}</span>
                <div className="input-with-suffix">
                  <input
                    disabled={!canWrite || mutating}
                    max="100"
                    min="1"
                    onChange={(event) => {
                      const split = Number(event.target.value);
                      setDraft((current) => ({
                        ...current,
                        amount: calculatePayoutNetAmount(current.payoutGrossAmount || 0, split),
                        payoutProfitSplit: split,
                      }));
                    }}
                    required
                    step="0.01"
                    type="number"
                    value={draft.payoutProfitSplit || ""}
                  />
                  <span>%</span>
                </div>
              </label>
              <div className="payout-calculation wide-field" aria-live="polite">
                <span>
                  <small>{t("movement.payout.receiveInFinance")}</small>
                  <strong className="positive">+{formatMoney(draft.amount, currency)}</strong>
                </span>
                <span>
                  <small>{t("movement.payout.deductedFromAccount")}</small>
                  <strong className="negative">-{formatMoney(payoutGrossAmount, currency)}</strong>
                </span>
              </div>
            </>
          ) : (
            <label>
              <span>{t("movement.field.amount")}</span>
              <input
                disabled={!canWrite || mutating}
                min="0.01"
                onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value) }))}
                required
                step="0.01"
                type="number"
                value={draft.amount || ""}
              />
            </label>
          )}
          <label>
            <span>{t("movement.field.firm")}</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, firmId: event.target.value, accountId: "" }))}
              value={draft.firmId || ""}
            >
              <option value="">{t("movement.field.firmGeneral")}</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("movement.field.account")}</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => {
                const account = accounts.find((item) => item.id === event.target.value);
                setDraft((current) => ({
                  ...current,
                  accountId: event.target.value,
                  firmId: account?.firmId || current.firmId,
                }));
              }}
              value={draft.accountId || ""}
            >
              <option value="">{t("movement.field.noAccount")}</option>
              {accountsForFirm.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            <span>{t("movement.field.note")}</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder={t("movement.field.notePlaceholder")}
              type="text"
              value={draft.note || ""}
            />
          </label>

          {mutationError && <p className="mutation-message error">{mutationError}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeForm} type="button">
              {t("common.cancel")}
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? t("common.saving") : editingId ? t("common.saveChanges") : t("movement.modal.create")}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <>
      <section className="panel view-filter-panel">
        <div className="resource-list-toolbar">
          <div>
            <h2>{t("movement.list.title")}</h2>
            <p>{t("movement.list.subtitle")}</p>
          </div>
        </div>
        <div className="view-filters">
          <label>
            <span>{t("movement.field.firm")}</span>
            <select value={firmFilter} onChange={(event) => setFirmFilter(event.target.value)}>
              <option value="all">{t("common.all")}</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("movement.field.kind")}</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | MovementKind)}>
              <option value="all">{t("movement.filter.kindAll")}</option>
              <option value="expense">{t("movement.filter.expenses")}</option>
              <option value="income">{t("movement.filter.incomes")}</option>
            </select>
          </label>
          <label>
            <span>{t("movement.field.category")}</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | MovementCategory)}>
              <option value="all">{t("common.all")}</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("movement.filter.from")}</span>
            <input type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} />
          </label>
          <label>
            <span>{t("movement.filter.to")}</span>
            <input type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} />
          </label>
          <button
            className="secondary-action"
            onClick={() => {
              setCategoryFilter("all");
              setFirmFilter("all");
              setFromFilter("");
              setKindFilter("all");
              setToFilter("");
            }}
            type="button"
          >
            {t("movement.filter.resetFilters")}
          </button>
          <span className="result-count">
            {filteredMovements.length} {t("common.of")} {movements.length} {t("movement.filter.countSuffix")}
          </span>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("movement.table.title")}</h2>
            <p>{t("movement.table.subtitle")}</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("movement.table.date")}</th>
                <th>{t("movement.table.firm")}</th>
                <th>{t("movement.table.account")}</th>
                <th>{t("movement.table.category")}</th>
                <th>{t("movement.table.note")}</th>
                <th className="align-right">{t("movement.table.amount")}</th>
                <th className="align-right">{t("movement.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((movement) => (
                <tr key={movement.id}>
                  <td data-label={t("movement.table.date")}>{movement.date}</td>
                  <td data-label={t("movement.table.firm")}>{firmNameById.get(movement.firmId) || t("movement.table.generalFirm")}</td>
                  <td data-label={t("movement.table.account")}>{getAccountName(accounts, movement.accountId)}</td>
                  <td data-label={t("movement.table.category")}>
                    <span className="movement-category-copy">
                      <strong>{categoryLabels[movement.category]}</strong>
                      {movement.category === "payout" && (
                        <small>
                          {formatMoney(getPayoutGrossAmount(movement), currency)} {t("movement.table.grossSuffix")} · {movement.payoutProfitSplit || 100}%
                        </small>
                      )}
                    </span>
                  </td>
                  <td data-label={t("movement.table.note")}>{movement.note || "-"}</td>
                  <td className={`align-right amount ${movement.kind}`} data-label={t("movement.table.amount")}>
                    {movement.kind === "income" ? "+" : "-"}
                    {formatMoney(movement.amount, currency)}
                  </td>
                  <td className="align-right" data-label={t("movement.table.actions")}>
                    <div className="row-actions">
                        <button
                          className="secondary-action"
                          disabled={!canWrite || mutating}
                          onClick={() => openEditMovement(movement)}
                          type="button"
                        >
                        <Pencil size={16} strokeWidth={2.2} />
                        {t("common.edit")}
                      </button>
                      <button
                        className="danger-action"
                        disabled={!canWrite || mutating}
                        onClick={() => {
                          if (!window.confirm(t("movement.deleteConfirm"))) return;
                          void onDeleteMovement(movement.id);
                        }}
                        type="button"
                      >
                        <Trash2 size={16} strokeWidth={2.2} />
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMovements.length === 0 && (
          <article className="empty-panel inline-empty">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{movements.length ? t("common.noResults") : t("movement.empty.none")}</strong>
            <span>{movements.length ? t("common.adjustFilters") : t("movement.empty.createFirst")}</span>
          </article>
        )}
      </section>
      </>
    </div>
  );
}
