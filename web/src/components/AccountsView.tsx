import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CalendarDays, Check, CircleAlert, Eye, EyeOff, Flag, Pencil, Plus, Shield, Trash2, TrendingUp, Wallet, WalletCards } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { FilterToggleButton } from "./FilterToggle";
import { Modal } from "./Modal";
import { Select } from "./Select";
import {
  formatAccountSize,
  formatAmount,
  formatMoney,
  getAccountProgress,
  getAccountTradingDays,
} from "../lib/metrics";
import { useT } from "../lib/i18n/context";
import { matchesSearch } from "../lib/search";
import type {
  AccountInput,
  AccountKind,
  AccountStatus,
  Currency,
  DataMode,
  DrawdownType,
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
  /* Empresa con la que precargar el alta cuando la abre otra pantalla (Movimientos,
     al pedir crear la cuenta de un movimiento sin la suya todavia). */
  presetFirmId?: string;
  searchQuery: string;
  onClose?: () => void;
  onDeleteAccount: (accountId: string) => Promise<boolean>;
  onNewAccountRequestHandled?: () => void;
  onSaveAccount: (input: AccountInput, accountId?: string) => Promise<TradingAccount | false>;
  onSetAccountVisible: (accountId: string, visible: boolean) => Promise<boolean>;
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

function getAccountKindOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: AccountKind }> {
  return [
    { label: t("account.kind.challenge"), value: "challenge" },
    { label: t("account.kind.funded"), value: "funded" },
    { label: t("account.kind.own"), value: "own" },
  ];
}

function getDrawdownTypeOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: DrawdownType }> {
  return [
    { label: t("account.drawdownType.static"), value: "static" },
    { label: t("account.drawdownType.trailing"), value: "trailing" },
  ];
}

const activeAccountStatuses = new Set<AccountStatus>(["active", "evaluation", "passed", "funded"]);
const blockedAccountStatuses = new Set<AccountStatus>(["failed", "closed"]);

