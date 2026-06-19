import { useEffect, useMemo, useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileDown,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  ImagePlus,
  ListChecks,
  Pencil,
  Percent,
  Plus,
  ShieldAlert,
  Target,
  Trash2,
  TrendingUp,
  ZoomIn,
  X,
} from "lucide-react";
import { MetricCard } from "./MetricCard";
import { Modal } from "./Modal";
import { buildAreaPath, buildSmoothPath } from "../lib/chartPath";
import {
  formatDisciplineScore,
  formatMoney,
  formatPercent,
  getAccountName,
  getDisciplineScale,
  signedTone,
} from "../lib/metrics";
import {
  getJournalErrorDefinition as getJournalErrorDefinitionFor,
  mergeJournalErrorTypes,
  normalizeHexColor,
  sanitizeErrorIds as sanitizeJournalErrorIds,
  severityRank,
} from "../lib/journalErrors";
import { matchesSearch } from "../lib/search";
import type {
  Currency,
  DataMode,
  Firm,
  JournalDirection,
  JournalEmotion,
  JournalEntry,
  JournalEntryInput,
  JournalErrorSeverity,
  JournalErrorType,
  JournalErrorTypeInput,
  JournalResult,
  JournalSessionType,
  JournalTradingSession,
  TradingAccount,
} from "../types";

type JournalEntriesViewProps = {
  accounts: TradingAccount[];
  currency: Currency;
  dataMode: DataMode;
  entries: JournalEntry[];
  firms: Firm[];
  initialMode?: "cockpit" | "entries";
  journalErrorTypes: JournalErrorType[];
  mutationError?: string | null;
  mutating?: boolean;
  newEntryToken?: number;
  searchQuery: string;
  selectedAccountId: string;
  onDeleteEntry: (entryId: string) => Promise<boolean>;
  onNewEntryRequestHandled?: () => void;
  onSaveEntry: (input: JournalEntryInput, entryId?: string) => Promise<boolean>;
  onSaveErrorType: (input: JournalErrorTypeInput, typeId?: string) => Promise<boolean>;
  onSetErrorTypeActive: (typeId: string, active: boolean) => Promise<boolean>;
};

type JournalAccountRule = {
  hint: string;
  icon: "target" | "drawdown";
  label: string;
  meter: number;
  status: string;
  tone: "positive" | "negative" | "neutral";
};

type JournalAccountOverview = {
  accountName: string;
  balance: number;
  base: number | null;
  baseLabel: string;
  firmName: string;
  netPnl: number;
  returnRatio: number | null;
  rules: JournalAccountRule[];
};

function createEmptyJournalInput(): JournalEntryInput {
  return {
    date: new Date().toISOString().slice(0, 10),
    firmId: "",
    accountId: "",
    symbol: "",
    direction: "long",
    tradingSession: "newYork",
    sessionType: "trading-day",
    result: "neutral",
    emotion: "focused",
    discipline: 3,
    pnl: 0,
    errors: [],
    operationUrl: "",
    notes: "",
    lesson: "",
  };
}

function createEmptyErrorTypeInput(): JournalErrorTypeInput {
  return {
    active: true,
    color: "#64748b",
    label: "",
    position: 1000,
  };
}

const directionOptions: Array<{ label: string; value: JournalDirection }> = [
  { label: "Long", value: "long" },
  { label: "Short", value: "short" },
  { label: "Sin direccion", value: "none" },
];
const sessionOptions: Array<{ label: string; value: JournalTradingSession }> = [
  { label: "Asia", value: "asia" },
  { label: "Londres", value: "london" },
  { label: "Nueva York", value: "newYork" },
  { label: "Londres + NY", value: "londonNewYork" },
  { label: "Otra", value: "other" },
];
const sessionTypeOptions: Array<{ label: string; value: JournalSessionType }> = [
  { label: "Trading", value: "trading-day" },
  { label: "Evaluacion", value: "evaluation" },
  { label: "Fondeada", value: "funded" },
  { label: "Payout day", value: "payout-day" },
  { label: "News day", value: "news-day" },
  { label: "Revision", value: "review" },
  { label: "Otro", value: "other" },
];
const resultOptions: Array<{ label: string; value: JournalResult }> = [
  { label: "Buen dia", value: "good" },
  { label: "Neutral", value: "neutral" },
  { label: "Mal dia", value: "bad" },
];
const emotionOptions: Array<{ label: string; value: JournalEmotion }> = [
  { label: "Calmado", value: "calm" },
  { label: "Enfocado", value: "focused" },
  { label: "Ansioso", value: "anxious" },
  { label: "Impaciente", value: "impatient" },
  { label: "FOMO", value: "fomo" },
  { label: "Revenge", value: "revenge" },
  { label: "Cansado", value: "tired" },
  { label: "Otro", value: "other" },
];

const weekdayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const errorColorOptions = ["#dc2626", "#f59e0b", "#7c3aed", "#0e8f8d", "#2563eb", "#64748b"];
const operationImageMaxSize = 1600;
const operationImageQuality = 0.82;

type LocalMessage = {
  text: string;
  type: "error" | "info" | "success";
};

type JournalDisciplineFilter = "all" | "high" | "low";
type JournalMediaFilter = "all" | "withMedia" | "withoutMedia";
type JournalPnlFilter = "all" | "winning" | "losing" | "breakeven";
type JournalReviewPreset = "all" | "today" | "week" | "month" | "losers" | "errors" | "needsReview";
type JournalSortMode = "date-desc" | "date-asc" | "pnl-desc" | "pnl-asc" | "discipline-desc" | "discipline-asc";

