import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Check, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { Modal } from "./Modal";
import { matchesSearch } from "../lib/search";
import type { AccountStatus, DataMode, Firm, FirmInput, FirmType, TradingAccount } from "../types";

type FirmsViewProps = {
  accounts: TradingAccount[];
  dataMode: DataMode;
  firms: Firm[];
  mutationError?: string | null;
  mutating?: boolean;
  newFirmToken?: number;
  searchQuery: string;
  onDeleteFirm: (firmId: string) => Promise<boolean>;
  onNewFirmRequestHandled?: () => void;
  onSaveFirm: (input: FirmInput, firmId?: string) => Promise<boolean>;
};

const firmTypeOptions: Array<{ label: string; value: FirmType }> = [
  { label: "Futuros", value: "futures" },
  { label: "Forex", value: "forex" },
  { label: "Crypto", value: "crypto" },
  { label: "Otro", value: "other" },
];

const firmTypeFilters: Array<{ label: string; value: "all" | FirmType }> = [
  { label: "Todas", value: "all" },
  ...firmTypeOptions,
];

const firmTypeLabelByValue = new Map(firmTypeOptions.map((option) => [option.value, option.label]));
const activeAccountStatuses = new Set<AccountStatus>(["active", "evaluation", "passed", "funded"]);

const emptyFirmInput: FirmInput = {
  name: "",
  type: "futures",
  notes: "",
};

