import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CalendarDays, Check, CircleAlert, Flag, Pencil, Plus, Shield, Trash2, WalletCards } from "lucide-react";
import { Modal } from "./Modal";
import { formatAccountSize, formatMoney } from "../lib/metrics";
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

const accountStatusOptions: Array<{ label: string; value: AccountStatus }> = [
  { label: "Activa", value: "active" },
  { label: "Evaluación", value: "evaluation" },
  { label: "Pasada", value: "passed" },
  { label: "Fondeada", value: "funded" },
  { label: "Fallada", value: "failed" },
  { label: "Cerrada", value: "closed" },
];

const accountStatusFilters: Array<{ label: string; value: "all" | AccountStatus }> = [
  { label: "Todas", value: "all" },
  ...accountStatusOptions,
];

const accountStatusLabelByValue = new Map(accountStatusOptions.map((option) => [option.value, option.label]));
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
  const [screen, setScreen] = useState<"list" | "form">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
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
        title={editingId ? "Editar cuenta" : "Nueva cuenta"}
        subtitle={canWrite ? "Configura cuenta, estado, tamaño y reglas de riesgo sin salir del listado." : "Configura Supabase y crea una empresa para guardar."}
        width="wide"
      >
        <form
          className="entity-form resource-form-grid modal-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSaveAccount(draft, editingId);
            if (saved) closeForm();
          }}
        >
          <label>
            <span>Empresa</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, firmId: event.target.value }))}
              required
              value={draft.firmId}
            >
              <option value="">Selecciona empresa</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Nombre</span>
            <input
              disabled={!canWrite || mutating}
              minLength={2}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="50K PA, Combine 150K..."
              required
              type="text"
              value={draft.name}
            />
          </label>

          <label>
            <span>Estado</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AccountStatus }))}
              value={draft.status}
            >
              {accountStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tamaño</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}
              placeholder="50K, 100K..."
              required
              type="text"
              value={draft.size}
            />
          </label>

          <label>
            <span>Compra</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, purchasedAt: event.target.value }))}
              type="date"
              value={draft.purchasedAt || ""}
            />
          </label>

          <NumberField
            disabled={!canWrite || mutating}
            label="Objetivo"
            onChange={(value) => setDraft((current) => ({ ...current, phaseTarget: value }))}
            value={draft.phaseTarget}
          />
          <NumberField
            disabled={!canWrite || mutating}
            label="Drawdown max."
            onChange={(value) => setDraft((current) => ({ ...current, maxDrawdown: value }))}
            value={draft.maxDrawdown}
          />
          <NumberField
            disabled={!canWrite || mutating}
            label="Drawdown diario"
            onChange={(value) => setDraft((current) => ({ ...current, dailyDrawdown: value }))}
            value={draft.dailyDrawdown}
          />

          {mutationError && <p className="mutation-message error">{mutationError}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeForm} type="button">
              Cancelar
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cuenta"}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <>
      <section className="panel accounts-overview-panel">
        <div className="accounts-overview-copy">
          <span className="section-kicker">Portfolio de cuentas</span>
          <h2>Cuentas de fondeo</h2>
          <p>Vista rápida de estados, tamaños, objetivos y drawdown para controlar cada cuenta sin entrar al detalle.</p>
        </div>
        <div className="accounts-overview-stats" aria-label="Resumen de cuentas">
          <span>
            <WalletCards size={18} strokeWidth={2.2} />
            <strong>{accountOverview.accounts}</strong>
            <small>Cuentas</small>
          </span>
          <span>
            <BadgeCheck size={18} strokeWidth={2.2} />
            <strong>{accountOverview.funded}</strong>
            <small>Fondeadas</small>
          </span>
          <span>
            <Shield size={18} strokeWidth={2.2} />
            <strong>{accountOverview.active}</strong>
            <small>Activas</small>
          </span>
          <span>
            <CircleAlert size={18} strokeWidth={2.2} />
            <strong>{accountOverview.inactive}</strong>
            <small>Inactivas</small>
          </span>
        </div>
      </section>

      <section className="panel account-filter-panel">
        <div className="account-filter-head">
          <div>
            <h2>Listado</h2>
            <p>Filtra por empresa o estado para revisar solo las cuentas que necesitas.</p>
          </div>
          <span className="result-count">
            {filteredAccounts.length} de {accounts.length} cuentas
          </span>
        </div>
        <div className="account-filter-row">
          <label>
            <span>Empresa</span>
            <select value={firmFilter} onChange={(event) => setFirmFilter(event.target.value)}>
              <option value="all">Todas</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-action"
            onClick={() => {
              setFirmFilter("all");
              setStatusFilter("all");
            }}
            type="button"
          >
            Reset filtros
          </button>
        </div>
        <div className="account-status-tabs" role="tablist" aria-label="Filtrar cuentas por estado">
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

      <section className="account-card-grid" aria-label="Cuentas registradas">
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
                    {firmNameById.get(account.firmId) || "Sin empresa"}
                  </p>
                </div>
                <strong>{formatAccountSize(account, currency)}</strong>
              </div>

              <div className="account-card-rules">
                <span>
                  <Flag size={15} strokeWidth={2.2} />
                  <small>Objetivo</small>
                  <strong>{formatMoney(account.phaseTarget, currency)}</strong>
                </span>
                <span>
                  <Shield size={15} strokeWidth={2.2} />
                  <small>DD max.</small>
                  <strong>{formatMoney(account.maxDrawdown, currency)}</strong>
                </span>
                <span>
                  <CalendarDays size={15} strokeWidth={2.2} />
                  <small>DD diario</small>
                  <strong>{hasDailyDrawdown ? formatMoney(account.dailyDrawdown, currency) : "Sin límite"}</strong>
                </span>
              </div>

              <div className="account-card-meta">
                <span>Compra: {account.purchasedAt || "Sin fecha"}</span>
                <span>
                  {relatedMovements || relatedJournal
                    ? `${relatedMovements ? "Movimientos" : ""}${relatedMovements && relatedJournal ? " + " : ""}${relatedJournal ? "Journal" : ""}`
                    : "Sin actividad asociada"}
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
                  Editar
                </button>
                <button
                  className="danger-action"
                  disabled={deleteDisabled}
                  onClick={() => {
                    if (!window.confirm(`Eliminar ${account.name}?`)) return;
                    void onDeleteAccount(account.id);
                  }}
                  title={deleteDisabled ? "La cuenta tiene movimientos o journal asociados" : "Eliminar cuenta"}
                  type="button"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                  Eliminar
                </button>
              </div>
            </article>
          );
        })}
        {filteredAccounts.length === 0 && (
          <article className="empty-panel inline-empty">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{accounts.length ? "Sin resultados" : "No hay cuentas todavía"}</strong>
            <span>{accounts.length ? "Ajusta búsqueda o filtros." : "Crea la primera cuenta desde Nueva cuenta."}</span>
          </article>
        )}
      </section>

      <section className="panel table-panel accounts-legacy-table">
        <div className="panel-heading">
          <div>
            <h2>Cuentas registradas</h2>
            <p>Listado limpio. Usa Nueva cuenta o Editar para abrir el formulario.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Empresa</th>
                <th>Estado</th>
                <th>Compra</th>
                <th className="align-right">Tamaño</th>
                <th className="align-right">Objetivo</th>
                <th className="align-right">Drawdown</th>
                <th className="align-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => {
                const relatedMovements = movements.some((movement) => movement.accountId === account.id);
                const relatedJournal = journalEntries.some((entry) => entry.accountId === account.id);
                const deleteDisabled = !canWrite || mutating || relatedMovements || relatedJournal;

                return (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{firmNameById.get(account.firmId) || "Sin empresa"}</td>
                    <td>
                      <span className={`account-status-pill ${account.status}`}>{account.status}</span>
                    </td>
                    <td>{account.purchasedAt || "-"}</td>
                    <td className="align-right">{formatAccountSize(account, currency)}</td>
                    <td className="align-right">{formatMoney(account.phaseTarget, currency)}</td>
                    <td className="align-right">{formatMoney(account.maxDrawdown, currency)}</td>
                    <td className="align-right">
                      <div className="row-actions">
                        <button
                          className="secondary-action"
                          disabled={!canWrite || mutating}
                          onClick={() => openEditAccount(account)}
                          type="button"
                        >
                          <Pencil size={16} strokeWidth={2.2} />
                          Editar
                        </button>
                        <button
                          className="danger-action"
                          disabled={deleteDisabled}
                          onClick={() => {
                            if (!window.confirm(`Eliminar ${account.name}?`)) return;
                            void onDeleteAccount(account.id);
                          }}
                          title={deleteDisabled ? "La cuenta tiene movimientos o journal asociados" : "Eliminar cuenta"}
                          type="button"
                        >
                          <Trash2 size={16} strokeWidth={2.2} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAccounts.length === 0 && (
          <article className="empty-panel inline-empty">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{accounts.length ? "Sin resultados" : "No hay cuentas todavía"}</strong>
            <span>{accounts.length ? "Ajusta búsqueda o filtros." : "Crea la primera cuenta desde Nueva cuenta."}</span>
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