const reviewPresetOptions: Array<{ label: string; value: JournalReviewPreset }> = [
  { label: "Todas", value: "all" },
  { label: "Hoy", value: "today" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
  { label: "Perdedoras", value: "losers" },
  { label: "Con errores", value: "errors" },
  { label: "Pendientes", value: "needsReview" },
];

const pnlFilterOptions: Array<{ label: string; value: JournalPnlFilter }> = [
  { label: "Todo P&L", value: "all" },
  { label: "Ganadoras", value: "winning" },
  { label: "Perdedoras", value: "losing" },
  { label: "Break even", value: "breakeven" },
];

const disciplineFilterOptions: Array<{ label: string; value: JournalDisciplineFilter }> = [
  { label: "Toda disciplina", value: "all" },
  { label: "Alta", value: "high" },
  { label: "Baja", value: "low" },
];

const mediaFilterOptions: Array<{ label: string; value: JournalMediaFilter }> = [
  { label: "Con y sin captura", value: "all" },
  { label: "Con captura", value: "withMedia" },
  { label: "Sin captura", value: "withoutMedia" },
];

const sortModeOptions: Array<{ label: string; value: JournalSortMode }> = [
  { label: "Recientes primero", value: "date-desc" },
  { label: "Antiguas primero", value: "date-asc" },
  { label: "Mayor P&L", value: "pnl-desc" },
  { label: "Menor P&L", value: "pnl-asc" },
  { label: "Mayor disciplina", value: "discipline-desc" },
  { label: "Menor disciplina", value: "discipline-asc" },
];

export function JournalEntriesView({
  accounts,
  currency,
  dataMode,
  entries,
  firms,
  initialMode = "cockpit",
  journalErrorTypes,
  mutationError,
  mutating = false,
  newEntryToken = 0,
  searchQuery,
  selectedAccountId,
  onDeleteEntry,
  onNewEntryRequestHandled,
  onSaveErrorType,
  onSaveEntry,
  onSetErrorTypeActive,
}: JournalEntriesViewProps) {
  const operationFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<JournalEntryInput>(() => createEmptyJournalInput());
  const [disciplineFilter, setDisciplineFilter] = useState<JournalDisciplineFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | JournalDirection>("all");
  const [draggingOperationMedia, setDraggingOperationMedia] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [emotionFilter, setEmotionFilter] = useState<"all" | JournalEmotion>("all");
  const [errorFilter, setErrorFilter] = useState("all");
  const [errorTypeDraft, setErrorTypeDraft] = useState<JournalErrorTypeInput>(() => createEmptyErrorTypeInput());
  const [editingErrorTypeId, setEditingErrorTypeId] = useState<string | undefined>();
  const [fromFilter, setFromFilter] = useState("");
  const [importMessage, setImportMessage] = useState<LocalMessage | null>(null);
  const [importing, setImporting] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<JournalMediaFilter>("all");
  const [mediaMessage, setMediaMessage] = useState<LocalMessage | null>(null);
  const [pnlFilter, setPnlFilter] = useState<JournalPnlFilter>("all");
  const [journalMode, setJournalMode] = useState<"cockpit" | "entries" | "entryForm">(initialMode);
  const [resultFilter, setResultFilter] = useState<"all" | JournalResult>("all");
  const [reviewPreset, setReviewPreset] = useState<JournalReviewPreset>("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  const [sessionFilter, setSessionFilter] = useState<"all" | JournalTradingSession>("all");
  const [sortMode, setSortMode] = useState<JournalSortMode>("date-desc");
  const [toFilter, setToFilter] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [zoomImage, setZoomImage] = useState<string | undefined>();
  const canWrite = dataMode === "cloud";
  const effectiveErrorTypes = useMemo(() => mergeJournalErrorTypes(journalErrorTypes), [journalErrorTypes]);
  const cloudErrorTypeIds = useMemo(() => new Set(journalErrorTypes.map((type) => type.id)), [journalErrorTypes]);
  const activeErrorTypes = useMemo(
    () => effectiveErrorTypes.filter((type) => type.active || draft.errors.includes(type.id) || errorFilter === type.id),
    [draft.errors, effectiveErrorTypes, errorFilter],
  );
  const errorUsageById = useMemo(() => {
    const usage = new Map<string, number>();
    entries.forEach((entry) => {
      getEntryErrors(entry, effectiveErrorTypes).forEach((error) => {
        usage.set(error, (usage.get(error) || 0) + 1);
      });
    });
    return usage;
  }, [effectiveErrorTypes, entries]);
  const firmNameById = useMemo(() => new Map(firms.map((firm) => [firm.id, firm.name])), [firms]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const reviewPresetRange = useMemo(() => getReviewPresetDateRange(reviewPreset), [reviewPreset]);
  const accountOverview = useMemo(
    () =>
      buildJournalAccountOverview({
        account: selectedAccountId === "all" ? undefined : accountById.get(selectedAccountId),
        currency,
        entries,
        firmNameById,
      }),
    [accountById, currency, entries, firmNameById, selectedAccountId],
  );
  const accountsForFirm = useMemo(
    () => (draft.firmId ? accounts.filter((account) => account.firmId === draft.firmId) : accounts),
    [accounts, draft.firmId],
  );
  const filteredEntries = useMemo(
    () => {
      const rows = entries.filter((entry) => {
        const account = accountById.get(entry.accountId);
        const firmName = firmNameById.get(entry.firmId || "") || firmNameById.get(account?.firmId || "");
        const entrySession = getEntryTradingSession(entry);
        const entryErrors = getEntryErrors(entry, effectiveErrorTypes);
        const entryPnl = toFiniteNumber(entry.pnl) ?? 0;
        const hasMedia = Boolean(entry.operationUrl?.trim());
        if (!matchesReviewPreset(entry, reviewPreset, entryErrors, reviewPresetRange)) return false;
        if (directionFilter !== "all" && entry.direction !== directionFilter) return false;
        if (emotionFilter !== "all" && entry.emotion !== emotionFilter) return false;
        if (errorFilter !== "all" && !entryErrors.includes(errorFilter)) return false;
        if (pnlFilter === "winning" && entryPnl <= 0) return false;
        if (pnlFilter === "losing" && entryPnl >= 0) return false;
        if (pnlFilter === "breakeven" && entryPnl !== 0) return false;
        if (disciplineFilter === "high" && entry.discipline < 4) return false;
        if (disciplineFilter === "low" && entry.discipline > 2) return false;
        if (mediaFilter === "withMedia" && !hasMedia) return false;
        if (mediaFilter === "withoutMedia" && hasMedia) return false;
        if (resultFilter !== "all" && (entry.result || "neutral") !== resultFilter) return false;
        if (sessionFilter !== "all" && entrySession !== sessionFilter) return false;
        if (fromFilter && entry.date < fromFilter) return false;
        if (toFilter && entry.date > toFilter) return false;
        return matchesSearch(searchQuery, [
          entry.date,
          entry.symbol,
          entry.direction,
          findOptionLabel(directionOptions, entry.direction),
          findOptionLabel(resultOptions, entry.result || "neutral"),
          findOptionLabel(emotionOptions, entry.emotion),
          formatTradingSessionLabel(entry),
          entryErrors.map((error) => getJournalErrorLabel(effectiveErrorTypes, error)).join(" "),
          entry.pnl,
          entry.operationUrl,
          entry.notes,
          entry.lesson,
          firmName,
          account?.name,
        ]);
      });

      return rows.sort((left, right) => compareJournalEntries(left, right, sortMode));
    },
    [
      accountById,
      disciplineFilter,
      directionFilter,
      emotionFilter,
      entries,
      errorFilter,
      effectiveErrorTypes,
      firmNameById,
      fromFilter,
      mediaFilter,
      pnlFilter,
      resultFilter,
      reviewPreset,
      reviewPresetRange,
      searchQuery,
      sessionFilter,
      sortMode,
      toFilter,
    ],
  );
  const selectedEntry = selectedEntryId ? filteredEntries.find((entry) => entry.id === selectedEntryId) : undefined;
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth, filteredEntries), [filteredEntries, visibleMonth]);
  const selectedDayEntries = useMemo(
    () => (selectedEntry ? filteredEntries.filter((entry) => entry.date === selectedEntry.date) : []),
    [filteredEntries, selectedEntry],
  );
  const analytics = useMemo(() => buildJournalAnalytics(filteredEntries, effectiveErrorTypes), [effectiveErrorTypes, filteredEntries]);
  const reviewSummary = useMemo(() => buildJournalReviewSummary(filteredEntries), [filteredEntries]);
  const visibleMonthLabel = useMemo(() => formatMonthLabel(visibleMonth), [visibleMonth]);

  const resetForm = () => {
    setDraft(createEmptyJournalInput());
    setEditingId(undefined);
    setDraggingOperationMedia(false);
    setMediaMessage(null);
  };

  const closeEntryForm = () => {
    resetForm();
    setJournalMode(initialMode);
  };

  useEffect(() => {
    setJournalMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!newEntryToken) return;
    resetForm();
    setJournalMode("entryForm");
    onNewEntryRequestHandled?.();
  }, [newEntryToken, onNewEntryRequestHandled]);

  const resetJournalFilters = () => {
    setDisciplineFilter("all");
    setDirectionFilter("all");
    setEmotionFilter("all");
    setErrorFilter("all");
    setFromFilter("");
    setMediaFilter("all");
    setPnlFilter("all");
    setResultFilter("all");
    setReviewPreset("all");
    setSessionFilter("all");
    setSortMode("date-desc");
    setToFilter("");
  };

  const handleExportFilteredCsv = () => {
    if (!filteredEntries.length) return;
    downloadJournalCsv({
      accountById,
      entries: filteredEntries,
      errorTypes: effectiveErrorTypes,
      firmNameById,
    });
  };

  const handleCsvImport = async (file: File) => {
    if (!canWrite) return;
    setImportMessage({ type: "info", text: "Importando CSV..." });

    try {
      const result = await importCsv(file, effectiveErrorTypes, onSaveEntry, setImporting);
      const importedText = `${result.imported} de ${result.total} filas importadas`;
      if (result.failed > 0 || result.skipped > 0) {
        setImportMessage({
          type: "error",
          text: `${importedText}. Fallidas: ${result.failed}. Omitidas: ${result.skipped}.`,
        });
        return;
      }
      setImportMessage({ type: "success", text: importedText });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo importar el CSV.";
      setImportMessage({ type: "error", text: message });
    }
  };

  const setOperationMediaFromFile = async (file?: File) => {
    if (!canWrite || !file) return;
    setMediaMessage({ type: "info", text: "Procesando captura..." });

    try {
      const dataUrl = await compressOperationImage(file);
      setDraft((current) => ({ ...current, operationUrl: dataUrl }));
      setMediaMessage({ type: "success", text: "Captura cargada y comprimida." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la captura.";
      setMediaMessage({ type: "error", text: message });
    }
  };

  const handleOperationPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = getImageFileFromList(event.clipboardData.files);
    if (!file) return;
    event.preventDefault();
    void setOperationMediaFromFile(file);
  };

  const handleOperationDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOperationMedia(false);
    const file = getImageFileFromList(event.dataTransfer.files);
    if (!file) {
      setMediaMessage({ type: "error", text: "Arrastra una imagen valida." });
      return;
    }
    void setOperationMediaFromFile(file);
  };

  const resetErrorTypeForm = () => {
    setErrorTypeDraft(createEmptyErrorTypeInput());
    setEditingErrorTypeId(undefined);
  };

  const handleToggleErrorType = async (type: JournalErrorType) => {
    const nextInput = {
      active: !type.active,
      color: type.color,
      label: type.label,
      position: type.position,
    };
    const saved = cloudErrorTypeIds.has(type.id)
      ? await onSetErrorTypeActive(type.id, !type.active)
      : await onSaveErrorType(nextInput, type.id);
    if (saved && editingErrorTypeId === type.id) resetErrorTypeForm();
  };

  return (
    <div className="firms-workspace">
      {journalMode !== "cockpit" && (
      <section className="panel view-filter-panel">
        <div className="journal-review-toolbar">
          <div>
            <h2>Entradas</h2>
            <p>Galeria de operaciones, filtros y configuracion de errores.</p>
          </div>
          <div className="journal-review-actions">
            <button
              className="secondary-action"
              data-testid="journal-export-csv"
              disabled={!filteredEntries.length}
              onClick={handleExportFilteredCsv}
              type="button"
            >
              <FileDown size={16} strokeWidth={2.2} />
              Export CSV
            </button>
            <span className="result-count">
              {filteredEntries.length} de {entries.length} entradas
          </span>
          </div>
        </div>
        <div className="view-filters">
          <label>
            <span>Resultado</span>
            <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as "all" | JournalResult)}>
              <option value="all">Todos</option>
              {resultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Emocion</span>
            <select value={emotionFilter} onChange={(event) => setEmotionFilter(event.target.value as "all" | JournalEmotion)}>
              <option value="all">Todas</option>
              {emotionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Error</span>
            <select value={errorFilter} onChange={(event) => setErrorFilter(event.target.value)}>
              <option value="all">Todos</option>
              {effectiveErrorTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.active ? type.label : `${type.label} (oculto)`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sesion</span>
            <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as "all" | JournalTradingSession)}>
              <option value="all">Todas</option>
              {sessionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Direccion</span>
            <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as "all" | JournalDirection)}>
              <option value="all">Todas</option>
              {directionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>P&L</span>
            <select value={pnlFilter} onChange={(event) => setPnlFilter(event.target.value as JournalPnlFilter)}>
              {pnlFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Disciplina</span>
            <select value={disciplineFilter} onChange={(event) => setDisciplineFilter(event.target.value as JournalDisciplineFilter)}>
              {disciplineFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Captura</span>
            <select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as JournalMediaFilter)}>
              {mediaFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Orden</span>
            <select data-testid="journal-sort-mode" value={sortMode} onChange={(event) => setSortMode(event.target.value as JournalSortMode)}>
              {sortModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
          <button className="secondary-action" onClick={resetJournalFilters} type="button">
            Reset filtros
          </button>
        </div>
        <div className="journal-review-summary" aria-label="Resumen del subconjunto filtrado">
          <span>
            Subconjunto
            <strong>{filteredEntries.length}</strong>
          </span>
          <span>
            Neto
            <strong className={signedTone(analytics.stats.netPnl)}>{formatMoney(analytics.stats.netPnl, currency)}</strong>
          </span>
          <span>
            Media trade
            <strong className={signedTone(reviewSummary.averagePnl)}>{formatMoney(reviewSummary.averagePnl, currency)}</strong>
          </span>
          <span>
            Mejor trade
            <strong className={signedTone(reviewSummary.bestPnl ?? 0)}>
              {reviewSummary.bestPnl === null ? "-" : formatMoney(reviewSummary.bestPnl, currency)}
            </strong>
          </span>
          <span>
            Peor trade
            <strong className={signedTone(reviewSummary.worstPnl ?? 0)}>
              {reviewSummary.worstPnl === null ? "-" : formatMoney(reviewSummary.worstPnl, currency)}
            </strong>
          </span>
          <span>
            Capturas
            <strong>{reviewSummary.withMedia}</strong>
          </span>
          <span>
            Pendientes
            <strong>{reviewSummary.needsReview}</strong>
          </span>
        </div>
      </section>
      )}

      {journalMode === "cockpit" &&
        accountOverview && (
          <JournalAccountOverviewPanel overview={accountOverview} currency={currency} />
        )}

      {journalMode === "cockpit" && (
      <section className="metric-grid journal-kpi-grid" aria-label="Metricas del journal filtrado">
        <MetricCard
          hint={`${analytics.stats.wins}W / ${analytics.stats.losses}L / ${analytics.stats.breakEven} BE`}
          icon={<Percent size={16} strokeWidth={2.2} />}
          label="Winrate"
          tone={analytics.stats.winRate === null ? "neutral" : analytics.stats.winRate >= 0.5 ? "positive" : "negative"}
          value={formatRatioPercent(analytics.stats.winRate)}
        />
        <MetricCard
          hint={`Avg W ${formatNullableMoney(analytics.stats.avgWin, currency)} / Avg L ${formatNullableMoney(
            analytics.stats.avgLoss,
            currency,
          )}`}
          icon={<Gauge size={16} strokeWidth={2.2} />}
          label="Profit factor"
          tone={profitFactorTone(analytics.stats.profitFactor)}
          value={formatProfitFactor(analytics.stats.profitFactor)}
        />
        <MetricCard
          hint={`${analytics.stats.closed} trades cerrados`}
          icon={<TrendingUp size={16} strokeWidth={2.2} />}
          label="Avg win / loss"
          tone="neutral"
          value={`${formatNullableMoney(analytics.stats.avgWin, currency)} / ${formatNullableMoney(analytics.stats.avgLoss, currency)}`}
        />
      </section>
      )}

      {journalMode === "cockpit" && (
        <section className="journal-cockpit-grid" aria-label="Resumen visual del journal">
          <JournalPnlCurvePanel entries={filteredEntries} currency={currency} />
          <JournalRecentTradesPanel
            accounts={accounts}
            accountById={accountById}
            currency={currency}
            entries={filteredEntries.slice(0, 5)}
            errorTypes={effectiveErrorTypes}
            firmNameById={firmNameById}
            onSelectEntry={setSelectedEntryId}
          />
        </section>
      )}

      {journalMode === "cockpit" && (
      <section className="journal-analytics-grid" aria-label="Breakdowns del journal filtrado">
        <JournalBreakdownPanel
          emptyText="Sin sesiones registradas."
          rows={analytics.sessionRows.map((row) => ({
            id: row.id,
            detail: `${row.wins}W / ${row.losses}L / ${row.breakEven} BE`,
            label: row.label,
            meter: winRateMeter(row.winRate),
            note: `${row.count} entradas - ${formatMoney(row.pnl, currency)}`,
            tone: row.winRate === null ? "neutral" : row.winRate >= 0.5 ? "positive" : "negative",
            value: formatRatioPercent(row.winRate),
          }))}
          subtitle="Winrate y P&L por franja operativa."
          title="Winrate por sesion"
        />
        <JournalBreakdownPanel
          emptyText="Sin emociones registradas."
          rows={analytics.emotionRows.map((row) => ({
            id: row.id,
            detail: `${row.count} entradas - ${formatRatioPercent(row.winRate)}`,
            label: row.label,
            meter: shareMeter(row.count, analytics.maxEmotionCount),
            note: `Avg ${formatMoney(row.averagePnl, currency)}`,
            tone: signedTone(row.pnl),
            value: formatMoney(row.pnl, currency),
          }))}
          subtitle="Peso, resultado y media por estado mental."
          title="Emocion y resultado"
        />
        <JournalBreakdownPanel
          emptyText="Sin errores registrados."
          rows={analytics.errorRows.map((row) => ({
            color: row.color,
            id: row.id,
            detail: `${row.count} ${row.count === 1 ? "entrada" : "entradas"}`,
            label: row.label,
            meter: shareMeter(row.count, analytics.maxErrorCount),
            note: `${formatPercent(row.share)} del total marcado`,
            tone: row.severity === "severe" ? "negative" : "neutral",
            value: String(row.count),
          }))}
          subtitle="Frecuencia de fallos marcados en las entradas."
          title="Errores de ejecucion"
        />
        <JournalWeekdayPanel rows={analytics.weekdayRows} currency={currency} />
      </section>
      )}

      {journalMode === "entries" && (
      <section className="panel journal-error-manager-panel">
        <div className="panel-heading">
          <div>
            <h2>Tipos de error</h2>
            <p>Personaliza los fallos que marcas en cada entrada.</p>
          </div>
        </div>
        <div className="journal-error-manager-grid">
          <form
            className="journal-error-type-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const label = errorTypeDraft.label.trim();
              if (label.length < 2) return;
              const fallbackPosition = Math.max(0, ...effectiveErrorTypes.map((type) => type.position)) + 10;
              const saved = await onSaveErrorType(
                {
                  active: errorTypeDraft.active ?? true,
                  color: normalizeHexColor(errorTypeDraft.color) || "#64748b",
                  label,
                  position: Number.isFinite(errorTypeDraft.position) ? errorTypeDraft.position : fallbackPosition,
                },
                editingErrorTypeId,
              );
              if (saved) resetErrorTypeForm();
            }}
          >
            <label>
              <span>Nombre</span>
              <input
                disabled={!canWrite || mutating}
                maxLength={34}
                onChange={(event) => setErrorTypeDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder="Ej. Overtrade"
                type="text"
                value={errorTypeDraft.label}
              />
            </label>
            <div className="journal-error-color-field">
              <span>Color</span>
              <div className="journal-error-color-options">
                {errorColorOptions.map((color) => (
                  <button
                    aria-label={`Color ${color}`}
                    className={normalizeHexColor(errorTypeDraft.color) === color ? "active" : ""}
                    disabled={!canWrite || mutating}
                    key={color}
                    onClick={() => setErrorTypeDraft((current) => ({ ...current, color }))}
                    style={{ "--error-color": color } as CSSProperties}
                    type="button"
                  />
                ))}
                <input
                  aria-label="Color personalizado"
                  disabled={!canWrite || mutating}
                  onChange={(event) => setErrorTypeDraft((current) => ({ ...current, color: event.target.value }))}
                  type="color"
                  value={normalizeHexColor(errorTypeDraft.color) || "#64748b"}
                />
              </div>
            </div>
            <button className="primary-action" disabled={!canWrite || mutating || errorTypeDraft.label.trim().length < 2} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {editingErrorTypeId ? "Guardar error" : "Crear error"}
            </button>
            {editingErrorTypeId && (
              <button className="ghost-action" disabled={mutating} onClick={resetErrorTypeForm} type="button">
                <X size={16} strokeWidth={2.2} />
                Cancelar
              </button>
            )}
          </form>
          <div className="journal-error-type-list">
            {effectiveErrorTypes.map((type) => {
              const usage = errorUsageById.get(type.id) || 0;
              return (
                <article className={`journal-error-type-row ${type.active ? "" : "is-archived"}`} key={type.id}>
                  <i aria-hidden="true" style={{ "--error-color": type.color } as CSSProperties} />
                  <div>
                    <strong>{type.label}</strong>
                    <span>
                      {usage} {usage === 1 ? "entrada" : "entradas"}
                      {!type.active ? " - oculto" : ""}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="secondary-action"
                      disabled={!canWrite || mutating}
                      onClick={() => {
                        setEditingErrorTypeId(type.id);
                        setErrorTypeDraft({
                          active: type.active,
                          color: type.color,
                          label: type.label,
                          position: type.position,
                        });
                      }}
                      type="button"
                    >
                      <Pencil size={16} strokeWidth={2.2} />
                      Editar
                    </button>
                    <button
                      className="secondary-action"
                      disabled={!canWrite || mutating}
                      onClick={() => void handleToggleErrorType(type)}
                      type="button"
                    >
                      {type.active ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
                      {type.active ? "Ocultar" : "Restaurar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {journalMode === "cockpit" && (
      <section className="journal-top-grid">
        <section className="panel journal-calendar-panel">
          <div className="panel-heading">
            <div>
              <h2>Calendario</h2>
              <p>{visibleMonthLabel} - P&L diario del journal.</p>
            </div>
            <div className="calendar-actions">
              <button className="icon-control compact-icon" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))} title="Mes anterior" type="button">
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>
              <input
                className="month-input"
                type="month"
                value={visibleMonth}
                onChange={(event) => {
                  if (event.target.value) setVisibleMonth(event.target.value);
                }}
              />
              <button className="icon-control compact-icon" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))} title="Mes siguiente" type="button">
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
              <button className="secondary-action" onClick={() => setVisibleMonth(new Date().toISOString().slice(0, 7))} type="button">
                Hoy
              </button>
            </div>
          </div>
          <div className="journal-calendar-grid">
            {weekdayLabels.map((day) => (
              <span className="journal-weekday" key={day}>
                {day}
              </span>
            ))}
            {calendarDays.map((day) => (
              <button
                aria-label={`${day.date}: ${day.count} entradas`}
                className={`journal-day ${day.inMonth ? "" : "muted"} ${day.firstEntryId ? "has-entries" : ""} ${selectedEntry?.date === day.date ? "selected" : ""} ${signedTone(day.pnl)}`}
                disabled={!day.firstEntryId}
                key={day.date}
                onClick={() => setSelectedEntryId(day.firstEntryId)}
                type="button"
              >
                <span>{Number(day.date.slice(-2))}</span>
                <strong>{day.count ? formatMoney(day.pnl, currency) : "-"}</strong>
                <small>{day.count ? `${day.count} ops` : ""}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel journal-detail-panel">
          <div className="panel-heading">
            <div>
              <h2>Detalle</h2>
              <p>{selectedEntry ? `${selectedEntry.symbol} - ${selectedEntry.date}` : "Selecciona una entrada."}</p>
            </div>
            {selectedEntry && (
              <button className="icon-control compact-icon" onClick={() => setSelectedEntryId(undefined)} title="Cerrar detalle" type="button">
                <X size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>
          {selectedEntry ? (
            <div className="journal-detail-card">
              <div className="journal-detail-hero">
                <div>
                  <span>{selectedEntry.symbol}</span>
                  <strong>{selectedEntry.date}</strong>
                </div>
                <strong className={signedTone(selectedEntry.pnl)}>{formatMoney(selectedEntry.pnl, currency)}</strong>
              </div>
              <dl className="journal-detail-grid">
                <div>
                  <dt>Empresa</dt>
                  <dd>
                    {firmNameById.get(selectedEntry.firmId || "") ||
                      firmNameById.get(accountById.get(selectedEntry.accountId)?.firmId || "") ||
                      "Sin empresa"}
                  </dd>
                </div>
                <div>
                  <dt>Cuenta</dt>
                  <dd>{getAccountName(accounts, selectedEntry.accountId)}</dd>
                </div>
                <div>
                  <dt>Direccion</dt>
                  <dd>{findOptionLabel(directionOptions, selectedEntry.direction)}</dd>
                </div>
                <div>
                  <dt>Sesion</dt>
                  <dd>{formatTradingSessionLabel(selectedEntry)}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{findOptionLabel(sessionTypeOptions, selectedEntry.sessionType || "other")}</dd>
                </div>
                <div>
                  <dt>Resultado</dt>
                  <dd>{findOptionLabel(resultOptions, selectedEntry.result || "neutral")}</dd>
                </div>
                <div>
                  <dt>Disciplina</dt>
                  <dd>{formatDisciplineScore(selectedEntry.discipline)}</dd>
                </div>
                <div>
                  <dt>Emocion</dt>
                  <dd>{findOptionLabel(emotionOptions, selectedEntry.emotion)}</dd>
                </div>
              </dl>
              <div className="journal-detail-copy">
                <span>Errores</span>
              <JournalErrorChips errorTypes={effectiveErrorTypes} errors={getEntryErrors(selectedEntry, effectiveErrorTypes)} />
              </div>
              <div className="journal-detail-copy">
                <span>Notas</span>
                <p>{selectedEntry.notes || "Sin notas."}</p>
              </div>
              <div className="journal-detail-copy">
                <span>Aprendizaje</span>
                <p>{selectedEntry.lesson || "Sin aprendizaje registrado."}</p>
              </div>
              {selectedEntry.operationUrl && (
                <div className="journal-detail-copy">
                  <span>Captura / link</span>
                  {isImageSource(selectedEntry.operationUrl) ? (
                    <button
                      className="journal-media-preview-button"
                      onClick={() => setZoomImage(selectedEntry.operationUrl)}
                      type="button"
                    >
                      <img className="journal-media-preview" src={selectedEntry.operationUrl} alt={`Captura de ${selectedEntry.symbol}`} />
                      <span>
                        <ZoomIn size={15} strokeWidth={2.2} />
                        Ampliar captura
                      </span>
                    </button>
                  ) : (
                    <a className="journal-media-link" href={selectedEntry.operationUrl} rel="noreferrer" target="_blank">
                      <ExternalLink size={15} strokeWidth={2.2} />
                      Abrir referencia
                    </a>
                  )}
                </div>
              )}
              {selectedDayEntries.length > 1 && (
                <div className="journal-same-day">
                  <span>Otras entradas del dia</span>
                  <div>
                    {selectedDayEntries.map((entry) => (
                      <button
                        className={entry.id === selectedEntry.id ? "active" : ""}
                        key={entry.id}
                        onClick={() => setSelectedEntryId(entry.id)}
                        type="button"
                      >
                        {entry.symbol}
                        <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="chart-empty">Sin entrada seleccionada</div>
          )}
        </section>
      </section>
      )}

      {journalMode === "entryForm" && (
      <Modal
        onClose={closeEntryForm}
        title={editingId ? "Editar entrada" : "Nueva entrada"}
        subtitle="Registra la operacion con contexto, captura, errores y notas sin salir de la galeria."
        width="wide"
      >
          <div className="modal-inline-actions">
            <label
              aria-disabled={!canWrite || mutating || importing}
              className={`ghost-action file-action ${!canWrite || mutating || importing ? "disabled" : ""}`}
            >
              <FileUp size={16} strokeWidth={2.2} />
              {importing ? "Importando..." : "Import CSV"}
              <input
                accept=".csv,text/csv"
                disabled={!canWrite || mutating || importing}
                hidden
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleCsvImport(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

        <form
          className="entity-form resource-form-grid modal-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSaveEntry(draft, editingId);
            if (saved) closeEntryForm();
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
            <span>Empresa</span>
            <select
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, firmId: event.target.value, accountId: "" }))}
              value={draft.firmId || ""}
            >
              <option value="">Sin empresa</option>
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
          <label>
            <span>Activo</span>
            <input
              disabled={!canWrite || mutating}
              maxLength={20}
              onChange={(event) => setDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
              placeholder="NQ, ES, MNQ..."
              required
              type="text"
              value={draft.symbol}
            />
          </label>
          <SelectField
            disabled={!canWrite || mutating}
            label="Direccion"
            onChange={(value) => setDraft((current) => ({ ...current, direction: value as JournalDirection }))}
            options={directionOptions}
            value={draft.direction}
          />
          <SelectField
            disabled={!canWrite || mutating}
            label="Sesion"
            onChange={(value) => setDraft((current) => ({ ...current, tradingSession: value as JournalTradingSession }))}
            options={sessionOptions}
            value={draft.tradingSession}
          />
          <SelectField
            disabled={!canWrite || mutating}
            label="Tipo"
            onChange={(value) => setDraft((current) => ({ ...current, sessionType: value as JournalSessionType }))}
            options={sessionTypeOptions}
            value={draft.sessionType}
          />
          <SelectField
            disabled={!canWrite || mutating}
            label="Resultado"
            onChange={(value) => setDraft((current) => ({ ...current, result: value as JournalResult }))}
            options={resultOptions}
            value={draft.result}
          />
          <SelectField
            disabled={!canWrite || mutating}
            label="Emocion"
            onChange={(value) => setDraft((current) => ({ ...current, emotion: value as JournalEmotion }))}
            options={emotionOptions}
            value={draft.emotion}
          />
          <label>
            <span>Disciplina</span>
            <input
              disabled={!canWrite || mutating}
              max={5}
              min={1}
              onChange={(event) => setDraft((current) => ({ ...current, discipline: Number(event.target.value) }))}
              required
              type="number"
              value={draft.discipline}
            />
          </label>
          <label>
            <span>P&L</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, pnl: Number(event.target.value) }))}
              step="0.01"
              type="number"
              value={draft.pnl}
            />
          </label>
          <div className="wide-field journal-error-picker">
            <span>Errores</span>
            <div className="journal-error-options">
              {activeErrorTypes.map((type) => {
                const selected = draft.errors.includes(type.id);
                return (
                  <label className={selected ? "is-selected" : ""} key={type.id} style={{ "--error-color": type.color } as CSSProperties}>
                    <input
                      checked={selected}
                      disabled={!canWrite || mutating}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          errors: toggleString(current.errors, type.id),
                        }))
                      }
                      type="checkbox"
                    />
                    <i aria-hidden="true" />
                    <span>{type.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="wide-field journal-operation-media-field">
            <div className="journal-operation-media-toolbar">
              <span>Captura de la operacion</span>
              {draft.operationUrl && (
                <button
                  className="ghost-action compact-action"
                  disabled={!canWrite || mutating}
                  onClick={() => {
                    setDraft((current) => ({ ...current, operationUrl: "" }));
                    setMediaMessage(null);
                  }}
                  type="button"
                >
                  <X size={15} strokeWidth={2.2} />
                  Quitar
                </button>
              )}
            </div>
            <input
              accept="image/*"
              disabled={!canWrite || mutating}
              hidden
              onChange={(event) => {
                const file = getImageFileFromList(event.target.files);
                event.target.value = "";
                void setOperationMediaFromFile(file);
              }}
              ref={operationFileInputRef}
              type="file"
            />
            <div
              className={`journal-operation-dropzone ${draggingOperationMedia ? "is-dragging" : ""} ${!canWrite || mutating ? "is-disabled" : ""}`}
              onClick={() => {
                if (canWrite && !mutating) operationFileInputRef.current?.click();
              }}
              onDragLeave={() => setDraggingOperationMedia(false)}
              onDragOver={(event) => {
                event.preventDefault();
                if (canWrite && !mutating) setDraggingOperationMedia(true);
              }}
              onDrop={handleOperationDrop}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && canWrite && !mutating) {
                  event.preventDefault();
                  operationFileInputRef.current?.click();
                }
              }}
              onPaste={handleOperationPaste}
              role="button"
              tabIndex={canWrite && !mutating ? 0 : -1}
            >
              {isImageSource(draft.operationUrl || "") ? (
                <div className="journal-operation-preview">
                  <img src={draft.operationUrl} alt="Captura de la operacion" />
                  <span>
                    <ZoomIn size={15} strokeWidth={2.2} />
                    Click para reemplazar
                  </span>
                </div>
              ) : (
                <div className="journal-operation-empty">
                  {draft.operationUrl ? <ExternalLink size={22} strokeWidth={2.2} /> : <ImagePlus size={24} strokeWidth={2.2} />}
                  <span>{draft.operationUrl ? "Enlace de operacion guardado." : "Pega una imagen, arrastrala aqui o haz clic para subirla."}</span>
                </div>
              )}
            </div>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => {
                setDraft((current) => ({ ...current, operationUrl: event.target.value }));
                setMediaMessage(null);
              }}
              placeholder="O pega una URL de imagen / referencia"
              type="text"
              value={draft.operationUrl || ""}
            />
            {mediaMessage && <p className={`mutation-message ${mediaMessage.type}`}>{mediaMessage.text}</p>}
          </div>
          <label className="wide-field">
            <span>Notas</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Que paso y como gestionaste el trade"
              type="text"
              value={draft.notes || ""}
            />
          </label>
          <label className="wide-field">
            <span>Aprendizaje</span>
            <input
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, lesson: event.target.value }))}
              placeholder="Que repetir o evitar"
              type="text"
              value={draft.lesson || ""}
            />
          </label>

          {mutationError && <p className="mutation-message error">{mutationError}</p>}
          {importMessage && <p className={`mutation-message ${importMessage.type}`}>{importMessage.text}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeEntryForm} type="button">
              Cancelar
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? "Guardando..." : editingId ? "Guardar cambios" : "Crear entrada"}
            </button>
          </div>
        </form>
      </Modal>
      )}

      {(journalMode === "entries" || journalMode === "entryForm") && (
      <>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Entradas de journal</h2>
            <p>Lista ordenable segun la revision activa.</p>
          </div>
        </div>
        <div className="journal-list">
          {filteredEntries.map((entry) => (
            <article className="journal-row editable-journal-row" key={entry.id}>
              <div>
                <div className="journal-row-topline">
                  <strong>{entry.symbol}</strong>
                  <span>{entry.direction}</span>
                </div>
                <small>
                  {entry.date} - {getEntryFirmName(entry, accountById, firmNameById)} - {getAccountName(accounts, entry.accountId)}
                </small>
                <p>{entry.notes || entry.lesson || "Sin notas."}</p>
                <JournalErrorChips compact errorTypes={effectiveErrorTypes} errors={getEntryErrors(entry, effectiveErrorTypes)} />
              </div>
              <div className="journal-score">
                <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
                <span>Disc. {formatDisciplineScore(entry.discipline)}</span>
                {entry.operationUrl && <span>Referencia</span>}
              </div>
              <div className="row-actions">
                <button
                  className="secondary-action"
                  onClick={() => {
                    setSelectedEntryId(entry.id);
                    setJournalMode("cockpit");
                  }}
                  type="button"
                >
                  <Eye size={16} strokeWidth={2.2} />
                  Detalle
                </button>
                <button
                  className="secondary-action"
                  disabled={!canWrite || mutating}
                  onClick={() => {
                    setEditingId(entry.id);
                    setDraft({
                      date: entry.date,
                      firmId: entry.firmId || "",
                      accountId: entry.accountId || "",
                      symbol: entry.symbol,
                      direction: entry.direction,
                      tradingSession: getEntryTradingSession(entry) || "newYork",
                      sessionType: entry.sessionType || "trading-day",
                      result: entry.result || "neutral",
                      emotion: entry.emotion,
                      discipline: entry.discipline || 3,
                      pnl: entry.pnl,
                      errors: getEntryErrors(entry, effectiveErrorTypes),
                      operationUrl: entry.operationUrl || "",
                      notes: entry.notes || "",
                      lesson: entry.lesson || "",
                    });
                    setJournalMode("entryForm");
                  }}
                  type="button"
                >
                  <Pencil size={16} strokeWidth={2.2} />
                  Editar
                </button>
                <button
                  className="danger-action"
                  disabled={!canWrite || mutating}
                  onClick={() => {
                    if (!window.confirm("Eliminar entrada de journal?")) return;
                    void onDeleteEntry(entry.id);
                  }}
                  type="button"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
        {filteredEntries.length === 0 && (
          <article className="empty-panel inline-empty">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{entries.length ? "Sin resultados" : "No hay entradas todavia"}</strong>
            <span>{entries.length ? "Ajusta busqueda o filtros." : "Crea la primera desde el formulario superior."}</span>
          </article>
        )}
      </section>
      </>
      )}

      {zoomImage && (
        <div className="journal-image-zoom-overlay" role="dialog" aria-modal="true" aria-label="Captura ampliada">
          <button className="journal-image-zoom-backdrop" onClick={() => setZoomImage(undefined)} type="button" />
          <div className="journal-image-zoom-card">
            <button className="icon-control compact-icon journal-image-zoom-close" onClick={() => setZoomImage(undefined)} type="button">
              <X size={18} strokeWidth={2.2} />
            </button>
            <img src={zoomImage} alt="Captura ampliada de la operacion" />
          </div>
        </div>
      )}
    </div>
  );
}

type CalendarDay = {
  count: number;
  date: string;
  firstEntryId?: string;
  inMonth: boolean;
  pnl: number;
};

type Tone = "positive" | "negative" | "neutral";

type JournalSummary = {
  averagePnl: number;
  breakEven: number;
  closed: number;
  count: number;
  losses: number;
  pnl: number;
  winRate: number | null;
  wins: number;
};

type JournalStats = JournalSummary & {
  avgDiscipline: number | null;
  avgLoss: number | null;
  avgWin: number | null;
  disciplineScale: number;
  grossLoss: number;
  grossProfit: number;
  netPnl: number;
  profitFactor: number | null;
};

type JournalSummaryRow = JournalSummary & {
  id: string;
  label: string;
};

type JournalErrorRow = {
  color: string;
  count: number;
  id: string;
  label: string;
  severity: JournalErrorSeverity;
  share: number;
};

type JournalAnalytics = {
  bestSession: JournalSummaryRow | null;
  emotionRows: JournalSummaryRow[];
  errorRows: JournalErrorRow[];
  maxErrorCount: number;
  maxEmotionCount: number;
  riskEmotion: JournalSummaryRow | null;
  sessionRows: JournalSummaryRow[];
  stats: JournalStats;
  weekdayRows: JournalSummaryRow[];
};

type JournalReviewSummary = {
  averagePnl: number;
  bestPnl: number | null;
  needsReview: number;
  withMedia: number;
  worstPnl: number | null;
};

type JournalDateRange = {
  from: string;
  to: string;
};

function JournalPnlCurvePanel({ currency, entries }: { currency: Currency; entries: JournalEntry[] }) {
  const width = 760;
  const height = 320;
  const padding = { bottom: 42, left: 48, right: 26, top: 32 };
  const points = useMemo(() => buildJournalPnlPoints(entries), [entries]);
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const step = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const scaledPoints = points.map((point, index) => ({
    date: point.date,
    value: point.value,
    x: padding.left + index * step,
    y: height - padding.bottom - ((point.value - min) / range) * chartHeight,
  }));
  const path = buildSmoothPath(scaledPoints);
  const finalValue = points.at(-1)?.value ?? 0;
  const lastScaledPoint = scaledPoints.at(-1);
  const baselineY = height - padding.bottom - ((0 - min) / range) * chartHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const verticalLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <section className="panel journal-pnl-curve-panel">
      <div className="panel-heading">
        <div>
          <h2>P&L acumulado</h2>
          <p>{entries.length ? `${entries.length} operaciones en el subconjunto activo.` : "Sin operaciones en el filtro actual."}</p>
        </div>
        <strong className={`chart-delta ${signedTone(finalValue)}`}>{formatMoney(finalValue, currency)}</strong>
      </div>
      {points.length > 0 ? (
        <>
          <div className="journal-pnl-chart-frame" role="img" aria-label="Curva de P&L acumulado del journal">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="journal-pnl-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(139, 92, 246, 0.34)" />
                  <stop offset="68%" stopColor="rgba(139, 92, 246, 0.12)" />
                  <stop offset="100%" stopColor="rgba(124, 58, 237, 0)" />
                </linearGradient>
              </defs>
              {gridLines.map((position) => {
                const y = padding.top + chartHeight * position;
                return <line className="chart-axis muted" key={`journal-h-${position}`} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
              })}
              {verticalLines.map((position) => {
                const x = padding.left + chartWidth * position;
                return <line className="chart-axis vertical" key={`journal-v-${position}`} x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} />;
              })}
              <line className="chart-axis baseline" x1={padding.left} x2={width - padding.right} y1={baselineY} y2={baselineY} />
              <path
                className="journal-pnl-chart-fill"
                d={scaledPoints.length ? buildAreaPath(path, scaledPoints[0], scaledPoints.at(-1) || scaledPoints[0], height - padding.bottom) : ""}
              />
              <path className="journal-pnl-chart-line" d={path} />
              {scaledPoints.length <= 14 &&
                scaledPoints.map((point, index) => (
                  <circle className="journal-pnl-chart-point is-muted" key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="3.5" />
                ))}
              {lastScaledPoint && <circle className="journal-pnl-chart-point is-last" cx={lastScaledPoint.x} cy={lastScaledPoint.y} r="5.2" />}
            </svg>
            {lastScaledPoint && (
              <span
                className={`chart-value-badge ${signedTone(finalValue)}`}
                style={{ left: `${(lastScaledPoint.x / width) * 100}%`, top: `${(lastScaledPoint.y / height) * 100}%` }}
              >
                {formatMoney(finalValue, currency)}
              </span>
            )}
          </div>
          <div className="chart-footer">
            <span>{points[0]?.date}</span>
            <span>{formatMoney(finalValue, currency)}</span>
            <span>{points.at(-1)?.date}</span>
          </div>
        </>
      ) : (
        <div className="chart-empty">No hay datos suficientes</div>
      )}
    </section>
  );
}

