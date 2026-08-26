import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { FilterToggleButton } from "./FilterToggle";
import { Modal } from "./Modal";
import { Select } from "./Select";
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
  /* No crea la cuenta aqui: lleva a Cuentas con el alta ya abierta y precargada, y esta
     misma entrada del movimiento en espera de la cuenta que salga de ahi. Reutiliza el
     formulario completo de cuenta (tipo, drawdown, objetivo) en vez de duplicar un
     subconjunto de campos dentro de este modal. */
  onRequestAccountForMovement: (input: MovementInput, movementId?: string) => void;
  onSaveMovement: (input: MovementInput, movementId?: string) => Promise<boolean>;
};

/* Valor centinela para la opcion "crear cuenta nueva" del selector de Cuenta: no puede
   coincidir con un id real (los ids de cuenta son uuid). */
const NEW_ACCOUNT_OPTION = "__new_account__";

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
  onRequestAccountForMovement,
  onSaveMovement,
}: MovementsViewProps) {
  const [draft, setDraft] = useState<MovementInput>(emptyMovementInput);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<"all" | MovementCategory>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [firmFilter, setFirmFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | MovementKind>("all");
  const [page, setPage] = useState(0);
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
  const kindOptions = useMemo(
    () => [
      { label: t("movement.kind.expense"), value: "expense" },
      { label: t("movement.kind.income"), value: "income" },
    ],
    [t],
  );
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ label: categoryLabels[category], value: category })),
    [categories, categoryLabels],
  );
  const firmFormOptions = useMemo(
    () => [{ label: t("movement.field.firmGeneral"), value: "" }, ...firms.map((firm) => ({ label: firm.name, value: firm.id }))],
    [firms, t],
  );
  const accountFormOptions = useMemo(
    () => [
      /* Primera y con acento: comprar el challenge antes de que la cuenta exista es
         el caso mas comun al registrar un gasto, no la excepcion. */
      { label: t("movement.field.createAccount"), value: NEW_ACCOUNT_OPTION, accent: true },
      { label: t("movement.field.noAccount"), value: "" },
      ...accountsForFirm.map((account) => ({ label: account.name, value: account.id })),
    ],
    [accountsForFirm, t],
  );
  const firmFilterOptions = useMemo(
    () => [{ label: t("common.all"), value: "all" }, ...firms.map((firm) => ({ label: firm.name, value: firm.id }))],
    [firms, t],
  );
  const kindFilterOptions = useMemo(
    () => [
      { label: t("movement.filter.kindAll"), value: "all" },
      { label: t("movement.filter.expenses"), value: "expense" },
      { label: t("movement.filter.incomes"), value: "income" },
    ],
    [t],
  );
  const categoryFilterOptions = useMemo(
    () => [{ label: t("common.all"), value: "all" }, ...allCategories.map((category) => ({ label: categoryLabels[category], value: category }))],
    [categoryLabels, t],
  );
  const hasActiveMovementFilters =
    firmFilter !== "all" || kindFilter !== "all" || categoryFilter !== "all" || fromFilter !== "" || toFilter !== "";
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

  /* pageSize fijo y no configurable: la tabla no tenia paginacion y pintaba todas las
     filas de golpe, que hoy son 25 pero solo va a crecer con el uso. currentPage se
     recalcula acotando "page" al numero de paginas real en cada render, en vez de
     resetearlo con un efecto cuando cambian los filtros: si un filtro deja menos
     paginas de las que habia, la pagina se ajusta sola sin dejar una pantalla vacia
     un instante hasta que corra el efecto. */
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedMovements = useMemo(
    () => filteredMovements.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [currentPage, filteredMovements],
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
      <Modal onClose={closeForm} title={editingId ? t("movement.modal.editTitle") : t("movement.modal.newTitle")}>
        <form
          className="entity-form movement-form modal-form-grid"
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
            /* Cuenta por crear: no se guarda el movimiento aqui. Se pasa a Cuentas con
               el alta abierta, y esta entrada queda a la espera de la cuenta que salga
               de ahi para guardarse ya enlazada. */
            if (input.accountId === NEW_ACCOUNT_OPTION) {
              onRequestAccountForMovement({ ...input, accountId: "" }, editingId);
              closeForm();
              return;
            }
            const saved = await onSaveMovement(input, editingId);
            if (saved) closeForm();
          }}
        >
          {/* Tipo primero y como segmentado, no desplegable: es binario, condiciona la lista
              de categorias y el signo del movimiento, asi que merece verse de un vistazo
              en vez de esconderse tras un clic. */}
          <div className="movement-kind-toggle" role="radiogroup" aria-label={t("movement.field.kind")}>
            {kindOptions.map((option) => (
              <button
                aria-checked={draft.kind === option.value}
                className={`${draft.kind === option.value ? "is-active" : ""} ${option.value === "income" ? "is-income" : "is-expense"}`}
                disabled={!canWrite || mutating}
                key={option.value}
                onClick={() => {
                  const kind = option.value as MovementKind;
                  setDraft((current) => ({
                    ...current,
                    kind,
                    category: kind === "income" ? "payout" : "challenge",
                    amount: kind === "income" ? calculatePayoutNetAmount(current.amount, 100) : current.amount,
                    payoutGrossAmount: kind === "income" ? current.amount || undefined : undefined,
                    payoutProfitSplit: kind === "income" ? 100 : undefined,
                  }));
                }}
                role="radio"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* El importe es el dato que da sentido al resto: tipografia grande y sufijo de
              divisa, para que sea lo primero que se lee y no una casilla mas de la rejilla. */}
          <label className="movement-amount-field">
            <span>{isPayout ? t("movement.field.payoutRequested") : t("movement.field.amount")}</span>
            <div className="movement-amount-input">
              <input
                disabled={!canWrite || mutating}
                min="0.01"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraft((current) =>
                    isPayout
                      ? { ...current, amount: calculatePayoutNetAmount(value, current.payoutProfitSplit || 100), payoutGrossAmount: value }
                      : { ...current, amount: value },
                  );
                }}
                placeholder="0,00"
                required
                step="0.01"
                type="number"
                value={(isPayout ? draft.payoutGrossAmount : draft.amount) || ""}
              />
              <em>{currency}</em>
            </div>
          </label>

          {isPayout && (
            <div className="movement-payout-block">
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
              <div className="payout-calculation" aria-live="polite">
                <span>
                  <small>{t("movement.payout.receiveInFinance")}</small>
                  <strong className="positive">+{formatMoney(draft.amount, currency)}</strong>
                </span>
                <span>
                  <small>{t("movement.payout.deductedFromAccount")}</small>
                  <strong className="negative">-{formatMoney(payoutGrossAmount, currency)}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="movement-form-grid">
          <label>
            <span>{t("movement.field.date")}</span>
            <DatePicker
              clearable={false}
              disabled={!canWrite || mutating}
              onChange={(next) => setDraft((current) => ({ ...current, date: next }))}
              value={draft.date}
            />
          </label>
          <label>
            <span>{t("movement.field.category")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => {
                const category = next as MovementCategory;
                setDraft((current) => ({
                  ...current,
                  category,
                  payoutGrossAmount: category === "payout" ? current.payoutGrossAmount || current.amount || undefined : undefined,
                  payoutProfitSplit: category === "payout" ? current.payoutProfitSplit || 100 : undefined,
                }));
              }}
              options={categoryOptions}
              value={draft.category}
            />
          </label>
          <label>
            <span>{t("movement.field.firm")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => setDraft((current) => ({ ...current, firmId: next, accountId: "" }))}
              options={firmFormOptions}
              value={draft.firmId || ""}
            />
          </label>
          <label>
            <span>{t("movement.field.account")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => {
                if (next === NEW_ACCOUNT_OPTION) {
                  /* No se crea aqui: se marca la intencion y se resuelve al enviar el
                     formulario, para no interrumpir mientras se sigue rellenando el
                     resto del movimiento. */
                  setDraft((current) => ({ ...current, accountId: NEW_ACCOUNT_OPTION }));
                  return;
                }
                const account = accounts.find((item) => item.id === next);
                setDraft((current) => ({
                  ...current,
                  accountId: next,
                  firmId: account?.firmId || current.firmId,
                }));
              }}
              options={accountFormOptions}
              value={draft.accountId || ""}
            />
          </label>
          {/* Clase propia en vez de .wide-field, que abarca 2 de 4 columnas y aqui dejaba
              media fila vacia. Esta ocupa el ancho completo de la rejilla de dos. */}
          <label className="movement-form-full">
            <span>{t("movement.field.note")}</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder={t("movement.field.notePlaceholder")}
              type="text"
              value={draft.note || ""}
            />
          </label>
          </div>

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
      {/* Sin tarjeta propia ni titulo: era una tarjeta suelta que solo decia
          "Movimientos", ya dicho por la vista misma, y no aportaba nada aparte del
          boton. Mismo patron que el dashboard de Finanzas (dashboard-filter-bar). */}
      <div className="dashboard-filter-bar">
        <FilterToggleButton active={hasActiveMovementFilters} isOpen={filtersOpen} onClick={() => setFiltersOpen((current) => !current)} />
      </div>

      {/* Tarjeta propia, no una fila mas junto al boton: asi se oculta entera cuando no
          hace falta filtrar, igual que en el dashboard de Finanzas. */}
      {filtersOpen && (
        <section className="panel dashboard-filter-panel">
          <div className="view-filters">
            <label>
              <span>{t("movement.field.firm")}</span>
              <Select onChange={setFirmFilter} options={firmFilterOptions} value={firmFilter} />
            </label>
            <label>
              <span>{t("movement.field.kind")}</span>
              <Select onChange={(next) => setKindFilter(next as "all" | MovementKind)} options={kindFilterOptions} value={kindFilter} />
            </label>
            <label>
              <span>{t("movement.field.category")}</span>
              <Select
                onChange={(next) => setCategoryFilter(next as "all" | MovementCategory)}
                options={categoryFilterOptions}
                value={categoryFilter}
              />
            </label>
            <label>
              <span>{t("movement.filter.from")}</span>
              <DatePicker onChange={setFromFilter} value={fromFilter} />
            </label>
            <label>
              <span>{t("movement.filter.to")}</span>
              <DatePicker onChange={setToFilter} value={toFilter} />
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
          </div>
        </section>
      )}

      {/* Sin cabecera propia: la tabla es el resultado del panel de filtros de arriba, no
          otra seccion. Repetirla dejaba "Movimientos" tres veces en la misma pantalla
          (titulo de vista, filtros y tabla). Mismo criterio que la rejilla de Empresas. */}
      <section className="panel table-panel">
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
              {pagedMovements.map((movement) => (
                <tr key={movement.id}>
                  <td data-label={t("movement.table.date")}>{movement.date}</td>
                  <td data-label={t("movement.table.firm")}>{firmNameById.get(movement.firmId) || t("movement.table.generalFirm")}</td>
                  <td data-label={t("movement.table.account")}>
                    {getAccountName(accounts, movement.accountId, t("movement.field.noAccount"))}
                  </td>
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
                  <td data-label={t("movement.table.note")}>
                    {movement.note || <span className="cell-empty">—</span>}
                  </td>
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
                      {/* Solo icono, igual que en las tarjetas de Empresas y Cuentas: es la
                          accion irreversible y no debe competir en peso con editar. Con texto
                          ocupaba mas ancho que cualquier columna de datos de la tabla. */}
                      <button
                        aria-label={`${t("common.delete")} ${movement.date}`}
                        className="card-delete"
                        disabled={!canWrite || mutating}
                        onClick={() => {
                          if (!window.confirm(t("movement.deleteConfirm"))) return;
                          void onDeleteMovement(movement.id);
                        }}
                        title={t("common.delete")}
                        type="button"
                      >
                        <Trash2 size={15} strokeWidth={2.2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMovements.length > 0 && (
          <div className="table-pagination">
            <span>
              {t("movement.pagination.showing")} {currentPage * pageSize + 1}
              {"\u2013"}
              {Math.min((currentPage + 1) * pageSize, filteredMovements.length)} {t("movement.pagination.of")}{" "}
              {filteredMovements.length}
            </span>
            {totalPages > 1 && (
              <div className="table-pagination-nav">
                <button
                  aria-label={t("movement.pagination.prev")}
                  className="icon-control compact-icon"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  type="button"
                >
                  <ChevronLeft size={15} strokeWidth={2.4} />
                </button>
                <button
                  aria-label={t("movement.pagination.next")}
                  className="icon-control compact-icon"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage(currentPage + 1)}
                  type="button"
                >
                  <ChevronRight size={15} strokeWidth={2.4} />
                </button>
              </div>
            )}
          </div>
        )}
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
