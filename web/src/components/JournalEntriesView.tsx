import { useEffect, useMemo, useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Info,
  LayoutGrid,
  ListChecks,
  Pencil,
  Percent,
  Plus,
  Settings2,
  ShieldAlert,
  Target,
  Trash2,
  TrendingUp,
  ZoomIn,
  X,
} from "lucide-react";
import { DatePicker } from "./DatePicker";
import { FilterToggleButton } from "./FilterToggle";
import { MetricCard } from "./MetricCard";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { buildAreaPath, buildSmoothPath } from "../lib/chartPath";
import { useJournalDashboardLayout, type JournalWidgetId } from "../hooks/useJournalDashboardLayout";
import { useI18n, useT } from "../lib/i18n/context";
import type { Language } from "../lib/i18n/context";
import {
  formatMoney,
  formatPercent,
  getAccountName,
  getDisciplineScale,
  getPayoutGrossAmount,
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
import { parseTradovatePerformanceCsv, type TradovateImportResult } from "../lib/tradovateImport";
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
  Movement,
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
  movements: Movement[];
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
  payouts: number;
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

function getDirectionOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: JournalDirection }> {
  return [
    { label: t("journal.option.direction.long"), value: "long" },
    { label: t("journal.option.direction.short"), value: "short" },
    { label: t("journal.option.direction.none"), value: "none" },
  ];
}

function getSessionOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: JournalTradingSession }> {
  return [
    { label: t("journal.option.session.asia"), value: "asia" },
    { label: t("journal.option.session.london"), value: "london" },
    { label: t("journal.option.session.newYork"), value: "newYork" },
    { label: t("journal.option.session.londonNewYork"), value: "londonNewYork" },
    { label: t("journal.option.session.other"), value: "other" },
  ];
}

function getDisciplineOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: string }> {
  return [
    { label: t("journal.option.discipline.five"), value: "5" },
    { label: t("journal.option.discipline.four"), value: "4" },
    { label: t("journal.option.discipline.three"), value: "3" },
    { label: t("journal.option.discipline.two"), value: "2" },
    { label: t("journal.option.discipline.one"), value: "1" },
  ];
}

function getResultOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: JournalResult }> {
  return [
    { label: t("journal.option.result.good"), value: "good" },
    { label: t("journal.option.result.neutral"), value: "neutral" },
    { label: t("journal.option.result.bad"), value: "bad" },
  ];
}

function getEmotionOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: JournalEmotion }> {
  return [
    { label: t("journal.option.emotion.calm"), value: "calm" },
    { label: t("journal.option.emotion.focused"), value: "focused" },
    { label: t("journal.option.emotion.anxious"), value: "anxious" },
    { label: t("journal.option.emotion.impatient"), value: "impatient" },
    { label: t("journal.option.emotion.fomo"), value: "fomo" },
    { label: t("journal.option.emotion.revenge"), value: "revenge" },
    { label: t("journal.option.emotion.tired"), value: "tired" },
    { label: t("journal.option.emotion.other"), value: "other" },
  ];
}

function getWeekdayLabels(t: ReturnType<typeof useT>) {
  return [
    t("journal.weekday.mon"),
    t("journal.weekday.tue"),
    t("journal.weekday.wed"),
    t("journal.weekday.thu"),
    t("journal.weekday.fri"),
    t("journal.weekday.sat"),
    t("journal.weekday.sun"),
  ];
}

const errorColorOptions = ["#dc2626", "#f59e0b", "#7c3aed", "#0e8f8d", "#2563eb", "#64748b"];
const operationImageMaxSize = 1600;
const operationImageQuality = 0.82;

type LocalMessage = {
  text: string;
  type: "error" | "info" | "success";
};

type JournalReviewPreset = "all" | "today" | "week" | "month" | "losers" | "errors" | "needsReview";
type JournalSortMode = "date-desc" | "date-asc" | "pnl-desc" | "pnl-asc" | "discipline-desc" | "discipline-asc";
type JournalPeriodFilter = "all" | "current-month" | "last-30" | "last-90" | "year";

function getPeriodFilterOptions(t: ReturnType<typeof useT>): Array<{ label: string; value: JournalPeriodFilter }> {
  return [
    { label: t("journal.periodFilter.all"), value: "all" },
    { label: t("journal.periodFilter.currentMonth"), value: "current-month" },
    { label: t("journal.periodFilter.last30"), value: "last-30" },
    { label: t("journal.periodFilter.last90"), value: "last-90" },
    { label: t("journal.periodFilter.year"), value: "year" },
  ];
}