function JournalRecentTradesPanel({
  accounts,
  accountById,
  currency,
  entries,
  errorTypes,
  firmNameById,
  onSelectEntry,
}: {
  accounts: TradingAccount[];
  accountById: Map<string, TradingAccount>;
  currency: Currency;
  entries: JournalEntry[];
  errorTypes: JournalErrorType[];
  firmNameById: Map<string, string>;
  onSelectEntry: (entryId: string) => void;
}) {
  return (
    <section className="panel journal-recent-panel">
      <div className="panel-heading">
        <div>
          <h2>Ultimas operaciones</h2>
          <p>Click en una fila para abrir el detalle.</p>
        </div>
      </div>
      <div className="journal-recent-list">
        {entries.map((entry) => {
          const entryErrors = getEntryErrors(entry, errorTypes);
          return (
            <button className="journal-recent-row" key={entry.id} onClick={() => onSelectEntry(entry.id)} type="button">
              <span>
                <strong>{entry.symbol}</strong>
                <small>{entry.date}</small>
              </span>
              <span>
                <strong>{findOptionLabel(directionOptions, entry.direction)}</strong>
                <small>{formatTradingSessionLabel(entry)}</small>
              </span>
              <span>
                <strong>{getAccountName(accounts, entry.accountId)}</strong>
                <small>{getEntryFirmName(entry, accountById, firmNameById)}</small>
              </span>
              <span>
                <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
                <small>{entryErrors.length ? `${entryErrors.length} errores` : "Sin errores"}</small>
              </span>
            </button>
          );
        })}
        {entries.length === 0 && <div className="journal-breakdown-empty">Sin operaciones en el filtro actual.</div>}
      </div>
    </section>
  );
}