const emptyAccountInput: AccountInput = {
  firmId: "",
  name: "",
  status: "active",
  kind: "challenge",
  drawdownType: "static",
  parentAccountId: undefined,
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
  presetFirmId,
  searchQuery,
  onClose,
  onDeleteAccount,
  onNewAccountRequestHandled,
  onSaveAccount,
  onSetAccountVisible,
}: AccountsViewProps) {
  const [draft, setDraft] = useState<AccountInput>(emptyAccountInput);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [firmFilter, setFirmFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [firmRequiredError, setFirmRequiredError] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  /* Id de la evaluacion que se esta promocionando a fondeada. Solo se usa cuando el
     formulario se abrio desde el aviso de objetivo superado: al guardar la cuenta
     nueva, esta evaluacion pasa a status "passed" con una segunda llamada. */
  const [promotingFromId, setPromotingFromId] = useState<string | undefined>();
  const [screen, setScreen] = useState<"list" | "form">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const t = useT();
  const accountStatusOptions = useMemo(() => getAccountStatusOptions(t), [t]);
  const accountStatusFilters = useMemo(() => [{ label: t("common.all"), value: "all" as const }, ...accountStatusOptions], [accountStatusOptions, t]);
  const accountStatusLabelByValue = useMemo(() => new Map(accountStatusOptions.map((option) => [option.value, option.label])), [accountStatusOptions]);
  const accountKindOptions = useMemo(() => getAccountKindOptions(t), [t]);
  const drawdownTypeOptions = useMemo(() => getDrawdownTypeOptions(t), [t]);
  const firmOptions = useMemo(() => firms.map((firm) => ({ label: firm.name, value: firm.id })), [firms]);
  const firmFilterOptions = useMemo(() => [{ label: t("common.all"), value: "all" }, ...firmOptions], [firmOptions, t]);
  /* Capital propio no depende de una prop firm, asi que no hace falta tener ninguna
     empresa creada para poder guardarlo. El resto de tipos si la necesitan. */
  const canWrite = dataMode === "cloud" && (firms.length > 0 || draft.kind === "own");
  /* Cuentas de origen para el selector de "cuenta de origen" de una fondeada: solo
     challenges, y nunca la propia cuenta que se esta editando. */
  const challengeAccountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.kind === "challenge" && account.id !== editingId)
        .map((account) => ({ label: account.name, value: account.id })),
    [accounts, editingId],
  );
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
  /* Un challenge superado que ya tiene su fondeada enlazada ha terminado su historia
     como evaluacion, pase lo que pase despues con la fondeada: no hay nada mas que
     seguir midiendole dia a dia, asi que cuenta como terminada igual que una fallada o
     cerrada. Mientras no tenga fondeada enlazada se queda viva (con el aviso de
     promocionar), porque ahi si sigue pendiente una accion. */
  const finishedAccountIds = useMemo(() => {
    const ids = new Set<string>();
    accounts.forEach((account) => {
      if (blockedAccountStatuses.has(account.status)) {
        ids.add(account.id);
        return;
      }
      const hasFundedChild = account.kind === "challenge" && account.status === "passed"
        && accounts.some((other) => other.parentAccountId === account.id);
      if (hasFundedChild) ids.add(account.id);
    });
    return ids;
  }, [accounts]);
  const accountOverview = useMemo(() => {
    return accounts.reduce(
      (total, account) => {
        total.accounts += 1;
        if (!finishedAccountIds.has(account.id)) total.active += 1;
        if (account.status === "funded") total.funded += 1;
        if (finishedAccountIds.has(account.id)) total.inactive += 1;
        return total;
      },
      { accounts: 0, active: 0, funded: 0, inactive: 0 },
    );
  }, [accounts, finishedAccountIds]);
  /* Gastado y retirado por cuenta. En una cuenta terminada esto es lo unico que sigue
     siendo cierto: el objetivo y los drawdowns ya no rigen nada. */
  const accountTotals = useMemo(() => {
    const totals = new Map<string, { expenses: number; income: number }>();
    movements.forEach((movement) => {
      if (!movement.accountId) return;
      const current = totals.get(movement.accountId) || { expenses: 0, income: 0 };
      if (movement.kind === "income") current.income += movement.amount;
      else current.expenses += movement.amount;
      totals.set(movement.accountId, current);
    });
    return totals;
  }, [movements]);
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
  /* Dos grupos con peso distinto: lo que sigue corriendo y lo que ya termino. Ambos
     salen del mismo filtrado, asi que las pestanas de estado y el buscador siguen
     mandando sobre los dos. */
  const liveAccounts = useMemo(
    () => filteredAccounts.filter((account) => !finishedAccountIds.has(account.id)),
    [filteredAccounts, finishedAccountIds],
  );
  const finishedAccounts = useMemo(
    () => filteredAccounts.filter((account) => finishedAccountIds.has(account.id)),
    [filteredAccounts, finishedAccountIds],
  );

  /* Nombre propuesto a partir de empresa y tamano, con sufijo si ya existe uno igual.
     Antes habia que escribirlo a mano, y acababa cargando datos que la app ya conoce
     ("[ALPHA] 25K FUNDED" lleva empresa y estado dentro del texto libre). */
  const suggestedName = useMemo(() => {
    const firmName = firmNameById.get(draft.firmId);
    if (!firmName || !draft.size.trim()) return "";
    const base = `${firmName} ${formatSizeForName(draft.size)}`.trim();
    const taken = accounts.filter((account) => account.id !== editingId).map((account) => account.name.toLowerCase());
    if (!taken.includes(base.toLowerCase())) return base;
    let index = 2;
    while (taken.includes(`${base} #${index}`.toLowerCase())) index += 1;
    return `${base} #${index}`;
  }, [accounts, draft.firmId, draft.size, editingId, firmNameById]);

  useEffect(() => {
    /* Solo se rellena solo mientras el nombre no se haya tocado. Al editar una cuenta
       existente nunca se pisa: nameTouched se marca al abrir el formulario. */
    if (nameTouched || !suggestedName) return;
    setDraft((current) => (current.name === suggestedName ? current : { ...current, name: suggestedName }));
  }, [nameTouched, suggestedName]);

  const accountToInput = (account: TradingAccount): AccountInput => ({
    firmId: account.firmId,
    name: account.name,
    status: account.status,
    kind: account.kind,
    drawdownType: account.drawdownType,
    parentAccountId: account.parentAccountId,
    size: account.sizeLabel || String(account.size || ""),
    purchasedAt: account.purchasedAt,
    phaseTarget: account.phaseTarget || undefined,
    maxDrawdown: account.maxDrawdown || undefined,
    dailyDrawdown: account.dailyDrawdown || undefined,
  });

  const resetForm = () => {
    setDraft(emptyAccountInput);
    setEditingId(undefined);
    setNameTouched(false);
    setPromotingFromId(undefined);
  };

  const closeForm = () => {
    resetForm();
    setScreen("list");
    onClose?.();
  };

  const openNewAccount = () => {
    resetForm();
    setScreen("form");
  };

  const openEditAccount = (account: TradingAccount) => {
    setEditingId(account.id);
    setDraft(accountToInput(account));
    /* Una cuenta ya guardada tiene su nombre decidido: no se regenera al abrirla. */
    setNameTouched(true);
    setScreen("form");
  };

  /* Alta de la fondeada que nace de un challenge superado: formulario en blanco pero
     con el tipo, la empresa y la cuenta de origen ya resueltos. Es alta, no edicion
     (editingId se queda vacio): la evaluacion original sigue siendo su propia fila. */
  const openPromoteAccount = (account: TradingAccount) => {
    resetForm();
    setDraft({
      ...emptyAccountInput,
      kind: "funded",
      firmId: account.firmId,
      parentAccountId: account.id,
      /* La fondeada casi siempre hereda el tamano y las reglas de riesgo de la
         evaluacion de la que sale: mismo capital, mismo drawdown. El nombre se deja
         vacio a proposito para que el autogenerado (firma + tamano) haga lo suyo, que
         ya anade "#2" si el nombre base esta cogido. */
      size: account.sizeLabel || String(account.size || ""),
      maxDrawdown: account.maxDrawdown || undefined,
      dailyDrawdown: account.dailyDrawdown || undefined,
      drawdownType: account.drawdownType,
      purchasedAt: new Date().toISOString().slice(0, 10),
    });
    setPromotingFromId(account.id);
    setScreen("form");
  };

  useEffect(() => {
    if (!newAccountToken) return;
    openNewAccount();
    /* Si otra pantalla pidio el alta con una empresa ya decidida (el caso de
       Movimientos), se precarga aqui: openNewAccount ya dejo el draft en blanco. */
    if (presetFirmId) setDraft((current) => ({ ...current, firmId: presetFirmId }));
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
            if (!draft.firmId && draft.kind !== "own") {
              setFirmRequiredError(true);
              return;
            }
            setFirmRequiredError(false);
            const saved = await onSaveAccount(draft, editingId);
            if (!saved) return;
            /* Promocion: la cuenta fondeada ya se guardo, ahora la evaluacion de origen
               pasa a superada. Segunda llamada aparte porque son dos filas distintas. */
            if (promotingFromId) {
              const source = accounts.find((account) => account.id === promotingFromId);
              if (source) await onSaveAccount({ ...accountToInput(source), status: "passed" }, promotingFromId);
            }
            closeForm();
          }}
        >
          <label>
            <span>{t("account.field.kind")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => {
                const kind = next as AccountKind;
                setFirmRequiredError(false);
                setDraft((current) => ({
                  ...current,
                  kind,
                  firmId: kind === "own" ? "" : current.firmId,
                  phaseTarget: kind === "challenge" ? current.phaseTarget : undefined,
                  maxDrawdown: kind === "own" ? undefined : current.maxDrawdown,
                  dailyDrawdown: kind === "own" ? undefined : current.dailyDrawdown,
                  parentAccountId: kind === "funded" ? current.parentAccountId : undefined,
                }));
              }}
              options={accountKindOptions}
              value={draft.kind}
            />
          </label>

          {draft.kind !== "own" && (
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
          )}

          <label>
            <span>{t("account.field.name")}</span>
            <input
              disabled={!canWrite || mutating}
              minLength={2}
              onChange={(event) => {
                /* En cuanto se escribe, el nombre pasa a ser tuyo y deja de regenerarse.
                   Si se vacia vuelve a considerarse automatico, para poder deshacer. */
                setNameTouched(event.target.value.trim().length > 0);
                setDraft((current) => ({ ...current, name: event.target.value }));
              }}
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

          {draft.kind === "challenge" && (
            <NumberField
              disabled={!canWrite || mutating}
              label={t("account.field.target")}
              onChange={(value) => setDraft((current) => ({ ...current, phaseTarget: value }))}
              value={draft.phaseTarget}
            />
          )}
          {draft.kind !== "own" && (
            <>
              <NumberField
                disabled={!canWrite || mutating}
                label={t("account.field.maxDrawdown")}
                onChange={(value) => setDraft((current) => ({ ...current, maxDrawdown: value }))}
                value={draft.maxDrawdown}
              />
              <label>
                <span>{t("account.field.drawdownType")}</span>
                <Select
                  disabled={!canWrite || mutating}
                  onChange={(next) => setDraft((current) => ({ ...current, drawdownType: next as DrawdownType }))}
                  options={drawdownTypeOptions}
                  value={draft.drawdownType}
                />
              </label>
              <NumberField
                disabled={!canWrite || mutating}
                label={t("account.field.dailyDrawdown")}
                onChange={(value) => setDraft((current) => ({ ...current, dailyDrawdown: value }))}
                value={draft.dailyDrawdown}
              />
            </>
          )}
          {draft.kind === "funded" && (
            <label>
              <span>{t("account.field.parentAccount")}</span>
              <Select
                disabled={!canWrite || mutating}
                onChange={(next) => setDraft((current) => ({ ...current, parentAccountId: next || undefined }))}
                options={[{ label: t("account.field.parentAccountNone"), value: "" }, ...challengeAccountOptions]}
                placeholder={t("account.field.parentAccountNone")}
                value={draft.parentAccountId || ""}
              />
            </label>
          )}

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
        {/* Pestañas de estado y el disparador del filtro en la misma tarjeta que las
            metricas: antes vivian en su propia tarjeta "Listado" debajo, que no aportaba
            nada por si sola y duplicaba el aire que ya daba esta. grid-column:1/-1 para
            que la fila ocupe las dos columnas del grid de arriba (copy + stats). */}
        <div className="overview-tabs-row">
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
          <FilterToggleButton active={firmFilter !== "all"} isOpen={filtersOpen} onClick={() => setFiltersOpen((current) => !current)} />
        </div>
      </section>

      {/* Tarjeta propia, no una fila mas dentro de account-filter-panel: asi se oculta
          entera cuando no hace falta filtrar, igual que en el dashboard de Finanzas, en
          vez de dejar un hueco que cambia de alto dentro de la tarjeta del listado. */}
      {filtersOpen && (
        <section className="panel dashboard-filter-panel">
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
        </section>
      )}

      {/* La rejilla es solo para cuentas vivas. Una fallada o cerrada no es un elemento
          de trabajo sino una entrada de archivo, y darle la misma tarjeta que a una que
          sigue corriendo era el motivo real de que la pantalla se sintiera cargada: con
          8 de 9 cuentas terminadas, lo unico vivo quedaba enterrado entre lo muerto. */}
      <section className="account-card-grid" aria-label={t("account.card.gridLabel")}>
        {liveAccounts.map((account) => {
          const relatedMovements = movements.some((movement) => movement.accountId === account.id);
          const relatedJournal = journalEntries.some((entry) => entry.accountId === account.id);
          const deleteDisabled = !canWrite || mutating || relatedMovements || relatedJournal;
          /* Un limite sin definir llega como 0 desde la base de datos (numberOrZero en
             db.ts), asi que sin esta comprobacion se mostraba "0,00 US$": un dato
             ausente disfrazado de objetivo real. El DD diario ya lo distinguia; ahora
             los tres se comportan igual. */
          const hasPhaseTarget = Boolean(account.phaseTarget);
          const hasMaxDrawdown = Boolean(account.maxDrawdown);
          const hasDailyDrawdown = Boolean(account.dailyDrawdown);
          const kind = account.kind;
          const progress = getAccountProgress(account, journalEntries);
          const tradingDays = getAccountTradingDays(journalEntries, account.id);
          /* La barra necesita al menos un extremo para tener escala. Una cuenta de
             capital propio no tiene ni objetivo ni drawdown, asi que ahi no se pinta:
             se queda con balance y resultado, que es todo lo que se puede afirmar. */
          const hasBar = progress.floor !== undefined || progress.ceiling !== undefined;
          /* Si ya existe una fondeada enlazada a esta evaluacion, promocionar otra vez
             crearia una segunda por error. Una vez enlazada, el aviso ya no aporta nada. */
          const hasFundedChild = accounts.some((other) => other.parentAccountId === account.id);
          const isHidden = account.visible === false;

          return (
            <article className={`account-card ${account.status} ${isHidden ? "is-hidden" : ""}`} key={account.id}>
              <div className="account-card-head">
                <div>
                  <span className={`account-status-pill ${account.status}`}>{accountStatusLabelByValue.get(account.status) || account.status}</span>
                  {isHidden && <span className="account-status-pill is-hidden">{t("account.card.hiddenBadge")}</span>}
                  <h2>{account.name}</h2>
                  <p>
                    <Building2 size={14} strokeWidth={2.2} />
                    {firmNameById.get(account.firmId) || t("account.card.noFirm")}
                  </p>
                </div>
                <strong>{formatAccountSize(account, currency, t("account.card.noSize"))}</strong>
              </div>

              {/* Una cuenta viva se mide por donde esta, no por sus reglas en abstracto.
                  Antes las tres cajas repetian el objetivo y los drawdowns tal cual se
                  metieron en el formulario, sin decir cuanto llevas recorrido de cada
                  uno. Ahora el balance y el resultado van primero, y las reglas quedan
                  como referencia de lo que falta. */}
              <div className="account-card-rules">
                <span>
                  <Wallet size={15} strokeWidth={2.2} />
                  <small>{t("account.card.balanceNow")}</small>
                  <strong>{formatMoney(progress.current, currency)}</strong>
                </span>
                <span>
                  <TrendingUp size={15} strokeWidth={2.2} />
                  <small>{kind === "challenge" ? t("account.card.towardsTarget") : t("account.card.result")}</small>
                  <strong className={progress.pnl > 0 ? "positive" : progress.pnl < 0 ? "negative" : "is-unset"}>
                    {progress.pnl === 0 ? (
                      t("account.card.none")
                    ) : hasPhaseTarget && progress.pnl > 0 ? (
                      <>
                        {formatAmount(progress.pnl)}
                        <em> / {formatMoney(account.phaseTarget, currency)}</em>
                      </>
                    ) : (
                      formatMoney(progress.pnl, currency)
                    )}
                  </strong>
                </span>
                <span>
                  <CalendarDays size={15} strokeWidth={2.2} />
                  <small>{t("account.card.tradingDays")}</small>
                  <strong className={tradingDays ? undefined : "is-unset"}>
                    {tradingDays || t("account.card.none")}
                  </strong>
                </span>
                <span>
                  <Shield size={15} strokeWidth={2.2} />
                  <small>{t("account.card.dailyDrawdown")}</small>
                  <strong className={hasDailyDrawdown ? undefined : "is-unset"}>
                    {hasDailyDrawdown ? formatMoney(account.dailyDrawdown, currency) : t("account.card.noLimit")}
                  </strong>
                </span>
              </div>

              {/* Barra de recorrido: el centro es el balance de partida, a la izquierda
                  lo que puedes perder antes de reventar el drawdown y a la derecha lo
                  que falta para el objetivo. Las dos mitades no comparten escala a
                  proposito (un objetivo de 1.250 y un drawdown de 1.000 no son
                  comparables); cada lado mide cuanto te queda de lo suyo. */}
              {hasBar && (
                <div className={`account-track ${progress.pnl > 0 ? "is-up" : progress.pnl < 0 ? "is-down" : ""}`}>
                  <div className="account-track-bar">
                    <span className="account-track-start" aria-hidden="true" />
                    <span
                      className="account-track-fill"
                      style={{
                        left: `${Math.min(progress.position, 0.5) * 100}%`,
                        width: `${Math.abs(progress.position - 0.5) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="account-track-ends">
                    <span className="account-track-floor">
                      {progress.floor !== undefined ? formatMoney(progress.floor, currency) : "—"}
                      <small>{t("account.card.lossLimit")}</small>
                    </span>
                    <span className="account-track-ceiling">
                      {progress.ceiling !== undefined ? formatMoney(progress.ceiling, currency) : "—"}
                      <small>{hasPhaseTarget ? t("account.card.target") : t("account.card.noTarget")}</small>
                    </span>
                  </div>
                </div>
              )}

              {/* El challenge ya cumple el objetivo. No se cambia nada solo: el boton
                  abre el alta de la fondeada ya precargada, y al guardarla esta cuenta
                  pasa a superada. No se ofrece si ya tiene una fondeada enlazada: ya se
                  uso este objetivo, promocionar otra vez crearia una segunda de mas. */}
              {kind === "challenge" && progress.reachedTarget && !hasFundedChild && (
                <button
                  className="account-card-promote"
                  disabled={!canWrite || mutating}
                  onClick={() => openPromoteAccount(account)}
                  type="button"
                >
                  <BadgeCheck size={15} strokeWidth={2.2} />
                  {t("account.card.targetReached")}
                </button>
              )}

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
                {/* Ocultar no archiva ni borra: solo saca la cuenta de los desplegables
                    (dashboard del Journal, formulario de entrada, movimientos...). Sigue
                    aqui en la lista, atenuada, sigue sumando en todos los totales.
                    El icono es la ACCION, no el estado actual: un ojo abierto significa
                    "esto la hace visible" (se ve cuando esta oculta) y uno tachado
                    significa "esto la oculta" (se ve cuando esta visible). */}
                <button
                  aria-label={`${isHidden ? t("account.card.show") : t("account.card.hide")} ${account.name}`}
                  className="card-visibility"
                  disabled={!canWrite || mutating}
                  onClick={() => void onSetAccountVisible(account.id, isHidden)}
                  title={isHidden ? t("account.card.show") : t("account.card.hide")}
                  type="button"
                >
                  {isHidden ? <Eye size={15} strokeWidth={2.2} /> : <EyeOff size={15} strokeWidth={2.2} />}
                </button>
                {/* Solo icono, igual que en Empresas: es la accion irreversible y ademas
                    esta bloqueada en casi todas las cuentas (las que tienen movimientos o
                    journal), asi que no merece media fila de acciones. */}
                <button
                  aria-label={`${t("common.delete")} ${account.name}`}
                  className="card-delete"
                  disabled={deleteDisabled}
                  onClick={() => {
                    if (!window.confirm(`${t("common.deleteConfirmPrefix")} ${account.name}?`)) return;
                    void onDeleteAccount(account.id);
                  }}
                  title={deleteDisabled ? t("account.card.deleteTitleBlocked") : t("account.card.deleteTitleAllowed")}
                  type="button"
                >
                  <Trash2 size={15} strokeWidth={2.2} />
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

      {/* Archivo. Una fila por cuenta terminada y un solo numero: el resultado. Antes
          eran tres cajas (gastado, retirado, balance) de las que el balance no aportaba
          nunca, porque ninguna cuenta tiene gastado y retirado a la vez y acababa siendo
          uno de los otros dos repetido con el signo cambiado. El desglose se conserva en
          el title, y entero en Movimientos. */}
      {finishedAccounts.length > 0 && (
        <section className="account-archive" aria-label={t("account.archive.gridLabel")}>
          <h2>
            {t("account.archive.title")}
            <span>{finishedAccounts.length}</span>
          </h2>
          <ul>
            {finishedAccounts.map((account) => {
              const totals = accountTotals.get(account.id) || { expenses: 0, income: 0 };
              const netResult = totals.income - totals.expenses;
              const hasActivity = totals.expenses > 0 || totals.income > 0;
              const deleteDisabled =
                !canWrite ||
                mutating ||
                movements.some((movement) => movement.accountId === account.id) ||
                journalEntries.some((entry) => entry.accountId === account.id);
              const isHidden = account.visible === false;

              return (
                <li className={`account-archive-row ${isHidden ? "is-hidden" : ""}`} key={account.id}>
                  <span className="account-archive-status">
                    <span className={`account-status-pill ${account.status}`}>
                      {accountStatusLabelByValue.get(account.status) || account.status}
                    </span>
                    {isHidden && <span className="account-status-pill is-hidden">{t("account.card.hiddenBadge")}</span>}
                  </span>
                  <strong className="account-archive-name">{account.name}</strong>
                  <span className="account-archive-size">
                    {formatAccountSize(account, currency, t("account.card.noSize"))}
                  </span>
                  <strong
                    className={`account-archive-result ${hasActivity ? (netResult > 0 ? "positive" : netResult < 0 ? "negative" : "") : "is-unset"}`}
                    title={
                      hasActivity
                        ? `${t("account.card.spent")}: ${formatMoney(totals.expenses, currency)} · ${t("account.card.withdrawn")}: ${formatMoney(totals.income, currency)}`
                        : undefined
                    }
                  >
                    {hasActivity ? formatMoney(netResult, currency) : t("account.card.none")}
                  </strong>
                  <span className="account-archive-date">{account.purchasedAt || t("account.card.noDate")}</span>
                  <span className="account-archive-actions">
                    <button
                      aria-label={`${t("common.edit")} ${account.name}`}
                      className="card-delete"
                      disabled={!canWrite || mutating}
                      onClick={() => openEditAccount(account)}
                      title={t("common.edit")}
                      type="button"
                    >
                      <Pencil size={15} strokeWidth={2.2} />
                    </button>
                    {/* Aqui es donde de verdad se usa: las cuentas terminadas (falladas,
                        cerradas) son justo las "decenas de cuentas muertas" que el boton
                        existe para sacar de los desplegables. */}
                    <button
                      aria-label={`${isHidden ? t("account.card.show") : t("account.card.hide")} ${account.name}`}
                      className="card-visibility"
                      disabled={!canWrite || mutating}
                      onClick={() => void onSetAccountVisible(account.id, isHidden)}
                      title={isHidden ? t("account.card.show") : t("account.card.hide")}
                      type="button"
                    >
                      {isHidden ? <Eye size={15} strokeWidth={2.2} /> : <EyeOff size={15} strokeWidth={2.2} />}
                    </button>
                    <button
                      aria-label={`${t("common.delete")} ${account.name}`}
                      className="card-delete"
                      disabled={deleteDisabled}
                      onClick={() => {
                        if (!window.confirm(`${t("common.deleteConfirmPrefix")} ${account.name}?`)) return;
                        void onDeleteAccount(account.id);
                      }}
                      title={deleteDisabled ? t("account.card.deleteTitleBlocked") : t("account.card.deleteTitleAllowed")}
                      type="button"
                    >
                      <Trash2 size={15} strokeWidth={2.2} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
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

/** "25000" -> "25K" para el nombre automatico. Si ya viene escrito como etiqueta
 *  ("25K", "Flex 25K") se respeta tal cual: el usuario ya eligio como llamarlo. */
function formatSizeForName(size: string) {
  const raw = size.trim();
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));
  if (!/^[\d.,\s]+$/.test(raw) || !Number.isFinite(numeric) || numeric <= 0) return raw;
  if (numeric >= 1000) {
    const thousands = numeric / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return String(numeric);
}