export function JournalEntriesView({
  accounts,
  currency,
  dataMode,
  entries,
  firms,
  initialMode = "cockpit",
  journalErrorTypes,
  movements,
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
  const [accountFilter, setAccountFilter] = useState("all");
  const [draggingOperationMedia, setDraggingOperationMedia] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [errorTypeDraft, setErrorTypeDraft] = useState<JournalErrorTypeInput>(() => createEmptyErrorTypeInput());
  const [editingErrorTypeId, setEditingErrorTypeId] = useState<string | undefined>();
  const [errorManagerOpen, setErrorManagerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<LocalMessage | null>(null);
  const [importing, setImporting] = useState(false);
  const [mediaMessage, setMediaMessage] = useState<LocalMessage | null>(null);
  const [journalMode, setJournalMode] = useState<"cockpit" | "entries" | "entryForm">(initialMode);
  const [periodFilter, setPeriodFilter] = useState<JournalPeriodFilter>("all");
  const [reviewPreset, setReviewPreset] = useState<JournalReviewPreset>("all");
  const [searchText, setSearchText] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  /* Independiente de selectedEntryId: ese lo gobierna el calendario del cockpit, y este
     la tarjeta pulsada en la galeria. Compartirlos hacia que abrir una entrada desde la
     galeria moviera tambien la seleccion del calendario. */
  const [detailEntryId, setDetailEntryId] = useState<string | undefined>();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [zoomImage, setZoomImage] = useState<string | undefined>();
  /* Alta en tres pasos como el legado: se elige modo, y si es CSV se pide cuenta,
     sesion y archivo antes de revisar lo detectado. Manual salta directo al formulario. */
  const [entryModeOpen, setEntryModeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importAccountId, setImportAccountId] = useState("");
  const [importSession, setImportSession] = useState<JournalTradingSession | "">("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<TradovateImportResult | null>(null);
  const canWrite = dataMode === "cloud";
  const dashboardLayout = useJournalDashboardLayout();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const t = useT();
  const { language } = useI18n();
  const directionOptions = useMemo(() => getDirectionOptions(t), [t]);
  const sessionOptions = useMemo(() => getSessionOptions(t), [t]);
  const resultOptions = useMemo(() => getResultOptions(t), [t]);
  const emotionOptions = useMemo(() => getEmotionOptions(t), [t]);
  const disciplineOptions = useMemo(() => getDisciplineOptions(t), [t]);
  const weekdayLabels = useMemo(() => getWeekdayLabels(t), [t]);
  const periodFilterOptions = useMemo(() => getPeriodFilterOptions(t), [t]);
  const accountFilterOptions = useMemo(
    () => [{ label: t("common.all"), value: "all" }, ...accounts.map((account) => ({ label: account.name, value: account.id }))],
    [accounts, t],
  );
  const effectiveErrorTypes = useMemo(() => mergeJournalErrorTypes(journalErrorTypes), [journalErrorTypes]);
  const cloudErrorTypeIds = useMemo(() => new Set(journalErrorTypes.map((type) => type.id)), [journalErrorTypes]);
  const activeErrorTypes = useMemo(
    () => effectiveErrorTypes.filter((type) => type.active || draft.errors.includes(type.id)),
    [draft.errors, effectiveErrorTypes],
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
        movements,
        t,
      }),
    [accountById, currency, entries, firmNameById, movements, selectedAccountId, t],
  );
  const accountsForFirm = useMemo(
    () => (draft.firmId ? accounts.filter((account) => account.firmId === draft.firmId) : accounts),
    [accounts, draft.firmId],
  );
  const entryFirmOptions = useMemo(
    () => [{ label: t("journal.entryForm.noFirm"), value: "" }, ...firms.map((firm) => ({ label: firm.name, value: firm.id }))],
    [firms, t],
  );
  const entryAccountOptions = useMemo(
    () => [
      { label: t("journal.entryForm.noAccount"), value: "" },
      ...accountsForFirm.map((account) => ({ label: account.name, value: account.id })),
    ],
    [accountsForFirm, t],
  );
  const periodRange = useMemo(() => getPeriodDateRange(periodFilter), [periodFilter]);
  const filteredEntries = useMemo(
    () => {
      const rows = entries.filter((entry) => {
        const account = accountById.get(entry.accountId);
        const firmName = firmNameById.get(entry.firmId || "") || firmNameById.get(account?.firmId || "");
        const entryErrors = getEntryErrors(entry, effectiveErrorTypes);
        if (!matchesReviewPreset(entry, reviewPreset, entryErrors, reviewPresetRange)) return false;
        if (accountFilter !== "all" && entry.accountId !== accountFilter) return false;
        if (periodRange && (entry.date < periodRange.from || entry.date > periodRange.to)) return false;
        return matchesSearch(searchText, [
          entry.date,
          entry.symbol,
          entry.direction,
          findOptionLabel(directionOptions, entry.direction),
          findOptionLabel(resultOptions, entry.result || "neutral"),
          findOptionLabel(emotionOptions, entry.emotion),
          formatTradingSessionLabel(entry, sessionOptions, t),
          entryErrors.map((error) => getJournalErrorLabel(effectiveErrorTypes, error)).join(" "),
          entry.pnl,
          entry.operationUrl,
          entry.notes,
          entry.lesson,
          firmName,
          account?.name,
        ]);
      });

      return rows.sort((left, right) => compareJournalEntries(left, right, "date-desc"));
    },
    [
      accountById,
      accountFilter,
      directionOptions,
      emotionOptions,
      entries,
      effectiveErrorTypes,
      firmNameById,
      periodRange,
      resultOptions,
      reviewPreset,
      reviewPresetRange,
      searchText,
      sessionOptions,
      t,
    ],
  );
  const selectedEntry = selectedEntryId ? filteredEntries.find((entry) => entry.id === selectedEntryId) : undefined;
  const detailEntry = detailEntryId ? filteredEntries.find((entry) => entry.id === detailEntryId) : undefined;
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth, filteredEntries, movements),
    [filteredEntries, movements, visibleMonth],
  );
  const selectedDayEntries = useMemo(
    () => (selectedEntry ? filteredEntries.filter((entry) => entry.date === selectedEntry.date) : []),
    [filteredEntries, selectedEntry],
  );
  const analytics = useMemo(
    () => buildJournalAnalytics(filteredEntries, effectiveErrorTypes, sessionOptions, emotionOptions, weekdayLabels),
    [effectiveErrorTypes, emotionOptions, filteredEntries, sessionOptions, weekdayLabels],
  );
  const visibleMonthLabel = useMemo(() => formatMonthLabel(visibleMonth, language), [visibleMonth, language]);

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
    setImportMessage(null);
    setEntryModeOpen(true);
    onNewEntryRequestHandled?.();
  }, [newEntryToken, onNewEntryRequestHandled]);

  const closeImportFlow = () => {
    setImportOpen(false);
    setImportPreview(null);
    setImportFile(null);
  };

  const openImportDialog = () => {
    setEntryModeOpen(false);
    setImportPreview(null);
    setImportFile(null);
    setImportMessage(null);
    setImportAccountId((current) => current || accounts[0]?.id || "");
    setImportOpen(true);
  };

  /* Paso 2 -> 3: analiza el CSV y decide destino como el legado. Una sola operacion
     detectada no merece una pantalla de revision: rellena el formulario manual y se
     revisa alli. Varias van a la lista de vista previa antes de crear nada. */
  const handleImportAnalyze = async () => {
    const account = accounts.find((item) => item.id === importAccountId);
    if (!account || !importFile) return;

    setImporting(true);
    setImportMessage({ type: "info", text: t("journal.import.readingTradovate") });

    try {
      const text = await importFile.text();
      const firmName = firmNameById.get(account.firmId) || "";
      const result = parseTradovatePerformanceCsv(text, account, firmName, importSession || "newYork");

      if (result.entries.length === 1) {
        const preview = result.entries[0];
        setDraft((current) => ({ ...current, ...preview.input }));
        const commissionText =
          preview.commissionAmount > 0
            ? ` ${t("journal.import.netPnlPrefix")} ${formatMoney(preview.input.pnl, currency)} ${t("journal.import.afterCommissionSuffix")} ${formatMoney(preview.commissionAmount, currency)} ${t("journal.import.commissionSuffix")}`
            : "";
        closeImportFlow();
        setJournalMode("entryForm");
        setImportMessage({ type: "success", text: `${t("journal.import.detectedSingle")}${commissionText}` });
        return;
      }

      setImportPreview(result);
      setImportMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("journal.import.tradovateGenericError");
      setImportMessage({ type: "error", text: message });
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);

    let imported = 0;
    let failed = 0;
    let totalCommission = 0;
    const missingSymbols = new Set<string>();

    for (const preview of importPreview.entries) {
      const saved = await onSaveEntry(preview.input);
      if (saved) {
        imported += 1;
        totalCommission += preview.commissionAmount;
        preview.commissionMissingSymbols.forEach((symbol) => missingSymbols.add(symbol));
      } else {
        failed += 1;
      }
    }

    const commissionText = totalCommission > 0 ? ` ${t("journal.import.commissionDeducted")} ${formatMoney(totalCommission, currency)}.` : "";
    const missingText = missingSymbols.size ? ` ${t("journal.import.noCommissionPresetFor")} ${[...missingSymbols].join(", ")}.` : "";

    setImportMessage({
      type: failed > 0 ? "error" : "success",
      text: `${imported} ${t("common.of")} ${importPreview.entries.length} ${t("journal.import.entriesImportedSuffix")}${failed > 0 ? ` ${t("journal.import.failedSuffix")} ${failed}.` : ""}${commissionText}${missingText}`,
    });
    setImporting(false);
    closeImportFlow();
  };

  /* En captura, no en burbuja: el zoom se abre encima del modal de detalle, y ese
     modal (Modal.tsx) ya escucha Escape en burbuja sobre document para cerrarse el
     solo. Sin esto, un Escape cerraba el modal de detalle por debajo y la imagen
     ampliada se quedaba huerfana en pantalla, sin nada que la cierre. Con la
     captura, este handler llega primero y para la propagacion: un Escape cierra
     solo el zoom, hace falta un segundo para cerrar el detalle. */
  useEffect(() => {
    if (!zoomImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setZoomImage(undefined);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [zoomImage]);

  const resetJournalFilters = () => {
    setAccountFilter("all");
    setPeriodFilter("all");
    setReviewPreset("all");
    setSearchText("");
  };
  const hasActiveJournalFilters = accountFilter !== "all" || periodFilter !== "all" || searchText !== "";

  const setOperationMediaFromFile = async (file?: File) => {
    if (!canWrite || !file) return;
    setMediaMessage({ type: "info", text: t("journal.media.processing") });

    try {
      const dataUrl = await compressOperationImage(file, t);
      setDraft((current) => ({ ...current, operationUrl: dataUrl }));
      setMediaMessage({ type: "success", text: t("journal.media.loaded") });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("journal.media.loadError");
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
      setMediaMessage({ type: "error", text: t("journal.media.dragValidImage") });
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

  /* El mismo detalle lo usan el panel del cockpit (seleccion del calendario) y el modal
     que abre la galeria de entradas. Se define como funcion en lugar de componente para
     no tener que pasarle como props las quince cosas de las que depende. */
  const renderEntryDetail = (entry: JournalEntry) => {
    const sameDayEntries = filteredEntries.filter((item) => item.date === entry.date);
    const account = accountById.get(entry.accountId);
    const riskAmount = account && account.size > 0 ? account.size * 0.01 : 0;
    const rMultiple = riskAmount > 0 ? entry.pnl / riskAmount : null;
    return (
      <div className="journal-detail-card">
        <div className="journal-detail-hero">
          <div>
            <span>{entry.symbol}</span>
            <strong>{entry.date}</strong>
          </div>
          <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
        </div>
        <dl className="journal-detail-grid">
          <div>
            <dt>{t("journal.detail.rMultiple")}</dt>
            <dd className={signedTone(rMultiple ?? 0)}>{formatRMultiple(rMultiple)}</dd>
          </div>
          <div>
            <dt>{t("journal.detail.direction")}</dt>
            <dd>{findOptionLabel(directionOptions, entry.direction)}</dd>
          </div>
        </dl>
        <div className="journal-detail-copy">
          <span>{t("journal.detail.errors")}</span>
          <JournalErrorChips errorTypes={effectiveErrorTypes} errors={getEntryErrors(entry, effectiveErrorTypes)} />
        </div>
        <div className="journal-detail-copy">
          <span>{t("journal.detail.notes")}</span>
          <p>{entry.notes || t("journal.detail.noNotes")}</p>
        </div>
        {entry.operationUrl && (
          <div className="journal-detail-copy">
            <span>{t("journal.detail.mediaLabel")}</span>
            {isImageSource(entry.operationUrl) ? (
              <button className="journal-media-preview-button" onClick={() => setZoomImage(entry.operationUrl)} type="button">
                <img className="journal-media-preview" src={entry.operationUrl} alt={`${t("journal.media.captureAlt")} ${entry.symbol}`} />
                <span>
                  <ZoomIn size={15} strokeWidth={2.2} />
                  {t("journal.detail.enlargeCapture")}
                </span>
              </button>
            ) : (
              <a className="journal-media-link" href={entry.operationUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={15} strokeWidth={2.2} />
                {t("journal.detail.openReference")}
              </a>
            )}
          </div>
        )}
        {sameDayEntries.length > 1 && (
          <div className="journal-same-day">
            <span>{t("journal.detail.otherEntriesSameDay")}</span>
            <div>
              {sameDayEntries.map((item) => (
                <button
                  className={item.id === entry.id ? "active" : ""}
                  key={item.id}
                  onClick={() => (detailEntryId ? setDetailEntryId(item.id) : setSelectedEntryId(item.id))}
                  type="button"
                >
                  {item.symbol}
                  <strong className={signedTone(item.pnl)}>{formatMoney(item.pnl, currency)}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const journalWidgetContent: Record<JournalWidgetId, ReactElement> = {
    calendar: (
      <section className="journal-top-grid">
        <section className="panel journal-calendar-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("journal.calendar.title")}</h2>
              <p>{visibleMonthLabel} - {t("journal.calendar.subtitleSuffix")}</p>
            </div>
            <div className="calendar-actions">
              <button className="icon-control compact-icon" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))} title={t("journal.calendar.prevMonth")} type="button">
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
              <button className="icon-control compact-icon" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))} title={t("journal.calendar.nextMonth")} type="button">
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
              <button className="secondary-action" onClick={() => setVisibleMonth(new Date().toISOString().slice(0, 7))} type="button">
                {t("journal.calendar.today")}
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
                aria-label={`${day.date}: ${day.count} ${t("journal.calendar.entriesAriaSuffix")}${day.payoutCount ? `, ${day.payoutCount} ${t("journal.calendar.payoutsAriaSuffix")} ${formatMoney(day.payoutGross, currency)}` : ""}`}
                className={`journal-day ${day.inMonth ? "" : "muted"} ${day.firstEntryId || day.payoutCount ? "has-entries" : ""} ${selectedEntry?.date === day.date ? "selected" : ""} ${signedTone(day.pnl)} ${day.payoutCount ? "payout" : ""}`}
                disabled={!day.firstEntryId}
                key={day.date}
                onClick={() => setSelectedEntryId(day.firstEntryId)}
                type="button"
              >
                <span>{Number(day.date.slice(-2))}</span>
                <strong>
                  {day.count ? formatMoney(day.pnl, currency) : day.payoutCount ? `-${formatMoney(day.payoutGross, currency)}` : "-"}
                </strong>
                <small>
                  {day.count ? `${day.count} ${t("journal.calendar.opsSuffix")}` : ""}
                  {day.count && day.payoutCount ? " · " : ""}
                  {day.payoutCount ? `${t("journal.calendar.payoutPrefix")} -${formatMoney(day.payoutGross, currency)}` : ""}
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel journal-detail-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("journal.detail.title")}</h2>
              <p>{selectedEntry ? `${selectedEntry.symbol} - ${selectedEntry.date}` : t("journal.detail.selectEntry")}</p>
            </div>
            {selectedEntry && (
              <button className="icon-control compact-icon" onClick={() => setSelectedEntryId(undefined)} title={t("journal.detail.close")} type="button">
                <X size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>
          {selectedEntry ? renderEntryDetail(selectedEntry) : <div className="chart-empty">{t("journal.detail.noEntrySelected")}</div>}
        </section>
      </section>
    ),
    emotion: (
      <JournalBreakdownPanel
        emptyText={t("journal.breakdown.emotion.empty")}
        rows={analytics.emotionRows.map((row) => ({
          id: row.id,
          detail: `${row.count} ${t("journal.breakdown.entriesSuffix")} - ${formatRatioPercent(row.winRate)}`,
          label: row.label,
          meter: shareMeter(row.count, analytics.maxEmotionCount),
          note: `${t("journal.breakdown.avgPrefix")} ${formatMoney(row.averagePnl, currency)}`,
          tone: signedTone(row.pnl),
          value: formatMoney(row.pnl, currency),
        }))}
        subtitle={t("journal.breakdown.emotion.subtitle")}
        title={t("journal.breakdown.emotion.title")}
      />
    ),
    errors: (
      <JournalBreakdownPanel
        emptyText={t("journal.breakdown.errors.empty")}
        rows={analytics.errorRows.map((row) => ({
          color: row.color,
          id: row.id,
          detail: `${row.count} ${row.count === 1 ? t("journal.breakdown.entrySuffix") : t("journal.breakdown.entriesSuffix")}`,
          label: row.label,
          meter: shareMeter(row.count, analytics.maxErrorCount),
          note: `${formatPercent(row.share)} ${t("journal.breakdown.markedShareSuffix")}`,
          tone: row.severity === "severe" ? "negative" : "neutral",
          value: String(row.count),
        }))}
        subtitle={t("journal.breakdown.errors.subtitle")}
        title={t("journal.breakdown.errors.title")}
      />
    ),
    kpis: (
      <section className="metric-grid journal-kpi-grid" aria-label={t("journal.kpi.filteredAriaLabel")}>
        <MetricCard
          hint={`${analytics.stats.wins}W / ${analytics.stats.losses}L / ${analytics.stats.breakEven} BE`}
          icon={<Percent size={16} strokeWidth={2.2} />}
          label={t("journal.kpi.winrate")}
          tone={analytics.stats.winRate === null ? "neutral" : analytics.stats.winRate >= 0.5 ? "positive" : "negative"}
          value={formatRatioPercent(analytics.stats.winRate)}
        />
        <MetricCard
          hint={`${t("journal.kpi.avgWPrefix")} ${formatNullableMoney(analytics.stats.avgWin, currency)} / ${t("journal.kpi.avgLPrefix")} ${formatNullableMoney(
            analytics.stats.avgLoss,
            currency,
          )}`}
          icon={<Gauge size={16} strokeWidth={2.2} />}
          label={t("journal.kpi.profitFactor")}
          tone={profitFactorTone(analytics.stats.profitFactor)}
          value={formatProfitFactor(analytics.stats.profitFactor)}
        />
        <MetricCard
          hint={`${analytics.stats.closed} ${t("journal.kpi.tradesClosedSuffix")}`}
          icon={<TrendingUp size={16} strokeWidth={2.2} />}
          label={t("journal.kpi.avgWinLoss")}
          tone="neutral"
          value={`${formatNullableMoney(analytics.stats.avgWin, currency)} / ${formatNullableMoney(analytics.stats.avgLoss, currency)}`}
        />
      </section>
    ),
    pnl: <JournalPnlCurvePanel entries={filteredEntries} currency={currency} />,
    recent: (
      <JournalRecentTradesPanel
        accounts={accounts}
        accountById={accountById}
        currency={currency}
        entries={filteredEntries.slice(0, 5)}
        errorTypes={effectiveErrorTypes}
        firmNameById={firmNameById}
        onSelectEntry={setSelectedEntryId}
      />
    ),
    session: (
      <JournalBreakdownPanel
        emptyText={t("journal.breakdown.session.empty")}
        rows={analytics.sessionRows.map((row) => ({
          id: row.id,
          detail: `${row.wins}W / ${row.losses}L / ${row.breakEven} BE`,
          label: row.label,
          meter: winRateMeter(row.winRate),
          note: `${row.count} ${t("journal.breakdown.entriesSuffix")} - ${formatMoney(row.pnl, currency)}`,
          tone: row.winRate === null ? "neutral" : row.winRate >= 0.5 ? "positive" : "negative",
          value: formatRatioPercent(row.winRate),
        }))}
        subtitle={t("journal.breakdown.session.subtitle")}
        title={t("journal.breakdown.session.title")}
      />
    ),
    weekday: <JournalWeekdayPanel rows={analytics.weekdayRows} currency={currency} />,
  };

  const journalWidgetLabels: Record<JournalWidgetId, string> = {
    calendar: t("journal.widgetLabel.calendar"),
    emotion: t("journal.widgetLabel.emotion"),
    errors: t("journal.widgetLabel.errors"),
    kpis: t("journal.widgetLabel.kpis"),
    pnl: t("journal.widgetLabel.pnl"),
    recent: t("journal.widgetLabel.recent"),
    session: t("journal.widgetLabel.session"),
    weekday: t("journal.widgetLabel.weekday"),
  };

  const journalWidgetSizes: Record<JournalWidgetId, "full" | "wide" | "narrow" | "third"> = {
    calendar: "full",
    emotion: "third",
    errors: "third",
    kpis: "full",
    pnl: "wide",
    recent: "narrow",
    session: "third",
    weekday: "full",
  };

  return (
    <div className="firms-workspace">
      {journalMode !== "cockpit" && (
      <>
      <div className="dashboard-filter-bar">
        <FilterToggleButton
          active={hasActiveJournalFilters}
          isOpen={filtersOpen}
          onClick={() => setFiltersOpen((current) => !current)}
        />
      </div>
      {filtersOpen && (
      <section className="panel dashboard-filter-panel">
        <div className="view-filters">
          <label>
            <span>{t("journal.filter.account")}</span>
            <Select onChange={setAccountFilter} options={accountFilterOptions} value={accountFilter} />
          </label>
          <label>
            <span>{t("journal.filter.period")}</span>
            <Select
              onChange={(next) => setPeriodFilter(next as JournalPeriodFilter)}
              options={periodFilterOptions}
              value={periodFilter}
            />
          </label>
          <label>
            <span>{t("journal.filter.search")}</span>
            <input
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("journal.filter.searchPlaceholder")}
              type="search"
              value={searchText}
            />
          </label>
          <button className="secondary-action" onClick={resetJournalFilters} type="button">
            {t("journal.filter.reset")}
          </button>
        </div>
      </section>
      )}
      </>
      )}

      {journalMode === "cockpit" &&
        accountOverview && (
          <JournalAccountOverviewPanel overview={accountOverview} currency={currency} />
        )}

      {journalMode === "cockpit" && (
        <>
          <div className="journal-cockpit-toolbar">
            <div>
              <h2>{t("journal.cockpit.title")}</h2>
              <p>{t("journal.cockpit.subtitle")}</p>
            </div>
            <button className="secondary-action" onClick={() => setCustomizeOpen(true)} type="button">
              <LayoutGrid size={16} strokeWidth={2.2} />
              {t("journal.cockpit.customize")}
            </button>
          </div>
          <section className="journal-dashboard-widgets" aria-label={t("journal.cockpit.panelLabel")}>
            {dashboardLayout.order
              .filter((id) => !dashboardLayout.isHidden(id))
              .map((id) => (
                <div className="journal-dashboard-widget" data-widget-size={journalWidgetSizes[id]} key={id}>
                  {journalWidgetContent[id]}
                </div>
              ))}
          </section>
        </>
      )}

      {/* En modal, como en el legado (journalErrorManagerDialog). Incrustado ocupaba 1516px
          entre el resumen y la primera operacion: se entra aqui a mirar trades, no a
          configurar tipos de error, que se tocan de tarde en tarde. */}
      {errorManagerOpen && (
      <Modal onClose={() => setErrorManagerOpen(false)} subtitle={t("journal.errorManager.subtitle")} title={t("journal.errorManager.title")} width="wide">
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
              <span>{t("journal.errorManager.name")}</span>
              <input
                disabled={!canWrite || mutating}
                maxLength={34}
                onChange={(event) => setErrorTypeDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder={t("journal.errorManager.namePlaceholder")}
                type="text"
                value={errorTypeDraft.label}
              />
            </label>
            <div className="journal-error-color-field">
              <span>{t("journal.errorManager.color")}</span>
              <div className="journal-error-color-options">
                {errorColorOptions.map((color) => (
                  <button
                    aria-label={`${t("journal.errorManager.color")} ${color}`}
                    className={normalizeHexColor(errorTypeDraft.color) === color ? "active" : ""}
                    disabled={!canWrite || mutating}
                    key={color}
                    onClick={() => setErrorTypeDraft((current) => ({ ...current, color }))}
                    style={{ "--error-color": color } as CSSProperties}
                    type="button"
                  />
                ))}
                <input
                  aria-label={t("journal.errorManager.colorCustom")}
                  disabled={!canWrite || mutating}
                  onChange={(event) => setErrorTypeDraft((current) => ({ ...current, color: event.target.value }))}
                  type="color"
                  value={normalizeHexColor(errorTypeDraft.color) || "#64748b"}
                />
              </div>
            </div>
            <button className="primary-action" disabled={!canWrite || mutating || errorTypeDraft.label.trim().length < 2} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {editingErrorTypeId ? t("journal.errorManager.save") : t("journal.errorManager.create")}
            </button>
            {editingErrorTypeId && (
              <button className="ghost-action" disabled={mutating} onClick={resetErrorTypeForm} type="button">
                <X size={16} strokeWidth={2.2} />
                {t("common.cancel")}
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
                      {usage} {usage === 1 ? t("journal.errorManager.entrySuffix") : t("journal.errorManager.entriesSuffix")}
                      {!type.active ? ` ${t("journal.errorManager.hiddenSuffix")}` : ""}
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
                      {t("common.edit")}
                    </button>
                    <button
                      className="secondary-action"
                      disabled={!canWrite || mutating}
                      onClick={() => void handleToggleErrorType(type)}
                      type="button"
                    >
                      {type.active ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
                      {type.active ? t("journal.errorManager.hide") : t("journal.errorManager.restore")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </Modal>
      )}

      {entryModeOpen && (
        <Modal
          onClose={() => setEntryModeOpen(false)}
          subtitle={t("journal.entryMode.subtitle")}
          title={t("journal.entryMode.title")}
        >
          <div className="journal-entry-mode-help">
            <Info size={15} strokeWidth={2.2} />
            <span>{t("journal.entryMode.help")}</span>
          </div>
          <div className="journal-entry-mode-grid">
            <button
              className="journal-entry-mode-option"
              onClick={() => {
                setEntryModeOpen(false);
                setJournalMode("entryForm");
              }}
              type="button"
            >
              <Pencil size={20} strokeWidth={2.2} />
              <strong>{t("journal.entryMode.manual")}</strong>
              <span>{t("journal.entryMode.manualHint")}</span>
            </button>
            <button
              className="journal-entry-mode-option"
              disabled={!accounts.length}
              onClick={openImportDialog}
              title={accounts.length ? t("journal.entryMode.csvTitle") : t("journal.entryMode.csvBlocked")}
              type="button"
            >
              <FileUp size={20} strokeWidth={2.2} />
              <strong>{t("journal.entryMode.csv")}</strong>
              <span>{t("journal.entryMode.csvHint")}</span>
            </button>
          </div>
        </Modal>
      )}

      {importOpen && !importPreview && (
        <Modal onClose={closeImportFlow} subtitle={t("journal.import.dialogSubtitle")} title={t("journal.import.dialogTitle")}>
          <form
            className="entity-form resource-form-grid modal-form-grid journal-entry-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleImportAnalyze();
            }}
          >
            <label>
              <span>{t("journal.entryForm.account")}</span>
              <Select
                disabled={importing}
                onChange={setImportAccountId}
                options={accounts.map((account) => ({ label: account.name, value: account.id }))}
                value={importAccountId}
              />
            </label>
            <SelectField
              disabled={importing}
              label={t("journal.filter.session")}
              onChange={(value) => setImportSession(value as JournalTradingSession | "")}
              options={[{ label: t("journal.session.none"), value: "" }, ...sessionOptions]}
              value={importSession}
            />
            <label className="wide-field">
              <span>{t("journal.import.csvFile")}</span>
              <input
                accept=".csv,text/csv"
                disabled={importing}
                onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                required
                type="file"
              />
            </label>
            <div className="wide-field journal-import-note">
              <Info size={15} strokeWidth={2.2} />
              <span>{t("journal.import.note")}</span>
            </div>

            {importMessage && <p className={`mutation-message ${importMessage.type} wide-field`}>{importMessage.text}</p>}

            <div className="form-action-row">
              <button
                className="ghost-action"
                onClick={() => {
                  closeImportFlow();
                  setEntryModeOpen(true);
                }}
                type="button"
              >
                {t("journal.import.back")}
              </button>
              <button className="primary-action" disabled={importing || !importFile || !importAccountId} type="submit">
                <Check size={17} strokeWidth={2.2} />
                {importing ? t("journal.entryForm.importing") : t("journal.import.analyze")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {importPreview && (
        <Modal onClose={closeImportFlow} subtitle={t("journal.import.previewSubtitle")} title={t("journal.import.previewTitle")} width="wide">
          <div className="journal-detail-grid">
            <div>
              <dt>{t("journal.entryForm.account")}</dt>
              <dd>{accounts.find((item) => item.id === importAccountId)?.name || "-"}</dd>
            </div>
            <div>
              <dt>{t("journal.import.detected")}</dt>
              <dd>
                {importPreview.rawRows === importPreview.entries.length
                  ? `${importPreview.entries.length} ${t("journal.import.operations")}`
                  : `${importPreview.rawRows} ${t("journal.import.rowsGroupedInto")} ${importPreview.entries.length}`}
              </dd>
            </div>
          </div>
          <div className="journal-import-preview-list">
            {importPreview.entries.map((preview, index) => (
              <article className={`journal-import-preview-row ${signedTone(preview.input.pnl)}`} key={index}>
                <div>
                  <strong>
                    {preview.input.symbol}
                    <em className={`journal-card-direction ${preview.input.direction}`}>
                      {findOptionLabel(directionOptions, preview.input.direction)}
                    </em>
                  </strong>
                  <small>{preview.input.date}</small>
                </div>
                <strong className={signedTone(preview.input.pnl)}>{formatMoney(preview.input.pnl, currency)}</strong>
              </article>
            ))}
          </div>

          {importMessage && <p className={`mutation-message ${importMessage.type}`}>{importMessage.text}</p>}

          <div className="form-action-row">
            <button className="ghost-action" disabled={importing} onClick={() => setImportPreview(null)} type="button">
              {t("journal.import.back")}
            </button>
            <button className="primary-action" disabled={importing || !canWrite} onClick={() => void handleImportConfirm()} type="button">
              <Plus size={17} strokeWidth={2.2} />
              {importing
                ? t("common.saving")
                : `${t("journal.import.createEntriesPrefix")} ${importPreview.entries.length} ${t("journal.import.createEntriesSuffix")}`}
            </button>
          </div>
        </Modal>
      )}

      {journalMode === "entryForm" && (
      <Modal
        onClose={closeEntryForm}
        title={editingId ? t("journal.entryForm.editTitle") : t("journal.entryForm.newTitle")}
        width="wide"
      >
        <form
          className="entity-form resource-form-grid modal-form-grid journal-entry-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSaveEntry(draft, editingId);
            if (saved) closeEntryForm();
          }}
        >
          <label>
            <span>{t("journal.entryForm.date")}</span>
            <DatePicker
              clearable={false}
              disabled={!canWrite || mutating}
              onChange={(next) => setDraft((current) => ({ ...current, date: next }))}
              value={draft.date}
            />
          </label>
          <label>
            <span>{t("journal.entryForm.firm")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => setDraft((current) => ({ ...current, firmId: next, accountId: "" }))}
              options={entryFirmOptions}
              value={draft.firmId || ""}
            />
          </label>
          <label>
            <span>{t("journal.entryForm.account")}</span>
            <Select
              disabled={!canWrite || mutating}
              onChange={(next) => {
                const account = accounts.find((item) => item.id === next);
                setDraft((current) => ({
                  ...current,
                  accountId: next,
                  firmId: account?.firmId || current.firmId,
                }));
              }}
              options={entryAccountOptions}
              value={draft.accountId || ""}
            />
          </label>
          <SelectField
            disabled={!canWrite || mutating}
            label={t("journal.filter.emotion")}
            onChange={(value) => setDraft((current) => ({ ...current, emotion: value as JournalEmotion }))}
            options={emotionOptions}
            value={draft.emotion}
          />
          <label>
            <span>{t("journal.entryForm.symbol")}</span>
            <input
              disabled={!canWrite || mutating}
              maxLength={20}
              onChange={(event) => setDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
              placeholder={t("journal.entryForm.symbolPlaceholder")}
              required
              type="text"
              value={draft.symbol}
            />
          </label>
          <SelectField
            disabled={!canWrite || mutating}
            label={t("journal.filter.direction")}
            onChange={(value) => setDraft((current) => ({ ...current, direction: value as JournalDirection }))}
            options={directionOptions}
            value={draft.direction}
          />
          <SelectField
            disabled={!canWrite || mutating}
            label={t("journal.entryForm.discipline")}
            onChange={(value) => setDraft((current) => ({ ...current, discipline: Number(value) }))}
            options={disciplineOptions}
            value={String(draft.discipline)}
          />
          <SelectField
            disabled={!canWrite || mutating}
            label={t("journal.filter.session")}
            onChange={(value) => setDraft((current) => ({ ...current, tradingSession: value as JournalTradingSession }))}
            options={sessionOptions}
            value={draft.tradingSession}
          />
          <label className="wide-field">
            <span>{t("journal.entryForm.pnl")}</span>
            <span className="journal-money-input">
              <span>{currency === "USD" ? "$" : "€"}</span>
              <input
                disabled={!canWrite || mutating}
                inputMode="decimal"
                onChange={(event) => setDraft((current) => ({ ...current, pnl: Number(event.target.value) }))}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={draft.pnl}
              />
            </span>
          </label>
          <div className="wide-field journal-operation-media-field">
            <div className="journal-operation-media-toolbar">
              <span>{t("journal.entryForm.mediaTitle")}</span>
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
                  {t("journal.entryForm.mediaRemove")}
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
                  <img src={draft.operationUrl} alt={t("journal.media.captureAlt")} />
                  <span>
                    <ZoomIn size={15} strokeWidth={2.2} />
                    {t("journal.entryForm.mediaReplace")}
                  </span>
                </div>
              ) : (
                <div className="journal-operation-empty">
                  {draft.operationUrl ? <ExternalLink size={22} strokeWidth={2.2} /> : <ImagePlus size={24} strokeWidth={2.2} />}
                  <span>{draft.operationUrl ? t("journal.entryForm.mediaSavedLink") : t("journal.entryForm.mediaDropHint")}</span>
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
          <fieldset className="wide-field journal-errors-field">
            <legend>{t("journal.entryForm.errorsLegend")}</legend>
            <div className="journal-operation-media-toolbar">
              <span>{t("journal.entryForm.errorsHint")}</span>
              <button className="ghost-action compact-action" onClick={() => setErrorManagerOpen(true)} type="button">
                <Settings2 size={15} strokeWidth={2.2} />
                {t("journal.errorManager.configure")}
              </button>
            </div>
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
          </fieldset>
          <label className="wide-field">
            <span>{t("journal.entryForm.notes")}</span>
            <textarea
              disabled={!canWrite || mutating}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder={t("journal.entryForm.notesPlaceholder")}
              rows={4}
              value={draft.notes || ""}
            />
          </label>

          {mutationError && <p className="mutation-message error">{mutationError}</p>}
          {importMessage && <p className={`mutation-message ${importMessage.type}`}>{importMessage.text}</p>}

          <div className="form-action-row">
            <button className="ghost-action" onClick={closeEntryForm} type="button">
              {t("common.cancel")}
            </button>
            <button className="primary-action" disabled={!canWrite || mutating} type="submit">
              <Check size={17} strokeWidth={2.2} />
              {mutating ? t("common.saving") : editingId ? t("common.saveChanges") : t("journal.entryForm.create")}
            </button>
          </div>
        </form>
      </Modal>
      )}

      {(journalMode === "entries" || journalMode === "entryForm") && (
      <>
      {/* Sin tarjeta ni cabecera propia: cada entrada ya es su propia tarjeta
          (.journal-card lleva borde y sombra), envolverlas todas en una tarjeta mas
          era una tarjeta dentro de otra. Mismo criterio que .account-card-grid en
          Cuentas, que tampoco va dentro de un .panel. */}
      <section className="journal-gallery" aria-label={t("journal.list.title")}>
        {filteredEntries.map((entry) => (
          <article
            aria-label={`${entry.symbol} ${entry.date}`}
            className="journal-card"
            key={entry.id}
            onClick={() => setDetailEntryId(entry.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setDetailEntryId(entry.id);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="journal-card-media">
              {entry.operationUrl && isImageSource(entry.operationUrl) ? (
                <img alt={`${t("journal.media.captureAlt")} ${entry.symbol}`} src={entry.operationUrl} />
              ) : (
                <span className="is-placeholder">
                  <ImageIcon size={20} strokeWidth={2} />
                  {t("journal.gallery.noCapture")}
                </span>
              )}
            </div>
            <div className="journal-card-footer">
              <strong>
                <span>{entry.symbol}</span>
                <em className={`journal-card-direction ${entry.direction}`}>{findOptionLabel(directionOptions, entry.direction)}</em>
              </strong>
              <span className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</span>
            </div>
          </article>
        ))}
        {filteredEntries.length === 0 && (
          <article className="empty-panel inline-empty">
            <Plus size={22} strokeWidth={2.2} />
            <strong>{entries.length ? t("common.noResults") : t("journal.empty.none")}</strong>
            <span>{entries.length ? t("common.adjustFilters") : t("journal.empty.createFirst")}</span>
          </article>
        )}
      </section>
      </>
      )}

      {/* Editar y eliminar viven aqui, no en la tarjeta: multiplicados por cada entrada
          llenaban la galeria de botones, y son acciones que se deciden despues de mirar
          la operacion, no antes. */}
      {detailEntry && (
        <Modal hideTitle onClose={() => setDetailEntryId(undefined)} title={`${detailEntry.symbol} - ${detailEntry.date}`}>
          {renderEntryDetail(detailEntry)}
          <div className="form-action-row">
            <button
              className="card-delete"
              aria-label={t("common.delete")}
              disabled={!canWrite || mutating}
              onClick={() => {
                if (!window.confirm(t("journal.list.deleteConfirm"))) return;
                void onDeleteEntry(detailEntry.id).then((deleted) => {
                  if (deleted) setDetailEntryId(undefined);
                });
              }}
              title={t("common.delete")}
              type="button"
            >
              <Trash2 size={15} strokeWidth={2.2} />
            </button>
            <button
              className="primary-action"
              disabled={!canWrite || mutating}
              onClick={() => {
                setEditingId(detailEntry.id);
                setDraft({
                  date: detailEntry.date,
                  firmId: detailEntry.firmId || "",
                  accountId: detailEntry.accountId || "",
                  symbol: detailEntry.symbol,
                  direction: detailEntry.direction,
                  tradingSession: getEntryTradingSession(detailEntry) || "newYork",
                  sessionType: detailEntry.sessionType || "trading-day",
                  result: detailEntry.result || "neutral",
                  emotion: detailEntry.emotion,
                  discipline: detailEntry.discipline || 3,
                  pnl: detailEntry.pnl,
                  errors: getEntryErrors(detailEntry, effectiveErrorTypes),
                  operationUrl: detailEntry.operationUrl || "",
                  notes: detailEntry.notes || "",
                  lesson: detailEntry.lesson || "",
                });
                setDetailEntryId(undefined);
                setJournalMode("entryForm");
              }}
              type="button"
            >
              <Pencil size={16} strokeWidth={2.2} />
              {t("common.edit")}
            </button>
          </div>
        </Modal>
      )}

      {zoomImage &&
        createPortal(
          <div className="journal-image-zoom-overlay" role="dialog" aria-modal="true" aria-label={t("journal.zoom.label")}>
            <button className="journal-image-zoom-backdrop" onClick={() => setZoomImage(undefined)} type="button" />
            <div className="journal-image-zoom-card">
              <button className="icon-control compact-icon journal-image-zoom-close" onClick={() => setZoomImage(undefined)} type="button">
                <X size={18} strokeWidth={2.2} />
              </button>
              <img src={zoomImage} alt={t("journal.zoom.alt")} />
            </div>
          </div>,
          document.body,
        )}

      {customizeOpen && (
        <Modal
          onClose={() => setCustomizeOpen(false)}
          title={t("journal.customize.title")}
          subtitle={t("journal.customize.subtitle")}
        >
          <div className="journal-widget-customize-list">
            {dashboardLayout.order.map((id) => {
              const isHidden = dashboardLayout.isHidden(id);
              return (
                <label
                  className={`journal-widget-customize-row ${isHidden ? "is-hidden" : ""}`}
                  draggable
                  key={id}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromId = event.dataTransfer.getData("text/plain") as JournalWidgetId;
                    dashboardLayout.moveWidget(fromId, id);
                  }}
                >
                  <GripVertical size={16} strokeWidth={2.2} />
                  <span>{journalWidgetLabels[id]}</span>
                  <input checked={!isHidden} onChange={() => dashboardLayout.toggleHidden(id)} type="checkbox" />
                </label>
              );
            })}
          </div>
          <div className="form-action-row">
            <button className="ghost-action" onClick={dashboardLayout.resetLayout} type="button">
              {t("journal.customize.resetOrder")}
            </button>
            <button className="primary-action" onClick={() => setCustomizeOpen(false)} type="button">
              <Check size={17} strokeWidth={2.2} />
              {t("journal.customize.done")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

type CalendarDay = {
  count: number;
  date: string;
  firstEntryId?: string;
  inMonth: boolean;
  payoutCount: number;
  payoutGross: number;
  payoutNet: number;
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

type JournalDateRange = {
  from: string;
  to: string;
};

function JournalPnlCurvePanel({ currency, entries }: { currency: Currency; entries: JournalEntry[] }) {
  const t = useT();
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
          <h2>{t("journal.pnlCurve.title")}</h2>
          <p>{entries.length ? `${entries.length} ${t("journal.pnlCurve.subtitleSuffix")}` : t("journal.pnlCurve.subtitleEmpty")}</p>
        </div>
        <strong className={`chart-delta ${signedTone(finalValue)}`}>{formatMoney(finalValue, currency)}</strong>
      </div>
      {points.length > 0 ? (
        <>
          <div className="journal-pnl-chart-frame" role="img" aria-label={t("journal.pnlCurve.ariaLabel")}>
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
        <div className="chart-empty">{t("journal.pnlCurve.noData")}</div>
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
  const t = useT();
  const directionOptions = useMemo(() => getDirectionOptions(t), [t]);
  const sessionOptions = useMemo(() => getSessionOptions(t), [t]);

  return (
    <section className="panel journal-recent-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("journal.recent.title")}</h2>
          <p>{t("journal.recent.subtitle")}</p>
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
                <small>{formatTradingSessionLabel(entry, sessionOptions, t)}</small>
              </span>
              <span>
                <strong>{getAccountName(accounts, entry.accountId, t("journal.entryForm.noAccount"))}</strong>
                <small>{getEntryFirmName(entry, accountById, firmNameById, t)}</small>
              </span>
              <span>
                <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
                <small>{entryErrors.length ? `${entryErrors.length} ${t("journal.recent.errorsSuffix")}` : t("journal.recent.noErrors")}</small>
              </span>
            </button>
          );
        })}
        {entries.length === 0 && <div className="journal-breakdown-empty">{t("journal.recent.empty")}</div>}
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
  const t = useT();
  const hasData = rows.some((row) => row.count > 0);

  return (
    <section className="panel journal-breakdown-panel">
      <div className="panel-heading compact-heading">
        <div>
          <h2>{t("journal.weekday.title")}</h2>
          <p>{t("journal.weekday.subtitle")}</p>
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
                {row.count ? `${row.count} ${t("journal.weekday.opsSuffix")} - ${formatMoney(row.pnl, currency)}` : t("journal.weekday.noData")}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="journal-breakdown-empty">{t("journal.weekday.empty")}</div>
      )}
    </section>
  );
}

function buildJournalAnalytics(
  entries: JournalEntry[],
  errorTypes: JournalErrorType[],
  sessionOptions: Array<{ label: string; value: JournalTradingSession }>,
  emotionOptions: Array<{ label: string; value: JournalEmotion }>,
  weekdayLabels: string[],
): JournalAnalytics {
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
  const t = useT();
  if (!errors.length) {
    return <p className="journal-errors-empty-inline">{t("journal.errors.noneMarked")}</p>;
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
  const t = useT();
  return (
    <section className="panel journal-account-overview-panel">
      <div className="journal-account-overview-head">
        <div>
          <span>{t("journal.accountOverview.selectedAccount")}</span>
          <h2>{overview.accountName}</h2>
          <p>
            {overview.firmName || t("account.card.noFirm")} - {overview.baseLabel}
          </p>
        </div>
        <div className="journal-account-return">
          <span>{t("journal.accountOverview.return")}</span>
          <strong className={overview.returnRatio === null ? "neutral" : signedTone(overview.returnRatio)}>
            {overview.returnRatio === null ? "-" : formatSignedPercent(overview.returnRatio)}
          </strong>
        </div>
      </div>

      <div className="journal-account-overview-stats">
        <div>
          <span>{t("journal.accountOverview.balance")}</span>
          <strong>{formatMoney(overview.balance, currency)}</strong>
        </div>
        <div>
          <span>{t("journal.accountOverview.netPnl")}</span>
          <strong className={signedTone(overview.netPnl)}>{formatSignedMoney(overview.netPnl, currency)}</strong>
        </div>
        <div>
          <span>{t("journal.accountOverview.payouts")}</span>
          <strong className={overview.payouts ? "negative" : "neutral"}>
            {overview.payouts ? `-${formatMoney(overview.payouts, currency)}` : formatMoney(0, currency)}
          </strong>
        </div>
        <div>
          <span>{t("journal.accountOverview.base")}</span>
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

function buildJournalAccountOverview({
  account,
  currency,
  entries,
  firmNameById,
  movements,
  t,
}: {
  account?: TradingAccount;
  currency: Currency;
  entries: JournalEntry[];
  firmNameById: Map<string, string>;
  movements: Movement[];
  t: ReturnType<typeof useT>;
}): JournalAccountOverview | null {
  if (!account) return null;

  const accountEntries = entries.filter((entry) => entry.accountId === account.id);
  const base = account.size > 0 ? account.size : null;
  const netPnl = sumNumbers(accountEntries.map((entry) => entry.pnl));
  const payouts = sumNumbers(
    movements
      .filter((movement) => movement.category === "payout" && movement.accountId === account.id)
      .map(getPayoutGrossAmount),
  );
  const balance = (base ?? 0) + netPnl - payouts;
  const returnRatio = base ? netPnl / base : null;
  const todayPnl = sumNumbers(accountEntries.filter((entry) => entry.date === todayIso()).map((entry) => entry.pnl));

  return {
    accountName: account.name,
    balance,
    base,
    baseLabel: base ? `${t("journal.accountOverview.baseWithAmountPrefix")} ${formatMoney(base, currency)}` : t("journal.accountOverview.addSizeToCalc"),
    firmName: firmNameById.get(account.firmId) || "",
    netPnl,
    payouts,
    returnRatio,
    rules: [
      buildTargetRule(account.phaseTarget, netPnl, currency, t),
      buildEodDrawdownRule(account.maxDrawdown, base, accountEntries, netPnl, currency, t),
      buildDailyDrawdownRule(account.dailyDrawdown, todayPnl, currency, t),
    ],
  };
}

function buildTargetRule(target: number, netPnl: number, currency: Currency, t: ReturnType<typeof useT>): JournalAccountRule {
  if (!isPositiveAmount(target)) {
    return {
      hint: t("journal.rules.targetHintEmpty"),
      icon: "target",
      label: t("journal.rules.target"),
      meter: 0,
      status: t("journal.rules.noTarget"),
      tone: "neutral",
    };
  }

  const remaining = target - netPnl;
  const reached = remaining <= 0;
  return {
    hint: `${formatSignedMoney(netPnl, currency)} / ${formatMoney(target, currency)}`,
    icon: "target",
    label: t("journal.rules.target"),
    meter: clampPercent((netPnl / target) * 100),
    status: reached ? t("journal.rules.targetReached") : `${t("journal.rules.remainingPrefix")} ${formatMoney(Math.max(remaining, 0), currency)}`,
    tone: reached ? "positive" : "neutral",
  };
}

function buildEodDrawdownRule(
  amount: number,
  base: number | null,
  entries: JournalEntry[],
  pnl: number,
  currency: Currency,
  t: ReturnType<typeof useT>,
): JournalAccountRule {
  if (!isPositiveAmount(amount)) {
    return {
      hint: t("journal.rules.maxDrawdownHintEmpty"),
      icon: "drawdown",
      label: t("journal.rules.maxDrawdown"),
      meter: 0,
      status: t("journal.rules.noMaxDrawdown"),
      tone: "neutral",
    };
  }

  const model = getEodDrawdownModel(amount, base, entries, pnl);
  const percent = clampPercent((model.remaining / amount) * 100);
  const breached = model.remaining <= 0;
  return {
    hint: `${t("journal.rules.limitCurrentPrefix")} ${formatMoney(model.limit, currency)} - ${t("journal.rules.eodMaxPrefix")} ${formatMoney(model.highWatermark, currency)}`,
    icon: "drawdown",
    label: t("journal.rules.maxDrawdown"),
    meter: percent,
    status: breached ? t("journal.rules.limitExceeded") : `${t("journal.rules.remainingPrefix")} ${formatMoney(model.remaining, currency)}`,
    tone: breached || percent <= 25 ? "negative" : percent <= 50 ? "neutral" : "positive",
  };
}

function buildDailyDrawdownRule(amount: number, todayPnl: number, currency: Currency, t: ReturnType<typeof useT>): JournalAccountRule {
  if (!isPositiveAmount(amount)) {
    return {
      hint: t("journal.rules.dailyDrawdownHintEmpty"),
      icon: "drawdown",
      label: t("journal.rules.dailyDrawdown"),
      meter: 0,
      status: t("journal.rules.noDailyDrawdown"),
      tone: "neutral",
    };
  }

  const remaining = amount + todayPnl;
  const percent = clampPercent((remaining / amount) * 100);
  const breached = remaining <= 0;
  return {
    hint: `${t("journal.rules.todayPrefix")} ${formatSignedMoney(todayPnl, currency)} / -${formatMoney(amount, currency)}`,
    icon: "drawdown",
    label: t("journal.rules.dailyDrawdown"),
    meter: percent,
    status: breached ? t("journal.rules.limitExceeded") : `${t("journal.rules.remainingPrefix")} ${formatMoney(remaining, currency)}`,
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
  t: ReturnType<typeof useT>,
) {
  return firmNameById.get(entry.firmId || "") || firmNameById.get(accountById.get(entry.accountId)?.firmId || "") || t("account.card.noFirm");
}

function formatTradingSessionLabel(entry: JournalEntry, sessionOptions: Array<{ label: string; value: JournalTradingSession }>, t: ReturnType<typeof useT>) {
  const tradingSession = getEntryTradingSession(entry);
  return tradingSession ? findOptionLabel(sessionOptions, tradingSession) : t("journal.session.none");
}

function getEntryTradingSession(entry: JournalEntry): JournalTradingSession | "" {
  const legacyEntry = entry as JournalEntry & { session?: unknown; trading_session?: unknown };
  return normalizeEntryTradingSession(
    legacyEntry.tradingSession ?? legacyEntry.trading_session ?? legacyEntry.session,
  );
}

const journalTradingSessionValues: JournalTradingSession[] = ["asia", "london", "newYork", "londonNewYork", "other"];

function normalizeEntryTradingSession(value: unknown): JournalTradingSession | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (journalTradingSessionValues.includes(raw as JournalTradingSession)) return raw as JournalTradingSession;

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

function getPeriodDateRange(period: JournalPeriodFilter): JournalDateRange | null {
  const today = new Date();
  const todayKey = dateToIso(today);

  if (period === "current-month") {
    return { from: `${todayKey.slice(0, 7)}-01`, to: todayKey };
  }

  if (period === "last-30") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { from: dateToIso(start), to: todayKey };
  }

  if (period === "last-90") {
    const start = new Date(today);
    start.setDate(start.getDate() - 89);
    return { from: dateToIso(start), to: todayKey };
  }

  if (period === "year") {
    return { from: `${todayKey.slice(0, 4)}-01-01`, to: todayKey };
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

/* R = pnl / (tamano de la cuenta * 1%): el mismo riesgo fijo por operacion que ya usaba
   el legado (JOURNAL_DEFAULT_RISK_PERCENT), no un dato que se guarde por entrada. */
function formatRMultiple(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const formatted = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Math.abs(value));
  if (value > 0) return `+${formatted}R`;
  if (value < 0) return `-${formatted}R`;
  return "0,00R";
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

async function compressOperationImage(file: File, t: ReturnType<typeof useT>) {
  if (!file.type.startsWith("image/")) throw new Error(t("journal.media.mustBeImage"));

  const source = await readOperationImage(file, t);
  const scale = Math.min(1, operationImageMaxSize / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    closeOperationImage(source);
    throw new Error(t("journal.media.processError"));
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  closeOperationImage(source);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", operationImageQuality);
  });
  if (!blob) throw new Error(t("journal.media.compressError"));
  return blobToDataUrl(blob, t);
}

async function readOperationImage(file: File, t: ReturnType<typeof useT>): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return window.createImageBitmap(file);

  const dataUrl = await blobToDataUrl(file, t);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t("journal.media.readError")));
    image.src = dataUrl;
  });
}

function closeOperationImage(source: ImageBitmap | HTMLImageElement) {
  if ("close" in source) source.close();
}

function blobToDataUrl(blob: Blob, t: ReturnType<typeof useT>) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(t("journal.media.readError")));
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

function buildCalendarDays(month: string, entries: JournalEntry[], movements: Movement[]): CalendarDay[] {
  const safeMonth = normalizeMonth(month);
  const [year, monthNumber] = safeMonth.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const grouped = new Map<
    string,
    { count: number; firstEntryId?: string; payoutCount: number; payoutGross: number; payoutNet: number; pnl: number }
  >();

  entries.forEach((entry) => {
    const current = grouped.get(entry.date) || { count: 0, payoutCount: 0, payoutGross: 0, payoutNet: 0, pnl: 0 };
    grouped.set(entry.date, {
      count: current.count + 1,
      firstEntryId: current.firstEntryId || entry.id,
      payoutCount: current.payoutCount,
      payoutGross: current.payoutGross,
      payoutNet: current.payoutNet,
      pnl: current.pnl + entry.pnl,
    });
  });

  movements.forEach((movement) => {
    if (movement.category !== "payout" || !movement.accountId) return;
    const current = grouped.get(movement.date) || { count: 0, payoutCount: 0, payoutGross: 0, payoutNet: 0, pnl: 0 };
    grouped.set(movement.date, {
      ...current,
      payoutCount: current.payoutCount + 1,
      payoutGross: current.payoutGross + getPayoutGrossAmount(movement),
      payoutNet: current.payoutNet + movement.amount,
    });
  });

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateToIso(date);
    const item = grouped.get(key) || { count: 0, payoutCount: 0, payoutGross: 0, payoutNet: 0, pnl: 0 };
    return {
      count: item.count,
      date: key,
      firstEntryId: item.firstEntryId,
      inMonth: key.startsWith(safeMonth),
      payoutCount: item.payoutCount,
      payoutGross: item.payoutGross,
      payoutNet: item.payoutNet,
      pnl: item.pnl,
    };
  });
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = normalizeMonth(month).split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string, language: Language) {
  const [year, monthNumber] = normalizeMonth(month).split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { month: "long", year: "numeric" }).format(date);
}

function normalizeMonth(month: string) {
  return /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
}

function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
      <Select disabled={disabled} onChange={onChange} options={options} value={value} />
    </label>
  );
}