export function FirmsView({
  accounts,
  dataMode,
  firms,
  mutationError,
  mutating = false,
  newFirmToken = 0,
  searchQuery,
  onDeleteFirm,
  onNewFirmRequestHandled,
  onSaveFirm,
}: FirmsViewProps) {
  const [draft, setDraft] = useState<FirmInput>(emptyFirmInput);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | FirmType>("all");
  const firmTypeCounts = useMemo(() => {
    const counts: Record<FirmType, number> = {
      crypto: 0,
      forex: 0,
      futures: 0,
      other: 0,
    };
    firms.forEach((firm) => {
      counts[firm.type] += 1;
    });
    return counts;
  }, [firms]);
  const firmStatsById = useMemo(() => {
    const statsById = new Map<string, { active: number; funded: number; inactive: number; total: number }>();
    firms.forEach((firm) => {
      statsById.set(firm.id, { active: 0, funded: 0, inactive: 0, total: 0 });
    });
    accounts.forEach((account) => {
      const current = statsById.get(account.firmId);
      if (!current) return;
      current.total += 1;
      if (account.status === "funded") current.funded += 1;
      if (activeAccountStatuses.has(account.status)) {
        current.active += 1;
      } else {
        current.inactive += 1;
      }
    });
    return statsById;
  }, [accounts, firms]);
  const overviewStats = useMemo(() => {
    let activeAccounts = 0;
    let fundedAccounts = 0;

    firmStatsById.forEach((stats) => {
      activeAccounts += stats.active;
      fundedAccounts += stats.funded;
    });

    return {
      activeAccounts,
      fundedAccounts,
      totalAccounts: accounts.length,
      totalFirms: firms.length,
    };
  }, [accounts.length, firmStatsById, firms.length]);
  const filteredFirms = useMemo(
    () =>
      firms.filter((firm) => {
        if (typeFilter !== "all" && firm.type !== typeFilter) return false;
        return matchesSearch(searchQuery, [firm.name, firm.type, firm.notes]);
      }),
    [firms, searchQuery, typeFilter],
  );
  const canWrite = dataMode === "cloud";
  const editingFirm = editingId ? firms.find((firm) => firm.id === editingId) : undefined;

  const resetForm = () => {
    setDraft(emptyFirmInput);
    setEditingId(undefined);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const openNewFirm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditFirm = (firm: Firm) => {
    setEditingId(firm.id);
    setDraft({
      name: firm.name,
      type: firm.type,
      notes: firm.notes || "",
    });
    setFormOpen(true);
  };

  useEffect(() => {
    if (!newFirmToken) return;
    openNewFirm();
    onNewFirmRequestHandled?.();
  }, [newFirmToken, onNewFirmRequestHandled]);

  return (
    <div className="firms-workspace">
      {formOpen && (
      <Modal
        onClose={closeForm}
        title={editingFirm ? "Editar empresa" : "Nueva empresa"}
        subtitle={canWrite ? "Guarda la empresa y mantén la lista visible detrás." : "Conecta Supabase para guardar cambios reales."}
      >
        <form
          className="firm-form modal-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSaveFirm(draft, editingId);
            if (saved) closeForm();
          }}
        >
          <label>
            <span>Nombre</span>
            <input
              disabled={!canWrite || mutating}
              minLength={2}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Apex, Topstep, FTMO..."
              required
              type="text"
              value={draft.name}
            />
          </label>

          <label>
            <span>Tipo</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as FirmType }))}
              value={draft.type}
            >
              {firmTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="firm-notes-field">
            <span>Notas</span>
            <textarea
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Reglas, payout, observaciones..."
              rows={3}
              value={draft.notes}
            />
          </label>

          {mutationError && <p className="mutation-message error">{mutationError}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeForm} type="button">
              Cancelar
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? "Guardando..." : editingFirm ? "Guardar cambios" : "Crear empresa"}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <section className="panel firm-overview-panel">
        <div className="firm-overview-copy">
          <span className="section-kicker">Directorio de empresas</span>
          <h2>Empresas de fondeo</h2>
          <p>Ten ubicadas tus firmas, sus cuentas asociadas y el estado general antes de entrar al detalle.</p>
        </div>
        <div className="firm-overview-stats" aria-label="Resumen de empresas">
          <span>
            <Building2 size={18} strokeWidth={2.2} />
            <strong>{overviewStats.totalFirms}</strong>
            <small>Empresas</small>
          </span>
          <span>
            <WalletCards size={18} strokeWidth={2.2} />
            <strong>{overviewStats.totalAccounts}</strong>
            <small>Cuentas</small>
          </span>
          <span>
            <BadgeCheck size={18} strokeWidth={2.2} />
            <strong>{overviewStats.fundedAccounts}</strong>
            <small>Fondeadas</small>
          </span>
          <span>
            <Check size={18} strokeWidth={2.2} />
            <strong>{overviewStats.activeAccounts}</strong>
            <small>Activas</small>
          </span>
        </div>
      </section>

      <section className="panel firm-filter-panel">
        <div className="firm-filter-head">
          <div>
            <h2>Listado</h2>
            <p>Filtra por tipo y revisa rápidamente dónde tienes cuentas activas.</p>
          </div>
          <span className="result-count">
            {filteredFirms.length} de {firms.length} empresas
          </span>
        </div>
        <div className="firm-type-tabs" role="tablist" aria-label="Filtrar empresas por tipo">
          {firmTypeFilters.map((option) => {
            const count = option.value === "all" ? firms.length : firmTypeCounts[option.value];
            const selected = typeFilter === option.value;
            return (
              <button
                aria-selected={selected}
                className={selected ? "is-active" : ""}
                key={option.value}
                onClick={() => setTypeFilter(option.value)}
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

      <section className="directory-grid firms-grid">
        {filteredFirms.map((firm) => {
          const firmStats = firmStatsById.get(firm.id) || { active: 0, funded: 0, inactive: 0, total: 0 };
          const activeShare = firmStats.total ? Math.round((firmStats.active / firmStats.total) * 100) : 0;
          const deleteDisabled = !canWrite || mutating || firmStats.total > 0;

          return (
            <article className="directory-card firm-card" key={firm.id}>
              <div className="firm-card-header">
                <span className="firm-avatar" aria-hidden="true">
                  <Building2 size={19} strokeWidth={2.25} />
                </span>
                <div>
                  <span className={`firm-type-pill ${firm.type}`}>{firmTypeLabelByValue.get(firm.type)}</span>
                  <h2>{firm.name}</h2>
                </div>
              </div>
              <p className="firm-card-notes">{firm.notes || "Sin notas guardadas."}</p>
              <dl className="firm-card-stats">
                <div>
                  <dt>Cuentas</dt>
                  <dd>{firmStats.total}</dd>
                </div>
                <div>
                  <dt>Activas</dt>
                  <dd>{firmStats.active}</dd>
                </div>
                <div>
                  <dt>Fondeadas</dt>
                  <dd>{firmStats.funded}</dd>
                </div>
              </dl>
              <div className="firm-card-progress-block">
                <div className="firm-card-progress-label">
                  <span>{firmStats.active} activas</span>
                  <span>{firmStats.inactive} cerradas/falladas</span>
                </div>
                <div className="firm-card-progress" aria-hidden="true">
                  <span style={{ width: `${activeShare}%` }} />
                </div>
              </div>
              <div className="firm-card-actions">
                <button
                  className="secondary-action"
                  disabled={!canWrite || mutating}
                  onClick={() => openEditFirm(firm)}
                  type="button"
                >
                  <Pencil size={16} strokeWidth={2.2} />
                  Editar
                </button>
                <button
                  className="danger-action"
                  disabled={deleteDisabled}
                  onClick={() => {
                    if (!window.confirm(`Eliminar ${firm.name}?`)) return;
                    void onDeleteFirm(firm.id);
                  }}
                  title={firmStats.total > 0 ? "Elimina o mueve las cuentas asociadas primero" : "Eliminar empresa"}
                  type="button"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                  Eliminar
                </button>
              </div>
            </article>
          );
        })}

        {filteredFirms.length === 0 && (
          <article className="empty-panel">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{firms.length ? "Sin resultados" : "No hay empresas todavía"}</strong>
            <span>{firms.length ? "Ajusta búsqueda o filtros." : "Crea la primera para empezar a migrar el flujo real."}</span>
          </article>
        )}
      </section>
    </div>
  );
}
