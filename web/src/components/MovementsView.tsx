import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { formatMoney, getAccountName } from "../lib/metrics";
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
const categoryLabels: Record<MovementCategory, string> = {
  challenge: "Challenge",
  reset: "Reset",
  activation: "Activacion",
  subscription: "Suscripcion",
  platform: "Plataforma",
  commission: "Comision",
  payout: "Payout",
  refund: "Refund",
  other: "Otro",
};

const emptyMovementInput: MovementInput = {
  date: new Date().toISOString().slice(0, 10),
  kind: "expense",
  category: "challenge",
  amount: 0,
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
  const canWrite = dataMode === "cloud";
  const categories = draft.kind === "income" ? incomeCategories : expenseCategories;
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
        title={editingId ? "Editar movimiento" : "Nuevo movimiento"}
        subtitle="Registra el pago o ingreso sin salir del historial."
      >
        <form
          className="entity-form resource-form-grid modal-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSaveMovement(draft, editingId);
            if (saved) closeForm();
          }}
        >
          <label>
            <span>Fecha</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              required
              type="date"
              value={draft.date}
            />
          </label>
          <label>
            <span>Tipo</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => {
                const kind = event.target.value as MovementKind;
                setDraft((current) => ({
                  ...current,
                  kind,
                  category: kind === "income" ? "payout" : "challenge",
                }));
              }}
              value={draft.kind}
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </label>
          <label>
            <span>Categoria</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as MovementCategory }))}
              value={draft.category}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Importe</span>
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
          <label>
            <span>Empresa</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, firmId: event.target.value, accountId: "" }))}
              value={draft.firmId || ""}
            >
              <option value="">General / sin empresa</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cuenta</span>
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
              <option value="">Sin cuenta</option>
              {accountsForFirm.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            <span>Nota</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="Detalle del pago o retiro"
              type="text"
              value={draft.note || ""}
            />
          </label>

          {mutationError && <p className="mutation-message error">{mutationError}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeForm} type="button">
              Cancelar
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? "Guardando..." : editingId ? "Guardar cambios" : "Crear movimiento"}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <>
      <section className="panel view-filter-panel">
        <div className="resource-list-toolbar">
          <div>
            <h2>Movimientos</h2>
            <p>Historial financiero separado de la pantalla de creacion.</p>
          </div>
        </div>
        <div className="view-filters">
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
          <label>
            <span>Tipo</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | MovementKind)}>
              <option value="all">Todos</option>
              <option value="expense">Gastos</option>
              <option value="income">Ingresos</option>
            </select>
          </label>
          <label>
            <span>Categoria</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | MovementCategory)}>
              <option value="all">Todas</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Desde</span>
            <input type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
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
            Reset filtros
          </button>
          <span className="result-count">
            {filteredMovements.length} de {movements.length} movimientos
          </span>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Movimientos</h2>
            <p>Historial editable de ingresos y gastos.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empresa</th>
                <th>Cuenta</th>
                <th>Categoria</th>
                <th>Nota</th>
                <th className="align-right">Importe</th>
                <th className="align-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.date}</td>
                  <td>{firmNameById.get(movement.firmId) || "General"}</td>
                  <td>{getAccountName(accounts, movement.accountId)}</td>
                  <td>{categoryLabels[movement.category]}</td>
                  <td>{movement.note || "-"}</td>
                  <td className={`align-right amount ${movement.kind}`}>
                    {movement.kind === "income" ? "+" : "-"}
                    {formatMoney(movement.amount, currency)}
                  </td>
                  <td className="align-right">
                    <div className="row-actions">
                        <button
                          className="secondary-action"
                          disabled={!canWrite || mutating}
                          onClick={() => openEditMovement(movement)}
                          type="button"
                        >
                        <Pencil size={16} strokeWidth={2.2} />
                        Editar
                      </button>
                      <button
                        className="danger-action"
                        disabled={!canWrite || mutating}
                        onClick={() => {
                          if (!window.confirm("Eliminar movimiento?")) return;
                          void onDeleteMovement(movement.id);
                        }}
                        type="button"
                      >
                        <Trash2 size={16} strokeWidth={2.2} />
                        Eliminar
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
            <strong>{movements.length ? "Sin resultados" : "No hay movimientos todavia"}</strong>
            <span>{movements.length ? "Ajusta busqueda o filtros." : "Crea el primero desde Nuevo movimiento."}</span>
          </article>
        )}
      </section>
      </>
    </div>
  );
}