type BreakdownDisplayRow = {
  color?: string;
  detail: string;
  id: string;
  label: string;
  meter: number;
  note: string;
  tone: Tone;
  value: string;
};

function JournalBreakdownPanel({
  emptyText,
  rows,
  subtitle,
  title,
}: {
  emptyText: string;
  rows: BreakdownDisplayRow[];
  subtitle: string;
  title: string;
}) {
  return (
    <section className="panel journal-breakdown-panel">
      <div className="panel-heading compact-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="journal-breakdown-list">
          {rows.map((row) => (
            <div className={`journal-breakdown-row ${row.tone}`} key={row.id}>
              <div className="breakdown-main">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
              <div className="breakdown-meter" aria-hidden="true">
                <i style={{ backgroundColor: row.color, width: `${row.meter}%` }} />
              </div>
              <div className="breakdown-meta">
                <span>{row.detail}</span>
                <small>{row.note}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="journal-breakdown-empty">{emptyText}</div>
      )}
    </section>
  );
}

function JournalWeekdayPanel({ currency, rows }: { currency: Currency; rows: JournalSummaryRow[] }) {
  const hasData = rows.some((row) => row.count > 0);

  return (
    <section className="panel journal-breakdown-panel">
      <div className="panel-heading compact-heading">
        <div>
          <h2>Dias de semana</h2>
          <p>Distribucion de winrate y P&L por dia.</p>
        </div>
      </div>
      {hasData ? (
        <div className="journal-weekday-bars">
          {rows.map((row) => (
            <div className={`journal-weekday-bar ${signedTone(row.pnl)}`} key={row.id}>
              <div className="weekday-track" aria-hidden="true">
                <i style={{ height: `${winRateMeter(row.winRate)}%` }} />
              </div>
              <span>{row.label}</span>
              <strong>{row.winRate === null ? "-" : formatPercent(row.winRate)}</strong>
              <small>
                {row.count ? `${row.count} ops - ${formatMoney(row.pnl, currency)}` : "Sin datos"}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="journal-breakdown-empty">Sin dias con entradas.</div>
      )}
    </section>
  );
}

function buildJournalAnalytics(entries: JournalEntry[], errorTypes: JournalErrorType[]): JournalAnalytics {
  const stats = getJournalStats(entries);
  const sessionRows = sessionOptions
    .map((option) => ({
      id: option.value,
      label: option.label,
      ...summarizeJournalEntries(entries.filter((entry) => getEntryTradingSession(entry) === option.value)),
    }))
    .filter((row) => row.count > 0);
  const emotionRows = emotionOptions
    .map((option) => ({
      id: option.value,
      label: option.label,
      ...summarizeJournalEntries(entries.filter((entry) => entry.emotion === option.value)),
    }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count || left.averagePnl - right.averagePnl);
  const weekdayRows = weekdayLabels.map((label, index) => ({
    id: String(index),
    label,
    ...summarizeJournalEntries(entries.filter((entry) => getWeekdayIndex(entry.date) === index)),
  }));
  const errorRows = buildJournalErrorRows(entries, errorTypes);
  const bestSession =
    [...sessionRows].sort((left, right) => right.pnl - left.pnl || (right.winRate ?? -1) - (left.winRate ?? -1))[0] ??
    null;
  const riskEmotion =
    [...emotionRows].sort((left, right) => left.averagePnl - right.averagePnl || right.count - left.count)[0] ?? null;

  return {
    bestSession,
    emotionRows,
    errorRows,
    maxErrorCount: errorRows.reduce((max, row) => Math.max(max, row.count), 0),
    maxEmotionCount: emotionRows.reduce((max, row) => Math.max(max, row.count), 0),
    riskEmotion,
    sessionRows,
    stats,
    weekdayRows,
  };
}

function JournalErrorChips({
  compact = false,
  errors,
  errorTypes,
}: {
  compact?: boolean;
  errors: string[];
  errorTypes: JournalErrorType[];
}) {
  if (!errors.length) {
    return <p className="journal-errors-empty-inline">Sin errores marcados.</p>;
  }

  return (
    <div className={`journal-error-chips ${compact ? "compact" : ""}`}>
      {errors.map((error) => {
        const type = getJournalErrorDefinitionFor(errorTypes, error);
        return (
          <span key={error} style={{ "--error-color": type.color } as CSSProperties}>
            <i aria-hidden="true" />
            {type.label}
          </span>
        );
      })}
    </div>
  );
}

function JournalAccountOverviewPanel({ currency, overview }: { currency: Currency; overview: JournalAccountOverview }) {
  return (
    <section className="panel journal-account-overview-panel">
      <div className="journal-account-overview-head">
        <div>
          <span>Cuenta seleccionada</span>
          <h2>{overview.accountName}</h2>
          <p>
            {overview.firmName || "Sin empresa"} - {overview.baseLabel}
          </p>
        </div>
        <div className="journal-account-return">
          <span>Retorno</span>
          <strong className={overview.returnRatio === null ? "neutral" : signedTone(overview.returnRatio)}>
            {overview.returnRatio === null ? "-" : formatSignedPercent(overview.returnRatio)}
          </strong>
        </div>
      </div>

      <div className="journal-account-overview-stats">
        <div>
          <span>Balance</span>
          <strong>{formatMoney(overview.balance, currency)}</strong>
        </div>
        <div>
          <span>P&L neto</span>
          <strong className={signedTone(overview.netPnl)}>{formatSignedMoney(overview.netPnl, currency)}</strong>
        </div>
        <div>
          <span>Base</span>
          <strong>{overview.base === null ? "-" : formatMoney(overview.base, currency)}</strong>
        </div>
      </div>

      <div className="journal-account-rules">
        {overview.rules.map((rule) => (
          <article className={`journal-account-rule ${rule.tone}`} key={rule.label}>
            <div className="journal-account-rule-head">
              <span>
                {rule.icon === "target" ? <Target size={16} strokeWidth={2.2} /> : <ShieldAlert size={16} strokeWidth={2.2} />}
                {rule.label}
              </span>
              <strong>{rule.status}</strong>
            </div>
            <div className="journal-account-rule-track" aria-hidden="true">
              <i style={{ width: `${rule.meter}%` }} />
            </div>
            <small>{rule.hint}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function JournalPortfolioOverviewPanel({
  accounts,
  currency,
  entries,
}: {
  accounts: TradingAccount[];
  currency: Currency;
  entries: JournalEntry[];
}) {
  const stats = getJournalStats(entries);
  const accountIds = new Set(entries.map((entry) => entry.accountId).filter(Boolean));
  const withMedia = entries.filter((entry) => Boolean(entry.operationUrl?.trim())).length;
  const needsReview = entries.filter(needsJournalReview).length;
  const disciplineLabel =
    stats.avgDiscipline === null ? "-" : formatDisciplineScore(stats.avgDiscipline, stats.disciplineScale);

  return (
    <section className="panel journal-account-overview-panel journal-portfolio-overview-panel">
      <div className="journal-account-overview-head">
        <div>
          <span>Trading overview</span>
          <h2>Portfolio journal</h2>
          <p>
            {accountIds.size || accounts.length} {accountIds.size === 1 ? "cuenta" : "cuentas"} con actividad filtrada.
          </p>
        </div>
        <div className="journal-account-return">
          <span>Return operativo</span>
          <strong className={signedTone(stats.netPnl)}>{formatMoney(stats.netPnl, currency)}</strong>
        </div>
      </div>
      <div className="journal-account-overview-stats">
        <div>
          <span>Operaciones</span>
          <strong>{stats.count}</strong>
        </div>
        <div>
          <span>Winrate</span>
          <strong>{formatRatioPercent(stats.winRate)}</strong>
        </div>
        <div>
          <span>Profit factor</span>
          <strong>{formatProfitFactor(stats.profitFactor)}</strong>
        </div>
      </div>
      <div className="journal-account-rules">
        <article className={`journal-account-rule ${stats.netPnl >= 0 ? "positive" : "negative"}`}>
          <div className="journal-account-rule-head">
            <span>
              <Target size={14} strokeWidth={2.2} />
              P&L neto
            </span>
            <strong>{formatMoney(stats.netPnl, currency)}</strong>
          </div>
          <div className="journal-account-rule-track" aria-hidden="true">
            <i style={{ width: `${clampPercent(Math.abs(stats.winRate ?? 0) * 100 || 8)}%` }} />
          </div>
          <small>{stats.wins}W / {stats.losses}L / {stats.breakEven} BE</small>
        </article>
        <article className={`journal-account-rule ${needsReview ? "negative" : "positive"}`}>
          <div className="journal-account-rule-head">
            <span>
              <ShieldAlert size={14} strokeWidth={2.2} />
              Pendientes
            </span>
            <strong>{needsReview}</strong>
          </div>
          <div className="journal-account-rule-track" aria-hidden="true">
            <i style={{ width: `${shareMeter(needsReview, Math.max(entries.length, 1))}%` }} />
          </div>
          <small>Perdidas, baja disciplina o sin aprendizaje.</small>
        </article>
        <article className="journal-account-rule neutral">
          <div className="journal-account-rule-head">
            <span>
              <ImagePlus size={14} strokeWidth={2.2} />
              Capturas
            </span>
            <strong>{withMedia}</strong>
          </div>
          <div className="journal-account-rule-track" aria-hidden="true">
            <i style={{ width: `${shareMeter(withMedia, Math.max(entries.length, 1))}%` }} />
          </div>
          <small>Disciplina media {disciplineLabel}</small>
        </article>
      </div>
    </section>
  );
}

function buildJournalAccountOverview({
  account,
  currency,
  entries,
  firmNameById,
}: {
  account?: TradingAccount;
  currency: Currency;
  entries: JournalEntry[];
  firmNameById: Map<string, string>;
}): JournalAccountOverview | null {
  if (!account) return null;

  const accountEntries = entries.filter((entry) => entry.accountId === account.id);
  const base = account.size > 0 ? account.size : null;
  const netPnl = sumNumbers(accountEntries.map((entry) => entry.pnl));
  const balance = (base ?? 0) + netPnl;
  const returnRatio = base ? netPnl / base : null;
  const todayPnl = sumNumbers(accountEntries.filter((entry) => entry.date === todayIso()).map((entry) => entry.pnl));

  return {
    accountName: account.name,
    balance,
    base,
    baseLabel: base ? `Base ${formatMoney(base, currency)}` : "Anade tamano de cuenta para calcular %",
    firmName: firmNameById.get(account.firmId) || "",
    netPnl,
    returnRatio,
    rules: [
      buildTargetRule(account.phaseTarget, netPnl, currency),
      buildEodDrawdownRule(account.maxDrawdown, base, accountEntries, netPnl, currency),
      buildDailyDrawdownRule(account.dailyDrawdown, todayPnl, currency),
    ],
  };
}

function buildTargetRule(target: number, netPnl: number, currency: Currency): JournalAccountRule {
  if (!isPositiveAmount(target)) {
    return {
      hint: "Anade target de fase en la cuenta.",
      icon: "target",
      label: "Objetivo",
      meter: 0,
      status: "Sin target",
      tone: "neutral",
    };
  }

  const remaining = target - netPnl;
  const reached = remaining <= 0;
  return {
    hint: `${formatSignedMoney(netPnl, currency)} / ${formatMoney(target, currency)}`,
    icon: "target",
    label: "Objetivo",
    meter: clampPercent((netPnl / target) * 100),
    status: reached ? "Target conseguido" : `Quedan ${formatMoney(Math.max(remaining, 0), currency)}`,
    tone: reached ? "positive" : "neutral",
  };
}

function buildEodDrawdownRule(
  amount: number,
  base: number | null,
  entries: JournalEntry[],
  pnl: number,
  currency: Currency,
): JournalAccountRule {
  if (!isPositiveAmount(amount)) {
    return {
      hint: "Sin drawdown maximo configurado.",
      icon: "drawdown",
      label: "DD maximo",
      meter: 0,
      status: "Sin DD max.",
      tone: "neutral",
    };
  }

  const model = getEodDrawdownModel(amount, base, entries, pnl);
  const percent = clampPercent((model.remaining / amount) * 100);
  const breached = model.remaining <= 0;
  return {
    hint: `Limite actual ${formatMoney(model.limit, currency)} - EOD max. ${formatMoney(model.highWatermark, currency)}`,
    icon: "drawdown",
    label: "DD maximo",
    meter: percent,
    status: breached ? "Limite superado" : `Quedan ${formatMoney(model.remaining, currency)}`,
    tone: breached || percent <= 25 ? "negative" : percent <= 50 ? "neutral" : "positive",
  };
}

function buildDailyDrawdownRule(amount: number, todayPnl: number, currency: Currency): JournalAccountRule {
  if (!isPositiveAmount(amount)) {
    return {
      hint: "Esta cuenta no tiene limite diario.",
      icon: "drawdown",
      label: "DD diario",
      meter: 0,
      status: "Sin DD diario",
      tone: "neutral",
    };
  }

  const remaining = amount + todayPnl;
  const percent = clampPercent((remaining / amount) * 100);
  const breached = remaining <= 0;
  return {
    hint: `Hoy ${formatSignedMoney(todayPnl, currency)} / -${formatMoney(amount, currency)}`,
    icon: "drawdown",
    label: "DD diario",
    meter: percent,
    status: breached ? "Limite superado" : `Quedan ${formatMoney(remaining, currency)}`,
    tone: breached || percent <= 25 ? "negative" : percent <= 50 ? "neutral" : "positive",
  };
}

function getEodDrawdownModel(amount: number, base: number | null, entries: JournalEntry[], pnl: number) {
  const startBalance = base ?? 0;
  const dailyPnl = new Map<string, number>();
  const today = todayIso();

  entries.forEach((entry) => {
    if (!entry.date || entry.date >= today) return;
    dailyPnl.set(entry.date, (dailyPnl.get(entry.date) || 0) + entry.pnl);
  });

  let cumulative = 0;
  let highWatermark = startBalance;
  Array.from(dailyPnl.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([, dayPnl]) => {
      cumulative += dayPnl;
      highWatermark = Math.max(highWatermark, startBalance + cumulative);
    });

  const currentBalance = startBalance + pnl;
  const limit = highWatermark - amount;
  return {
    currentBalance,
    highWatermark,
    limit,
    remaining: currentBalance - limit,
  };
}

function buildJournalErrorRows(entries: JournalEntry[], errorTypes: JournalErrorType[]): JournalErrorRow[] {
  const counts = new Map<string, number>();

  entries.forEach((entry) => {
    getEntryErrors(entry, errorTypes).forEach((error) => {
      counts.set(error, (counts.get(error) || 0) + 1);
    });
  });

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return Array.from(counts.entries())
    .map(([id, count]) => {
      const type = getJournalErrorDefinitionFor(errorTypes, id);
      return {
        color: type.color,
        count,
        id,
        label: type.label,
        severity: type.severity,
        share: total ? count / total : 0,
      };
    })
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || right.count - left.count);
}

function getEntryErrors(entry: JournalEntry, errorTypes: JournalErrorType[]) {
  return sanitizeJournalErrorIds(errorTypes, entry.errors);
}

function getJournalErrorLabel(errorTypes: JournalErrorType[], id: string) {
  return getJournalErrorDefinitionFor(errorTypes, id).label;
}

function getEntryFirmName(
  entry: JournalEntry,
  accountById: Map<string, TradingAccount>,
  firmNameById: Map<string, string>,
) {
  return firmNameById.get(entry.firmId || "") || firmNameById.get(accountById.get(entry.accountId)?.firmId || "") || "Sin empresa";
}

function formatTradingSessionLabel(entry: JournalEntry) {
  const tradingSession = getEntryTradingSession(entry);
  return tradingSession ? findOptionLabel(sessionOptions, tradingSession) : "Sin sesion";
}

function getEntryTradingSession(entry: JournalEntry): JournalTradingSession | "" {
  const legacyEntry = entry as JournalEntry & { session?: unknown; trading_session?: unknown };
  return normalizeEntryTradingSession(
    legacyEntry.tradingSession ?? legacyEntry.trading_session ?? legacyEntry.session,
  );
}

function normalizeEntryTradingSession(value: unknown): JournalTradingSession | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (sessionOptions.some((option) => option.value === raw)) return raw as JournalTradingSession;

  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "-");
  const aliases: Record<string, JournalTradingSession> = {
    asia: "asia",
    asian: "asia",
    londres: "london",
    london: "london",
    "new-york": "newYork",
    newyork: "newYork",
    ny: "newYork",
    "nueva-york": "newYork",
    "london-ny": "londonNewYork",
    "londres-ny": "londonNewYork",
    "london-new-york": "londonNewYork",
    "londres-nueva-york": "londonNewYork",
    other: "other",
    otra: "other",
  };

  return aliases[key] || "";
}

function getJournalStats(entries: JournalEntry[]): JournalStats {
  const rows = entries.map((entry) => toFiniteNumber(entry.pnl)).filter((value): value is number => value !== null);
  const wins = rows.filter((value) => value > 0);
  const losses = rows.filter((value) => value < 0);
  const grossProfit = sumNumbers(wins);
  const grossLoss = Math.abs(sumNumbers(losses));
  const closed = wins.length + losses.length;
  const disciplineValues = entries
    .map((entry) => toFiniteNumber(entry.discipline))
    .filter((value): value is number => value !== null);

  return {
    ...summarizeJournalEntries(entries),
    avgDiscipline: disciplineValues.length ? sumNumbers(disciplineValues) / disciplineValues.length : null,
    avgLoss: losses.length ? grossLoss / losses.length : null,
    avgWin: wins.length ? grossProfit / wins.length : null,
    disciplineScale: getDisciplineScale(entries),
    grossLoss,
    grossProfit,
    netPnl: sumNumbers(rows),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null,
    closed,
  };
}

function buildJournalPnlPoints(entries: JournalEntry[]) {
  let running = 0;
  return [...entries]
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .map((entry) => {
      running += entry.pnl;
      return {
        date: entry.date,
        value: running,
      };
    });
}

function summarizeJournalEntries(entries: JournalEntry[]): JournalSummary {
  const values = entries.map((entry) => toFiniteNumber(entry.pnl)).filter((value): value is number => value !== null);
  const wins = values.filter((value) => value > 0).length;
  const losses = values.filter((value) => value < 0).length;
  const breakEven = values.filter((value) => value === 0).length;
  const closed = wins + losses;
  const pnl = sumNumbers(values);

  return {
    averagePnl: values.length ? pnl / values.length : 0,
    breakEven,
    closed,
    count: values.length,
    losses,
    pnl,
    winRate: closed ? wins / closed : null,
    wins,
  };
}

function buildJournalReviewSummary(entries: JournalEntry[]): JournalReviewSummary {
  const values = entries.map((entry) => toFiniteNumber(entry.pnl)).filter((value): value is number => value !== null);

  return {
    averagePnl: values.length ? sumNumbers(values) / values.length : 0,
    bestPnl: values.length ? Math.max(...values) : null,
    needsReview: entries.filter(needsJournalReview).length,
    withMedia: entries.filter((entry) => Boolean(entry.operationUrl?.trim())).length,
    worstPnl: values.length ? Math.min(...values) : null,
  };
}

function matchesReviewPreset(
  entry: JournalEntry,
  preset: JournalReviewPreset,
  entryErrors: string[],
  range: JournalDateRange | null,
) {
  if (range && (entry.date < range.from || entry.date > range.to)) return false;
  if (preset === "losers") return entry.pnl < 0;
  if (preset === "errors") return entryErrors.length > 0;
  if (preset === "needsReview") return needsJournalReview(entry);
  return true;
}

function needsJournalReview(entry: JournalEntry) {
  return entry.pnl < 0 || entry.discipline <= 2 || !entry.lesson?.trim();
}

function getReviewPresetDateRange(preset: JournalReviewPreset): JournalDateRange | null {
  const today = new Date();
  const todayKey = dateToIso(today);

  if (preset === "today") {
    return { from: todayKey, to: todayKey };
  }

  if (preset === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: dateToIso(start), to: todayKey };
  }

  if (preset === "month") {
    return { from: `${todayKey.slice(0, 7)}-01`, to: todayKey };
  }

  return null;
}

function compareJournalEntries(left: JournalEntry, right: JournalEntry, sortMode: JournalSortMode) {
  const dateDesc = right.date.localeCompare(left.date) || right.id.localeCompare(left.id);
  const dateAsc = left.date.localeCompare(right.date) || left.id.localeCompare(right.id);

  switch (sortMode) {
    case "date-asc":
      return dateAsc;
    case "pnl-desc":
      return right.pnl - left.pnl || dateDesc;
    case "pnl-asc":
      return left.pnl - right.pnl || dateDesc;
    case "discipline-desc":
      return right.discipline - left.discipline || dateDesc;
    case "discipline-asc":
      return left.discipline - right.discipline || dateDesc;
    case "date-desc":
    default:
      return dateDesc;
  }
}

function formatRatioPercent(value: number | null) {
  return value === null ? "-" : formatPercent(value);
}

function formatNullableMoney(value: number | null, currency: Currency) {
  return value === null ? "-" : formatMoney(value, currency);
}

function formatSignedMoney(value: number, currency: Currency) {
  return value > 0 ? `+${formatMoney(value, currency)}` : formatMoney(value, currency);
}

function formatSignedPercent(value: number) {
  return value > 0 ? `+${formatPercent(value)}` : formatPercent(value);
}

function formatProfitFactor(value: number | null) {
  if (value === null) return "-";
  if (!Number.isFinite(value)) return "Max";
  return value.toFixed(2);
}

function profitFactorTone(value: number | null): Tone {
  if (value === null) return "neutral";
  return value >= 1 ? "positive" : "negative";
}

function winRateMeter(value: number | null) {
  if (value === null) return 0;
  const percent = value * 100;
  return percent > 0 ? Math.max(4, Math.min(100, percent)) : 0;
}

function shareMeter(count: number, maxCount: number) {
  if (!count || !maxCount) return 0;
  return Math.max(6, Math.min(100, (count / maxCount) * 100));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isPositiveAmount(value: number) {
  return Number.isFinite(value) && value > 0;
}

function todayIso() {
  return dateToIso(new Date());
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function isImageSource(value: string) {
  return /^data:image\//i.test(value) || /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value);
}

function getImageFileFromList(files: FileList | null | undefined) {
  return Array.from(files || []).find((file) => file.type.startsWith("image/"));
}

async function compressOperationImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");

  const source = await readOperationImage(file);
  const scale = Math.min(1, operationImageMaxSize / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    closeOperationImage(source);
    throw new Error("No se pudo procesar la imagen.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  closeOperationImage(source);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", operationImageQuality);
  });
  if (!blob) throw new Error("No se pudo comprimir la imagen.");
  return blobToDataUrl(blob);
}

async function readOperationImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return window.createImageBitmap(file);

  const dataUrl = await blobToDataUrl(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = dataUrl;
  });
}

function closeOperationImage(source: ImageBitmap | HTMLImageElement) {
  if ("close" in source) source.close();
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

function getWeekdayIndex(value: string) {
  const date = parseLocalDate(value);
  if (!date) return -1;
  return (date.getDay() + 6) % 7;
}

function parseLocalDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : null;
}

function sumNumbers(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function buildCalendarDays(month: string, entries: JournalEntry[]): CalendarDay[] {
  const safeMonth = normalizeMonth(month);
  const [year, monthNumber] = safeMonth.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const grouped = new Map<string, { count: number; firstEntryId?: string; pnl: number }>();

  entries.forEach((entry) => {
    const current = grouped.get(entry.date) || { count: 0, pnl: 0 };
    grouped.set(entry.date, {
      count: current.count + 1,
      firstEntryId: current.firstEntryId || entry.id,
      pnl: current.pnl + entry.pnl,
    });
  });

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateToIso(date);
    const item = grouped.get(key) || { count: 0, pnl: 0 };
    return {
      count: item.count,
      date: key,
      firstEntryId: item.firstEntryId,
      inMonth: key.startsWith(safeMonth),
      pnl: item.pnl,
    };
  });
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = normalizeMonth(month).split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = normalizeMonth(month).split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}

function normalizeMonth(month: string) {
  return /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
}

function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function downloadJournalCsv({
  accountById,
  entries,
  errorTypes,
  firmNameById,
}: {
  accountById: Map<string, TradingAccount>;
  entries: JournalEntry[];
  errorTypes: JournalErrorType[];
  firmNameById: Map<string, string>;
}) {
  const header = [
    "date",
    "firm",
    "account",
    "symbol",
    "direction",
    "tradingSession",
    "sessionType",
    "result",
    "emotion",
    "discipline",
    "pnl",
    "errors",
    "operationUrl",
    "notes",
    "lesson",
  ];
  const lines = entries.map((entry) =>
    [
      entry.date,
      getEntryFirmName(entry, accountById, firmNameById),
      getAccountName(Array.from(accountById.values()), entry.accountId),
      entry.symbol,
      findOptionLabel(directionOptions, entry.direction),
      formatTradingSessionLabel(entry),
      findOptionLabel(sessionTypeOptions, entry.sessionType || "other"),
      findOptionLabel(resultOptions, entry.result || "neutral"),
      findOptionLabel(emotionOptions, entry.emotion),
      entry.discipline,
      entry.pnl,
      getEntryErrors(entry, errorTypes)
        .map((error) => getJournalErrorLabel(errorTypes, error))
        .join(" | "),
      entry.operationUrl || "",
      entry.notes || "",
      entry.lesson || "",
    ]
      .map(escapeCsvValue)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `trazza-journal-${todayIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function escapeCsvValue(value: string | number) {
  const source = String(value);
  return /[",\r\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

async function importCsv(
  file: File,
  errorTypes: JournalErrorType[],
  onSaveEntry: (input: JournalEntryInput, entryId?: string) => Promise<boolean>,
  setImporting: (value: boolean) => void,
): Promise<{ failed: number; imported: number; skipped: number; total: number }> {
  setImporting(true);
  const result = {
    failed: 0,
    imported: 0,
    skipped: 0,
    total: 0,
  };

  try {
    const text = await file.text();
    const rows = parseCsv(text);
    result.total = rows.length;

    for (const row of rows) {
      const input = rowToJournalInput(row, errorTypes);
      if (input) {
        const saved = await onSaveEntry(input);
        if (saved) {
          result.imported += 1;
        } else {
          result.failed += 1;
        }
      } else {
        result.skipped += 1;
      }
    }

    return result;
  } finally {
    setImporting(false);
  }
}

function parseCsv(text: string) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
  if (!headerLine) return [];
  const delimiter = chooseCsvDelimiter(headerLine);
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeader);

  return lines.map((line) => {
    const values = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function chooseCsvDelimiter(line: string) {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function normalizeHeader(header: string) {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function rowToJournalInput(row: Record<string, string>, errorTypes: JournalErrorType[]): JournalEntryInput | null {
  if (!Object.values(row).some((value) => value.trim())) return null;

  const pnl = parseFlexibleNumber(pick(row, ["pnl", "p&l", "profit", "resultado", "ganancia", "importe"]));
  const discipline = parseFlexibleNumber(pick(row, ["discipline", "disciplina"]));

  return {
    date: normalizeDate(pick(row, ["date", "fecha", "day", "dia"])),
    symbol: (pick(row, ["symbol", "activo", "title", "titulo", "instrument", "mercado"]) || "TRADE").toUpperCase(),
    direction: normalizeDirection(pick(row, ["direction", "direccion", "side", "tipo"])),
    emotion: normalizeEmotion(pick(row, ["emotion", "emocion", "mindset", "estado"])),
    errors: sanitizeJournalErrorIds(errorTypes, pick(row, ["errors", "errores", "mistakes", "fallos"])),
    firmId: pick(row, ["firmid", "empresaid"]) || "",
    accountId: pick(row, ["accountid", "cuentaid"]) || "",
    lesson: row.lesson || row.aprendizaje || "",
    notes: pick(row, ["notes", "notas", "comment", "comentario", "descripcion"]),
    operationUrl: pick(row, ["operationurl", "captura", "image", "imagen", "url"]),
    pnl: Number.isFinite(pnl) ? pnl : 0,
    result: normalizeResult(pick(row, ["result", "resultadoestado"]), pnl),
    discipline: discipline > 0 ? Math.min(5, Math.max(1, Math.round(discipline))) : 3,
    sessionType: normalizeSessionType(pick(row, ["sessiontype", "tiposesion", "tipojornada"])),
    tradingSession: normalizeTradingSession(pick(row, ["tradingsession", "sesion", "session"])),
  };
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeDate(value: string) {
  const fallback = new Date().toISOString().slice(0, 10);
  const source = value.trim();
  if (!source) return fallback;

  const iso = source.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return joinIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), fallback);

  const european = source.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (european) {
    const year = Number(european[3]) < 100 ? 2000 + Number(european[3]) : Number(european[3]);
    return joinIsoDate(year, Number(european[2]), Number(european[1]), fallback);
  }

  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? fallback : dateToIso(parsed);
}

function joinIsoDate(year: number, month: number, day: number, fallback: string) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return fallback;
  return dateToIso(date);
}

function parseFlexibleNumber(value: string) {
  const source = value.replace(/[^\d.,-]/g, "");
  if (!source) return 0;
  const lastComma = source.lastIndexOf(",");
  const lastDot = source.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(source.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma !== -1) {
    const parts = source.split(",");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? source.replaceAll(",", "") : source.replace(",", "."));
  }

  if (lastDot !== -1) {
    const parts = source.split(".");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? source.replaceAll(".", "") : source);
  }

  return Number(source);
}

function normalizeDirection(value: string): JournalDirection {
  const normalized = value.trim().toLowerCase();
  if (["long", "buy", "compra", "comprar", "l"].includes(normalized)) return "long";
  if (["short", "sell", "venta", "vender", "s"].includes(normalized)) return "short";
  return "none";
}

function normalizeResult(value: string, pnl: number): JournalResult {
  const normalized = value.trim().toLowerCase();
  if (["good", "win", "winner", "ganador", "bueno"].includes(normalized)) return "good";
  if (["bad", "loss", "loser", "perdedor", "malo"].includes(normalized)) return "bad";
  if (["neutral", "flat", "be"].includes(normalized)) return "neutral";
  if (pnl > 0) return "good";
  if (pnl < 0) return "bad";
  return "neutral";
}

function normalizeEmotion(value: string): JournalEmotion {
  const normalized = value.trim().toLowerCase();
  if (["calm", "calmado", "tranquilo"].includes(normalized)) return "calm";
  if (["focused", "enfocado", "focus"].includes(normalized)) return "focused";
  if (["anxious", "ansioso", "nervioso"].includes(normalized)) return "anxious";
  if (["impatient", "impaciente"].includes(normalized)) return "impatient";
  if (normalized === "fomo") return "fomo";
  if (["revenge", "venganza"].includes(normalized)) return "revenge";
  if (["tired", "cansado"].includes(normalized)) return "tired";
  if (normalized === "other" || normalized === "otro") return "other";
  return "focused";
}

function normalizeSessionType(value: string): JournalSessionType {
  const normalized = value.trim().toLowerCase();
  if (["trading-day", "tradingday", "trading", "dia"].includes(normalized)) return "trading-day";
  if (["evaluation", "evaluacion"].includes(normalized)) return "evaluation";
  if (["funded", "fondeada"].includes(normalized)) return "funded";
  if (["payout-day", "payoutday", "payout"].includes(normalized)) return "payout-day";
  if (["news-day", "newsday", "noticias"].includes(normalized)) return "news-day";
  if (["review", "revision"].includes(normalized)) return "review";
  return "trading-day";
}

function normalizeTradingSession(value: string): JournalTradingSession {
  const normalized = value.trim().toLowerCase();
  if (["asia", "asian"].includes(normalized)) return "asia";
  if (["london", "londres"].includes(normalized)) return "london";
  if (["newyork", "ny", "nueva york", "new york"].includes(normalized)) return "newYork";
  if (["londonnewyork", "londonny", "londresny", "londresnewyork"].includes(normalized)) return "londonNewYork";
  return "newYork";
}

function findOptionLabel<T extends string>(options: Array<{ label: string; value: T }>, value: T) {
  return options.find((option) => option.value === value)?.label || value;
}

function SelectField({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
