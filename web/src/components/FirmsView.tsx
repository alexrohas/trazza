import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Check, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { Modal } from "./Modal";
import { useT } from "../lib/i18n/context";
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

function getFirmTypeOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: FirmType }> {
  return [
    { label: t("firm.type.futures"), value: "futures" },
    { label: t("firm.type.forex"), value: "forex" },
    { label: t("firm.type.crypto"), value: "crypto" },
    { label: t("firm.type.other"), value: "other" },
  ];
}

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
  const t = useT();
  const firmTypeOptions = useMemo(() => getFirmTypeOptions(t), [t]);
  const firmTypeFilters = useMemo(() => [{ label: t("common.all"), value: "all" as const }, ...firmTypeOptions], [firmTypeOptions, t]);
  const firmTypeLabelByValue = useMemo(() => new Map(firmTypeOptions.map((option) => [option.value, option.label])), [firmTypeOptions]);
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
        title={editingFirm ? t("firm.modal.editTitle") : t("firm.modal.newTitle")}
        subtitle={canWrite ? t("firm.modal.subtitleWrite") : t("firm.modal.subtitleReadonly")}
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
            <span>{t("firm.field.name")}</span>
            <input
              disabled={!canWrite || mutating}
              minLength={2}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("firm.field.namePlaceholder")}
              required
              type="text"
              value={draft.name}
            />
          </label>

          <label>
            <span>{t("firm.field.type")}</span>
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
            <span>{t("firm.field.notes")}</span>
            <textarea
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder={t("firm.field.notesPlaceholder")}
              rows={3}
              value={draft.notes}
            />
          </label>

          {mutationError && <p className="mutation-message error">{mutationError}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeForm} type="button">
              {t("common.cancel")}
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? t("common.saving") : editingFirm ? t("common.saveChanges") : t("firm.modal.create")}
            </button>
          </div>
        </form>
      </Modal>
      )}

      <section className="panel firm-overview-panel">
        <div className="firm-overview-copy">
          <span className="section-kicker">{t("firm.overview.kicker")}</span>
          <h2>{t("firm.overview.title")}</h2>
          <p>{t("firm.overview.subtitle")}</p>
        </div>
        <div className="firm-overview-stats" aria-label={t("firm.overview.summaryLabel")}>
          <span>
            <Building2 size={18} strokeWidth={2.2} />
            <strong>{overviewStats.totalFirms}</strong>
            <small>{t("firm.overview.firms")}</small>
          </span>
          <span>
            <WalletCards size={18} strokeWidth={2.2} />
            <strong>{overviewStats.totalAccounts}</strong>
            <small>{t("firm.overview.accounts")}</small>
          </span>
          <span>
            <BadgeCheck size={18} strokeWidth={2.2} />
            <strong>{overviewStats.fundedAccounts}</strong>
            <small>{t("firm.overview.funded")}</small>
          </span>
          <span>
            <Check size={18} strokeWidth={2.2} />
            <strong>{overviewStats.activeAccounts}</strong>
            <small>{t("firm.overview.active")}</small>
          </span>
        </div>
      </section>

      <section className="panel firm-filter-panel">
        <div className="firm-filter-head">
          <div>
            <h2>{t("firm.filter.title")}</h2>
            <p>{t("firm.filter.subtitle")}</p>
          </div>
          <span className="result-count">
            {filteredFirms.length} {t("common.of")} {firms.length} {t("firm.filter.countSuffix")}
          </span>
        </div>
        <div className="firm-type-tabs" role="tablist" aria-label={t("firm.filter.tabsLabel")}>
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
              <p className="firm-card-notes">{firm.notes || t("firm.card.noNotes")}</p>
              <dl className="firm-card-stats">
                <div>
                  <dt>{t("firm.card.accounts")}</dt>
                  <dd>{firmStats.total}</dd>
                </div>
                <div>
                  <dt>{t("firm.card.active")}</dt>
                  <dd>{firmStats.active}</dd>
                </div>
                <div>
                  <dt>{t("firm.card.funded")}</dt>
                  <dd>{firmStats.funded}</dd>
                </div>
              </dl>
              <div className="firm-card-progress-block">
                <div className="firm-card-progress-label">
                  <span>{firmStats.active} {t("firm.card.activeSuffix")}</span>
                  <span>{firmStats.inactive} {t("firm.card.inactiveSuffix")}</span>
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
                  {t("common.edit")}
                </button>
                <button
                  className="danger-action"
                  disabled={deleteDisabled}
                  onClick={() => {
                    if (!window.confirm(`${t("common.deleteConfirmPrefix")} ${firm.name}?`)) return;
                    void onDeleteFirm(firm.id);
                  }}
                  title={firmStats.total > 0 ? t("firm.card.deleteTitleBlocked") : t("firm.card.deleteTitleAllowed")}
                  type="button"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                  {t("common.delete")}
                </button>
              </div>
            </article>
          );
        })}

        {filteredFirms.length === 0 && (
          <article className="empty-panel">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{firms.length ? t("common.noResults") : t("firm.empty.none")}</strong>
            <span>{firms.length ? t("common.adjustFilters") : t("firm.empty.createFirst")}</span>
          </article>
        )}
      </section>
    </div>
  );
}
