import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent, type ReactElement } from "react";
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
  LayoutGrid,
  ListChecks,
  Pencil,
  Percent,
  Plus,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Target,
  Trash2,
  TrendingUp,
  X,
  ZoomIn,
} from "lucide-react";
import { DatePicker } from "./DatePicker";
import { FilterToggleButton } from "./FilterToggle";
import { InfoHint } from "./InfoHint";
import { MetricCard } from "./MetricCard";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { buildAreaPath, buildSmoothPath } from "../lib/chartPath";
import { colorForSeverity } from "../lib/journalErrors";
import { useChartZoomHover } from "../hooks/useChartZoomHover";
import { useJournalDashboardLayout, type JournalWidgetId } from "../hooks/useJournalDashboardLayout";
import { useI18n, useT } from "../lib/i18n/context";
import type { Language } from "../lib/i18n/context";
import {
  formatMoney,
  formatMoneyCompactSigned,
  formatPercent,
  formatPercentCompact,
  getDisciplineScale,
  getPayoutGrossAmount,
  getSelectableAccounts,
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
  onSelectedAccountIdChange: (accountId: string) => void;
  onNewEntryRequestHandled?: () => void;
  onSaveEntry: (input: JournalEntryInput, entryId?: string) => Promise<boolean>;
  onSaveErrorType: (input: JournalErrorTypeInput, typeId?: string) => Promise<boolean>;
  onDeleteErrorType: (typeId: string) => Promise<boolean>;
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

/* Solo para el widget de barras "Dias de semana", no para las cabeceras del calendario
   (que si necesitan los 7 dias). El legado limita ese widget a Lun-Vie de forma fija,
   en cualquier contexto (renderJournalWeekdayWinrate en app.js ni siquiera itera sabado
   y domingo) — no es una adaptacion al ancho, es la propia informacion que enseña: casi
   nadie opera fin de semana, asi que dos barras vacias con "Sin datos" eran ruido
   incluso cuando el widget tenia toda la fila para el solo. Ademas de fiel al legado,
   es lo que hace que cada barra tenga sitio real ahora que comparte fila con Balance y
   Winrate por sesion (span 3 de 12): a 7 columnas cada barra media 30px y el texto
   salia cortado; a 5 sube a ~50px. */
function getWeekdayBarLabels(t: ReturnType<typeof useT>) {
  return [t("journal.weekday.mon"), t("journal.weekday.tue"), t("journal.weekday.wed"), t("journal.weekday.thu"), t("journal.weekday.fri")];
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
  onSelectedAccountIdChange,
  onNewEntryRequestHandled,
  onSaveErrorType,
  onSaveEntry,
  onDeleteErrorType,
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
  /* La tarjeta pulsada en la galeria (o en Ultimas operaciones, o en un dia del
     calendario a traves de renderEntryDetail): todas abren el mismo modal. */
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
  /* Texto crudo del campo de P&L. Ver el comentario del propio input. */
  const [pnlText, setPnlText] = useState("");
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
  /* De menos a mas grave, que es como se lee la escala de color que las acompana. */
  const severityChoices = useMemo(
    () =>
      [
        { label: t("journal.errors.severity.minor"), value: "minor" },
        { label: t("journal.errors.severity.moderate"), value: "moderate" },
        { label: t("journal.errors.severity.severe"), value: "severe" },
      ] as Array<{ label: string; value: JournalErrorSeverity }>,
    [t],
  );
  const weekdayLabels = useMemo(() => getWeekdayLabels(t), [t]);
  const weekdayBarLabels = useMemo(() => getWeekdayBarLabels(t), [t]);
  const periodFilterOptions = useMemo(() => getPeriodFilterOptions(t), [t]);
  const accountFilterOptions = useMemo(
    () => [
      { label: t("common.all"), value: "all" },
      ...getSelectableAccounts(accounts, accountFilter).map((account) => ({ label: account.name, value: account.id })),
    ],
    [accountFilter, accounts, t],
  );
  /* Mismas cuentas que accountFilterOptions, pero con la opcion "Todas las cuentas" en
     vez de "Todas": este selector vive suelto en la barra de herramientas del cockpit,
     sin la etiqueta "Cuenta" que lo acompaña en el panel de filtros de Entradas, asi
     que necesita bastarse solo para decir de que trata. */
  const cockpitAccountOptions = useMemo(
    () => [
      { label: t("journal.cockpit.allAccounts"), value: "all" },
      ...getSelectableAccounts(accounts, selectedAccountId).map((account) => ({ label: account.name, value: account.id })),
    ],
    [accounts, selectedAccountId, t],
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
    () =>
      getSelectableAccounts(accounts, draft.accountId).filter(
        (account) => !draft.firmId || account.firmId === draft.firmId,
      ),
    [accounts, draft.accountId, draft.firmId],
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
  const detailEntry = detailEntryId ? filteredEntries.find((entry) => entry.id === detailEntryId) : undefined;
  /* Mismo formato que day.date (YYYY-MM-DD) para poder comparar directo. Sale del mes
     visible, no memoizado: es una comparacion de string barata y solo se usa al pintar
     la rejilla, no merece la pena arrastrar un valor que caducaria pasada medianoche. */
  const todayDate = new Date().toISOString().slice(0, 10);
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth, filteredEntries, movements),
    [filteredEntries, movements, visibleMonth],
  );
  /* Las 42 celdas se parten en las seis semanas que ya forman, para poder pintar el
     resumen semanal del legado en una octava columna. El total de la semana suma el P&L
     de las entradas y resta el bruto de los payouts, igual que hace cada celda de dia.
     El total del mes cuenta solo los dias del mes visible (inMonth), no las celdas de
     relleno de los meses vecinos, que si entran en su semana pero no en el mes. */
  const { calendarWeeks, monthTotal, monthEntries } = useMemo(() => {
    const weeks = Array.from({ length: 6 }, (_, index) => {
      const days = calendarDays.slice(index * 7, index * 7 + 7);
      return {
        days,
        entries: days.reduce((total, day) => total + day.count, 0),
        key: days[0]?.date ?? `semana-${index}`,
        pnl: days.reduce((total, day) => total + day.pnl - day.payoutGross, 0),
        /* Dias con al menos una operacion, no dias con algun movimiento: un payout sin
           trades ese dia no cuenta como "dia operado". */
        tradedDays: days.filter((day) => day.count > 0).length,
      };
    });
    const delMes = calendarDays.filter((day) => day.inMonth);
    return {
      calendarWeeks: weeks,
      monthEntries: delMes.reduce((total, day) => total + day.count, 0),
      monthTotal: delMes.reduce((total, day) => total + day.pnl - day.payoutGross, 0),
    };
  }, [calendarDays]);
  const analytics = useMemo(
    () => buildJournalAnalytics(filteredEntries, effectiveErrorTypes, sessionOptions, weekdayBarLabels),
    [effectiveErrorTypes, filteredEntries, sessionOptions, weekdayBarLabels],
  );
  const visibleMonthLabel = useMemo(() => formatMonthLabel(visibleMonth, language), [visibleMonth, language]);

  /* Repartos de las dos barras divididas del cockpit y R medio de ganadoras y
     perdedoras. Van juntos porque los tres salen del mismo recorrido de entradas y solo
     los usa el widget de KPIs. Cuando no hay nada cerrado se reparte al 50% en vez de
     dejar la barra vacia: una barra a cero se lee como "todo perdidas", que es un dato
     falso, y media y media se lee como lo que es, que no hay dato. */
  const { avgLossR, avgRatio, avgShare, avgWinR, grossShare } = useMemo(() => {
    const { avgLoss, avgWin, grossLoss, grossProfit } = analytics.stats;
    const brutoTotal = grossProfit + grossLoss;
    const mediaTotal = (avgWin || 0) + (avgLoss || 0);
    /* R se deriva, no se lee: entry.rMultiple llega siempre a 0 desde db.ts (la columna
       no existe en Supabase) y usarlo daba 0,00R en las dos medias. Se calcula igual que
       en el panel de detalle — el riesgo es el 1% del tamano de la cuenta — y se saltan
       las entradas cuya cuenta no se encuentra o no tiene tamano, que no dan un R real. */
    const rDe = (signo: 1 | -1) => {
      const valores = filteredEntries
        .filter((entry) => (signo === 1 ? entry.pnl > 0 : entry.pnl < 0))
        .map((entry) => {
          const account = accountById.get(entry.accountId);
          const riesgo = account && account.size > 0 ? account.size * 0.01 : 0;
          return riesgo > 0 ? entry.pnl / riesgo : null;
        })
        .filter((value): value is number => value !== null && Number.isFinite(value));
      return valores.length ? valores.reduce((total, value) => total + value, 0) / valores.length : null;
    };
    return {
      avgLossR: rDe(-1),
      /* avgLoss llega como magnitud positiva (grossLoss ya es el valor absoluto), asi
         que la ratio es la division directa y no hay que darle la vuelta al signo. */
      avgRatio: avgLoss && avgLoss > 0 && avgWin !== null ? avgWin / avgLoss : null,
      avgShare: mediaTotal > 0 ? ((avgWin || 0) / mediaTotal) * 100 : 50,
      avgWinR: rDe(1),
      grossShare: brutoTotal > 0 ? (grossProfit / brutoTotal) * 100 : 50,
    };
  }, [accountById, analytics.stats, filteredEntries]);

  const resetForm = () => {
    setDraft(createEmptyJournalInput());
    setPnlText("");
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
    setImportAccountId((current) => current || getSelectableAccounts(accounts, undefined)[0]?.id || "");
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
        setPnlText(String(preview.input.pnl));
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
                  onClick={() => setDetailEntryId(item.id)}
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
      <section className="panel journal-calendar-panel">
        <div className="panel-heading">
          {/* El navegador de mes sustituye al titulo de toda la vida ("Calendario"): en
              vez de un rotulo fijo con los controles apretados en una fila aparte
              (calendar-nav-row, ya retirada), el propio mes es el titulo, grande y con
              aire, con las flechas a los lados. "Cambiar de mes de izquierda a derecha"
              pasa a ser lo primero que se ve del panel, no un control secundario. */}
          <div className="calendar-nav-heading">
            <button className="icon-control" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))} title={t("journal.calendar.prevMonth")} type="button">
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <div className="calendar-nav-label">
              <h2>{visibleMonthLabel}</h2>
              <InfoHint text={t("journal.calendar.subtitleSuffix")} />
            </div>
            <button className="icon-control" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))} title={t("journal.calendar.nextMonth")} type="button">
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
            <button className="secondary-action" onClick={() => setVisibleMonth(new Date().toISOString().slice(0, 7))} type="button">
              {t("journal.calendar.today")}
            </button>
          </div>
          {/* Mismo bloque etiqueta-arriba/cifra-abajo que "VARIACION" en Evolucion de
              capital (CapitalCurve, chart-delta-block/chart-delta). --text-2xl, el
              tamaño que usa el resto de la app para el numero mas importante de la
              vista (journal-detail-hero > strong, topbar h1). */}
          <span className="chart-delta-block">
            <small>{t("journal.calendar.monthTotal")}</small>
            <strong className={`chart-delta ${signedTone(monthTotal)}`}>{formatMoney(monthTotal, currency)}</strong>
          </span>
        </div>
        <div className="journal-calendar-grid">
          {weekdayLabels.map((day) => (
            <span className="journal-weekday" key={day}>
              {day}
            </span>
          ))}
          <span className="journal-weekday is-week">{t("journal.calendar.weekColumn")}</span>
          {calendarWeeks.map((week) => (
            <Fragment key={week.key}>
              {week.days.map((day) => (
            <button
              aria-label={`${day.date}: ${day.count} ${t("journal.calendar.entriesAriaSuffix")}${day.payoutCount ? `, ${day.payoutCount} ${t("journal.calendar.payoutsAriaSuffix")} ${formatMoney(day.payoutGross, currency)}` : ""}${day.date === todayDate ? `, ${t("journal.calendar.today")}` : ""}`}
              className={`journal-day ${day.inMonth ? "" : "muted"} ${day.firstEntryId || day.payoutCount ? "has-entries" : ""} ${signedTone(day.pnl)} ${day.payoutCount ? "payout" : ""}`}
              disabled={!day.firstEntryId}
              key={day.date}
              /* Abre la previsualizacion de la primera entrada de ese dia en el mismo
                 modal que usan la galeria y Ultimas operaciones (ver detailEntryId) — no
                 navega a Entradas, es justo lo contrario de b13f3f3: ese commit lo saco
                 de aqui, este lo vuelve a meter porque el usuario pidio explicitamente
                 poder pulsar un dia para ver un vistazo rapido sin salir del calendario. */
              onClick={() => setDetailEntryId(day.firstEntryId)}
              type="button"
            >
              <span>
                {/* Tercer intento tras feedback: ni anillo en toda la celda ni punto
                    suelto — un circulo relleno alrededor del propio numero, como en el
                    ejemplo que paso el usuario. */}
                {day.date === todayDate ? (
                  <em className="journal-day-today-badge">{Number(day.date.slice(-2))}</em>
                ) : (
                  Number(day.date.slice(-2))
                )}
              </span>
              <strong>
                {day.count
                  ? formatMoneyCompactSigned(day.pnl, currency)
                  : day.payoutCount
                    ? formatMoneyCompactSigned(-day.payoutGross, currency)
                    : "-"}
              </strong>
              <small>
                {day.count ? `${day.count} ${t("journal.calendar.opsSuffix")}` : ""}
                {day.count && day.payoutCount ? " · " : ""}
                {day.payoutCount ? `${t("journal.calendar.payoutPrefix")} ${formatMoneyCompactSigned(-day.payoutGross, currency)}` : ""}
              </small>
            </button>
              ))}
              <div className={`journal-week-summary ${week.entries ? signedTone(week.pnl) : "is-empty"}`}>
                <span>{t("journal.calendar.weekPrefix")}</span>
                <strong>{week.entries ? formatMoney(week.pnl, currency) : formatMoney(0, currency)}</strong>
                <small>{`${week.tradedDays} ${t("journal.calendar.tradedDaysSuffix")}`}</small>
              </div>
            </Fragment>
          ))}
        </div>
      </section>
    ),
    errors: <JournalErrorsPanel rows={analytics.errorRows} />,
    kpis: (
      <section className="metric-grid journal-kpi-grid" aria-label={t("journal.kpi.filteredAriaLabel")}>
        {/* Antes era la cifra grande de la cabecera de "P&L acumulado" (el grafico, mas
            abajo). Se traslada aqui como cuarta tarjeta, a la izquierda de Winrate, para
            que el total este junto al resto de KPIs y no repetido en dos sitios. */}
        <section className="panel journal-total-panel">
          <div className="panel-heading compact-heading">
            <div>
              <h2>{t("journal.kpi.totalPnl")}</h2>
            </div>
          </div>
          <strong className={`journal-total-value ${signedTone(analytics.stats.netPnl)}`}>
            {formatMoney(analytics.stats.netPnl, currency)}
          </strong>
        </section>
        <JournalWinrateGaugePanel
          breakEven={analytics.stats.breakEven}
          losses={analytics.stats.losses}
          winRate={analytics.stats.winRate}
          wins={analytics.stats.wins}
        />
        {/* Las dos llevan cifra titular y pie con los dos operandos de esa cifra. Antes
            Profit factor no tenia pie y Avg win / loss no tenia cifra, asi que de las
            tres tarjetas ninguna se parecia a otra: la cifra grande caia a una altura
            distinta en cada una y la tercera arrancaba directamente con la barra.
            Profit factor ensena su bruto ganador y perdedor, que es de donde sale el
            1,72, igual que la de al lado ensena las dos medias de las que sale su
            ratio. Es la misma relacion —una division y sus dos terminos— contada dos
            veces del mismo modo. */}
        <JournalSplitBarPanel
          leftLabel={t("journal.kpi.profit")}
          positiveShare={grossShare}
          rightLabel={t("journal.kpi.loss")}
          title={t("journal.kpi.profitFactor")}
          value={formatProfitFactor(analytics.stats.profitFactor)}
          valueTone={profitFactorTone(analytics.stats.profitFactor)}
        >
          <div className="journal-split-figures">
            <span className="positive">
              <strong>{formatMoney(analytics.stats.grossProfit, currency)}</strong>
            </span>
            <span className="negative">
              <strong>{analytics.stats.grossLoss > 0 ? `-${formatMoney(analytics.stats.grossLoss, currency)}` : formatMoney(0, currency)}</strong>
            </span>
          </div>
        </JournalSplitBarPanel>
        <JournalSplitBarPanel
          leftLabel={t("journal.kpi.avgWin")}
          positiveShare={avgShare}
          rightLabel={t("journal.kpi.avgLoss")}
          title={t("journal.kpi.avgWinLoss")}
          value={formatProfitFactor(avgRatio)}
          valueTone={profitFactorTone(avgRatio)}
        >
          <div className="journal-split-figures">
            <span className="positive">
              <strong>{formatNullableMoney(analytics.stats.avgWin, currency)}</strong>
              <small>{formatSignedR(avgWinR)}</small>
            </span>
            <span className="negative">
              <strong>{analytics.stats.avgLoss === null ? "-" : `-${formatNullableMoney(analytics.stats.avgLoss, currency)}`}</strong>
              <small>{formatSignedR(avgLossR)}</small>
            </span>
          </div>
        </JournalSplitBarPanel>
      </section>
    ),
    pnl: <JournalPnlCurvePanel entries={filteredEntries} currency={currency} />,
    discipline: <JournalDisciplinePanel entries={filteredEntries} />,
    recent: (
      <JournalRecentTradesPanel currency={currency} entries={filteredEntries.slice(0, 5)} onSelectEntry={setDetailEntryId} />
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
    discipline: t("journal.widgetLabel.discipline"),
    errors: t("journal.widgetLabel.errors"),
    kpis: t("journal.widgetLabel.kpis"),
    pnl: t("journal.widgetLabel.pnl"),
    recent: t("journal.widgetLabel.recent"),
    session: t("journal.widgetLabel.session"),
    weekday: t("journal.widgetLabel.weekday"),
  };

  const journalWidgetSizes: Record<JournalWidgetId, "full" | "wide" | "narrow" | "half" | "quarter"> = {
    /* "wide" y no "full": vuelve a compartir fila, ahora con Ultimas operaciones en vez
       de con Errores (ver journalDashboardWidgetIds). Misma pareja que en el legado. */
    calendar: "wide",
    /* La misma fila que en el legado: Errores y Disciplina a la mitad cada uno. */
    discipline: "half",
    errors: "half",
    kpis: "full",
    /* La misma fila que en el legado: Balance a la mitad y las otras dos a un cuarto
       cada una (half + quarter + quarter = 12). Ver journalDashboardWidgetIds. */
    pnl: "half",
    recent: "narrow",
    session: "quarter",
    weekday: "quarter",
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
          {/* Sin titulo "Cockpit" ni subtitulo: repetian lo que ya dice el h1 de la
              pagina ("Journal - Dashboard") y el item activo del sidebar. Los controles
              se quedan alineados a la derecha como el resto de acciones de cabecera. */}
          <div className="journal-cockpit-toolbar">
            {/* selectedAccountId/onSelectedAccountIdChange son globales (ver App.tsx):
                la misma cuenta activa que ya filtran Cuentas y Movimientos, asi que
                elegir una aqui tambien la deja puesta al navegar a esas vistas — igual
                que el legado, donde "Cuenta" en el dashboard del Journal es el mismo
                selector que en Cuentas/Movimientos. Al elegir una cuenta aparece encima
                JournalAccountOverviewPanel (balance, net P&L, reglas de la cuenta), que
                ya estaba construido y solo le faltaba este disparador. */}
            <div className="journal-cockpit-account-filter">
              <Select onChange={onSelectedAccountIdChange} options={cockpitAccountOptions} value={selectedAccountId} />
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
              const position = Number.isFinite(errorTypeDraft.position) ? errorTypeDraft.position : fallbackPosition;
              const severity = errorTypeDraft.severity ?? "moderate";
              const saved = await onSaveErrorType(
                {
                  active: errorTypeDraft.active ?? true,
                  /* El color ya no se elige: sale de la gravedad. Ademas de simplificar el
                     formulario, arregla de raiz que cambiar el color cambiara la gravedad
                     sin querer, porque ahora la relacion va en el otro sentido. Y como el
                     color sigue perteneciendo a las paletas del legado, si alguna vez se
                     edita el tipo desde alli —que no escribe severity y la deja en NULL—
                     la deduccion por color sigue dando la misma respuesta. */
                  color: colorForSeverity(severity, position),
                  label,
                  position,
                  severity,
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
              <span>{t("journal.errorManager.severity")}</span>
              <div className="journal-error-severity-options">
                {severityChoices.map((choice) => {
                  const activa = (errorTypeDraft.severity ?? "moderate") === choice.value;
                  const muestra = colorForSeverity(choice.value, errorTypeDraft.position ?? 0);
                  return (
                    <button
                      className={activa ? "active" : ""}
                      disabled={!canWrite || mutating}
                      key={choice.value}
                      onClick={() => setErrorTypeDraft((current) => ({ ...current, severity: choice.value }))}
                      style={{ "--error-color": muestra } as CSSProperties}
                      type="button"
                    >
                      <i />
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              <small className="journal-error-severity-hint">{t("journal.errorManager.severityHint")}</small>
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
                    <strong>
                      {type.label}
                      {!type.active && <em>{t("journal.errorManager.hiddenBadge")}</em>}
                    </strong>
                    <span>
                      {usage} {usage === 1 ? t("journal.errorManager.entrySuffix") : t("journal.errorManager.entriesSuffix")}
                    </span>
                  </div>
                  {/* Solo iconos: con dos botones rotulados por fila, quince tipos
                      convertian la lista en un muro de texto repetido. El nombre del
                      error, que es lo que se busca, quedaba en segundo plano. */}
                  <div className="row-actions">
                    <button
                      className="icon-control compact-icon"
                      disabled={!canWrite || mutating}
                      onClick={() => {
                        setEditingErrorTypeId(type.id);
                        setErrorTypeDraft({
                          active: type.active,
                          color: type.color,
                          label: type.label,
                          position: type.position,
                          /* getJournalErrorDefinition ya resuelve la severidad: usa la
                             guardada si la hay y si no la deduce, asi que al editar un tipo
                             antiguo el selector aparece marcado donde toca en vez de caer
                             siempre en "moderado". */
                          severity: getJournalErrorDefinitionFor(effectiveErrorTypes, type.id).severity,
                        });
                      }}
                      title={t("common.edit")}
                      type="button"
                    >
                      <Pencil size={15} strokeWidth={2.2} />
                    </button>
                    <button
                      className="icon-control compact-icon"
                      disabled={!canWrite || mutating}
                      onClick={() => void handleToggleErrorType(type)}
                      title={type.active ? t("journal.errorManager.hide") : t("journal.errorManager.restore")}
                      type="button"
                    >
                      {type.active ? <EyeOff size={15} strokeWidth={2.2} /> : <Eye size={15} strokeWidth={2.2} />}
                    </button>
                    {/* Borrar solo si no lo usa ninguna entrada: las entradas guardan el id
                        del tipo, asi que borrar uno en uso dejaria esas entradas mostrando
                        un UUID donde deberia ir el nombre del error. Para esos esta ocultar,
                        que es el boton de al lado. El title explica el porque en vez de
                        dejar un boton apagado sin motivo. */}
                    <button
                      className="card-delete"
                      disabled={!canWrite || mutating || usage > 0}
                      onClick={() => {
                        if (!window.confirm(t("journal.errorManager.deleteConfirm"))) return;
                        void onDeleteErrorType(type.id);
                      }}
                      title={
                        usage > 0
                          ? `${t("journal.errorManager.inUsePrefix")} ${usage} ${usage === 1 ? t("journal.errorManager.inUseEntry") : t("journal.errorManager.inUseEntries")}. ${t("journal.errorManager.archiveInstead")}`
                          : t("journal.errorManager.delete")
                      }
                      type="button"
                    >
                      <Trash2 size={15} strokeWidth={2.2} />
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
            <InfoHint text={t("journal.entryMode.help")} />
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
                options={getSelectableAccounts(accounts, importAccountId).map((account) => ({ label: account.name, value: account.id }))}
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
              <InfoHint text={t("journal.import.note")} />
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
      <Modal onClose={closeEntryForm} title={editingId ? t("journal.entryForm.editTitle") : t("journal.entryForm.newTitle")}>
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
              {/* Lo que se ve es este texto, no draft.pnl: con el numero suelto, el 0
                  inicial se quedaba delante de lo que escribias ("0200"), y al teclear
                  el "-" de una perdida Number("-") daba NaN y borraba el signo antes de
                  poder seguir. El texto deja escribir estados intermedios ("-", "1.")
                  y draft.pnl solo se actualiza cuando ya son un numero. */}
              <input
                disabled={!canWrite || mutating}
                inputMode="decimal"
                onChange={(event) => {
                  const raw = event.target.value.replace(",", ".");
                  /* Se descarta la pulsacion que no deje un numero a medio escribir en
                     vez de recortarla, para no reordenar lo que el usuario ve. */
                  if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
                  setPnlText(raw);
                  const parsed = Number(raw);
                  setDraft((current) => ({ ...current, pnl: raw && Number.isFinite(parsed) ? parsed : 0 }));
                }}
                placeholder="0.00"
                type="text"
                value={pnlText}
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
            {/* El boton va dentro de la leyenda, no debajo: asi la cabecera del recuadro
                es una sola linea con el titulo a un lado y la accion al otro, en vez de
                un boton suelto flotando sobre el borde. */}
            <legend>
              <span>{t("journal.entryForm.errorsLegend")}</span>
              <button className="ghost-action compact-action" onClick={() => setErrorManagerOpen(true)} type="button">
                <Settings2 size={15} strokeWidth={2.2} />
                {t("journal.errorManager.configure")}
              </button>
            </legend>
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
              rows={3}
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
                setPnlText(String(detailEntry.pnl));
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
  errorRows: JournalErrorRow[];
  maxErrorCount: number;
  sessionRows: JournalSummaryRow[];
  stats: JournalStats;
  weekdayRows: JournalSummaryRow[];
};

type JournalDateRange = {
  from: string;
  to: string;
};

/* Errores con el anillo del legado: el total en el centro y la lista al lado con su
   severidad. El anillo se dibuja con un solo circle por tramo y stroke-dasharray sobre
   la misma circunferencia, desplazando cada uno con stroke-dashoffset acumulado — es lo
   que evita tener que calcular arcos con trigonometria. Va rotado -90 grados para que
   el primer tramo arranque arriba y no a las tres en punto.
   La lista conserva el orden que ya trae errorRows (por severidad y despues por
   frecuencia), que es el mismo del legado. */
function JournalErrorsPanel({ rows }: { rows: JournalAnalytics["errorRows"] }) {
  const t = useT();
  /* Que tramo del anillo es cada error solo se puede saber por el color, y comparar dos
     rojos parecidos a ojo no es leer un dato. Al senalar un tramo o su fila de la leyenda
     se resaltan los dos a la vez y el centro pasa a mostrar ese error en vez del total. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const total = rows.reduce((suma, row) => suma + row.count, 0);
  const radio = 52;
  const circunferencia = 2 * Math.PI * radio;
  const severityLabel: Record<JournalErrorSeverity, string> = {
    minor: t("journal.errors.severity.minor"),
    moderate: t("journal.errors.severity.moderate"),
    severe: t("journal.errors.severity.severe"),
  };

  let acumulado = 0;
  const tramos = rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const inicio = acumulado;
      const largo = total > 0 ? (row.count / total) * circunferencia : 0;
      acumulado += largo;
      return { color: row.color, fin: acumulado, id: row.id, inicio };
    });
  const activeRow = activeId === null ? null : rows.find((row) => row.id === activeId) || null;
  /* Cada tramo se dibuja como su propio arco (<path>, comando A) con los dos extremos
     calculados en punto exacto, no como un <circle> completo enmascarado con
     stroke-dasharray. Eso ultimo se probo primero y dejaba una muesca real: un
     circulo entero es basicamente un anillo transparente salvo su porcion, apilados
     los siete unos encima de otros, y el reparto del "sobrante" en la frontera entre
     dos colores dependia de mas cosas de las que un simple mask deberia depender (el
     orden de pintado, el grosor al pasar el cursor). Con un arco independiente por
     tramo esa clase entera de problema desaparece: cada segmento es una forma
     autocontenida con sus propios dos extremos, sin nada que enmascarar ni que un
     vecino pueda recortar. El angulo se calcula directamente aqui (posicion/radio -
     90°) en vez de con el <g transform="rotate(-90 64 64)"> de antes, que ya no hace
     falta. El tramo activo se sigue pintando el ultimo por si acaso, pero ya no es la
     pieza que sostiene la correccion. */
  const tramosPintado =
    activeId === null ? tramos : [...tramos.filter((tramo) => tramo.id !== activeId), ...tramos.filter((tramo) => tramo.id === activeId)];

  return (
    <section className="panel journal-errors-panel">
      <div className="panel-heading">
        <div className="panel-title-row">
          <h2>{t("journal.breakdown.errors.title")}</h2>
          <InfoHint text={t("journal.breakdown.errors.subtitle")} />
        </div>
      </div>
      {total === 0 ? (
        <div className="chart-empty">{t("journal.breakdown.errors.empty")}</div>
      ) : (
        <div className="journal-errors-body">
          <div className="journal-errors-donut" role="img" aria-label={`${total} ${t("journal.errors.totalSuffix")}`}>
            <svg viewBox="0 0 128 128">
              {tramosPintado.map((tramo) => (
                <path
                  className={`journal-errors-arc ${activeId === null || activeId === tramo.id ? "" : "is-dimmed"}`}
                  key={tramo.id}
                  d={arcoDonut(64, 64, radio, tramo.inicio, tramo.fin)}
                  fill="none"
                  onPointerEnter={() => setActiveId(tramo.id)}
                  onPointerLeave={() => setActiveId(null)}
                  stroke={tramo.color}
                  strokeWidth={activeId === tramo.id ? 26 : 20}
                />
              ))}
            </svg>
            <div className="journal-errors-donut-center">
              <strong>{activeRow ? activeRow.count : total}</strong>
              <small>
                {activeRow
                  ? activeRow.label
                  : total === 1
                    ? t("journal.errors.totalSuffixOne")
                    : t("journal.errors.totalSuffix")}
              </small>
            </div>
          </div>
          <ul className="journal-errors-legend">
            {rows.map((row) => (
              <li
                className={`${activeId === row.id ? "is-active" : ""} ${activeId !== null && activeId !== row.id ? "is-dimmed" : ""}`}
                key={row.id}
                onPointerEnter={() => setActiveId(row.id)}
                onPointerLeave={() => setActiveId(null)}
              >
                <i style={{ background: row.color }} />
                <span>{row.label}</span>
                <em className={`severity-${row.severity}`}>{severityLabel[row.severity]}</em>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* Disciplina a lo largo del tiempo, como en el legado. Mismo armazon que la curva de
   P&L (misma caja, misma rejilla, buildSmoothPath) para que las dos graficas del
   cockpit se lean como la misma familia; lo que cambia es el eje Y, que aqui no arranca
   en cero sino en 1, porque la escala de disciplina es 1-5 (o 1-10 si alguna entrada
   viene de un import con esa escala, que es lo que resuelve getDisciplineScale). Un
   suelo en 0 aplastaria todo el recorrido util contra la mitad de arriba. */
function JournalDisciplinePanel({ entries }: { entries: JournalEntry[] }) {
  const t = useT();
  const width = 760;
  const height = 260;
  const padding = { bottom: 42, left: 48, right: 26, top: 32 };
  const { language } = useI18n();
  const escala = getDisciplineScale(entries);
  const allPoints = useMemo(
    () =>
      [...entries]
        .filter((entry) => Number.isFinite(entry.discipline) && entry.discipline > 0)
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((entry) => ({ date: entry.date, value: entry.discipline })),
    [entries],
  );
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const { activeIndex, frameRef, isZoomed, onPointerMove, reset, setActiveIndex, visibleCount, visibleStart } =
    useChartZoomHover({ chartWidth, paddingLeft: padding.left, totalPoints: allPoints.length, width });
  const points = allPoints.slice(visibleStart, visibleStart + visibleCount);
  const step = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  /* El eje se queda anclado a la escala completa (1..escala) incluso con zoom: aqui el
     rango no es libre como en P&L, son los cinco niveles de disciplina, y reescalarlos a
     la ventana haria que un 3 pareciera un maximo. */
  const rango = escala - 1 || 1;
  const scaledPoints = points.map((point, index) => ({
    date: point.date,
    value: point.value,
    x: padding.left + index * step,
    y: height - padding.bottom - ((point.value - 1) / rango) * chartHeight,
  }));
  const path = buildSmoothPath(scaledPoints);
  const media = points.length ? points.reduce((total, point) => total + point.value, 0) / points.length : null;
  const safeActiveIndex = activeIndex !== null && activeIndex < scaledPoints.length ? activeIndex : null;
  const activeScaledPoint = safeActiveIndex === null ? null : scaledPoints[safeActiveIndex];
  const activePoint = safeActiveIndex === null ? null : points[safeActiveIndex];
  /* Mismo motivo que en la curva de P&L, con una fila menos: aqui el tooltip son fecha y
     valor. Marco de 220px reales y viewBox de 260, asi que el suelo va algo mas bajo. */
  const tooltipPosition = activeScaledPoint
    ? {
        left: `${(clamp(activeScaledPoint.x, padding.left + 66, width - padding.right - 66) / width) * 100}%`,
        top: `${(Math.max(112, activeScaledPoint.y - 12) / height) * 100}%`,
      }
    : undefined;

  return (
    <section className="panel journal-discipline-panel">
      <div className="panel-heading">
        <div className="panel-title-row">
          <h2>{t("journal.discipline.title")}</h2>
          <InfoHint text={points.length ? t("journal.discipline.subtitle") : t("journal.discipline.subtitleEmpty")} />
        </div>
        <div className="chart-heading-side">
          {media === null ? null : (
            <strong className="chart-delta neutral">{`${media.toFixed(1)}/${escala}`}</strong>
          )}
          {isZoomed && (
            <button className="chart-reset-zoom" onClick={reset} type="button">
              <RotateCcw size={13} strokeWidth={2.4} />
              {t("capitalCurve.viewAll")}
            </button>
          )}
        </div>
      </div>
      {points.length > 0 ? (
        <>
          <div
            className="journal-pnl-chart-frame is-interactive"
            ref={frameRef}
            role="img"
            aria-label={t("journal.discipline.ariaLabel")}
            onDoubleClick={reset}
            onPointerLeave={() => setActiveIndex(null)}
            onPointerMove={(event) => onPointerMove(event, scaledPoints)}
          >
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
              {[0, 0.25, 0.5, 0.75, 1].map((position) => {
                const y = padding.top + chartHeight * position;
                return (
                  <line className="chart-axis muted" key={`disc-h-${position}`} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                );
              })}
              <path className="journal-discipline-chart-line" d={path} />
              {/* El legado marca cada operacion con su punto y se dejan aunque haya muchas:
                  con 87 entradas caen a ~8px unas de otras, que es justo lo que hace
                  legible que la linea sube y baja operacion a operacion y no por tramos.
                  El radio baja a 2 para que a esa densidad no se toquen entre si. El tope
                  alto corta solo el caso patologico de miles de entradas. */}
              {scaledPoints.length <= 400 &&
                scaledPoints.map((point, index) => (
                  <circle className="journal-discipline-chart-point" key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="2" />
                ))}
              {activeScaledPoint && (
                <line
                  className="chart-hover-line"
                  x1={activeScaledPoint.x}
                  x2={activeScaledPoint.x}
                  y1={padding.top}
                  y2={height - padding.bottom}
                />
              )}
            </svg>
            <span className="journal-chart-axis-top">{`${escala}/${escala}`}</span>
            <span className="journal-chart-axis-bottom">{`1/${escala}`}</span>
            {activeScaledPoint && (
              <span
                className="chart-dot is-active"
                style={{ left: `${(activeScaledPoint.x / width) * 100}%`, top: `${(activeScaledPoint.y / height) * 100}%` }}
              />
            )}
            {activeScaledPoint && activePoint && tooltipPosition && (
              <div className="chart-hover-card" style={tooltipPosition}>
                <span>{formatFullDate(activePoint.date, language)}</span>
                <em>
                  <i>{t("journal.discipline.title")}</i>
                  <strong>{`${activePoint.value}/${escala}`}</strong>
                </em>
              </div>
            )}
          </div>
          <div className="journal-chart-footer">
            <span>{points[0].date}</span>
            <span>{points.at(-1)?.date}</span>
          </div>
        </>
      ) : (
        <div className="chart-empty">{t("journal.discipline.subtitleEmpty")}</div>
      )}
    </section>
  );
}

function JournalPnlCurvePanel({ currency, entries }: { currency: Currency; entries: JournalEntry[] }) {
  const t = useT();
  const { language } = useI18n();
  const width = 760;
  const height = 320;
  const padding = { bottom: 42, left: 48, right: 26, top: 32 };
  const allPoints = useMemo(() => buildJournalPnlPoints(entries), [entries]);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const { activeIndex, frameRef, isZoomed, onPointerMove, reset, setActiveIndex, visibleCount, visibleStart } =
    useChartZoomHover({ chartWidth, paddingLeft: padding.left, totalPoints: allPoints.length, width });
  /* La escala se recalcula sobre la ventana visible y no sobre el total: con zoom puesto,
     escalar contra el maximo global dejaria el tramo ampliado aplastado en una franja
     estrecha, que es justo lo contrario de lo que se pide al hacer zoom. */
  const points = allPoints.slice(visibleStart, visibleStart + visibleCount);
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
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
  const safeActiveIndex = activeIndex !== null && activeIndex < scaledPoints.length ? activeIndex : null;
  const activeScaledPoint = safeActiveIndex === null ? null : scaledPoints[safeActiveIndex];
  const activePoint = safeActiveIndex === null ? null : points[safeActiveIndex];
  /* P&L del dia: la curva es acumulada, asi que la variacion de un punto es su valor
     menos el del anterior. Es el segundo dato del tooltip del legado. */
  const activeDelta =
    safeActiveIndex === null
      ? null
      : (points[safeActiveIndex]?.value ?? 0) - (safeActiveIndex > 0 ? points[safeActiveIndex - 1].value : 0);
  /* El tooltip se ancla con translate(-50%, -100%), o sea que crece hacia arriba desde el
     punto, y el marco recorta (overflow: hidden). Con tres filas mide 121px reales sobre
     un marco de 286, que en unidades del viewBox (alto 320) son ~135: ese es el suelo que
     hay que reservar o la fecha se queda fuera. Medido: con 60 se cortaban 38px. */
  const tooltipPosition = activeScaledPoint
    ? {
        left: `${(clamp(activeScaledPoint.x, padding.left + 74, width - padding.right - 74) / width) * 100}%`,
        top: `${(Math.max(140, activeScaledPoint.y - 12) / height) * 100}%`,
      }
    : undefined;

  return (
    <section className="panel journal-pnl-curve-panel">
      <div className="panel-heading">
        <div className="panel-title-row">
          <h2>{t("journal.pnlCurve.title")}</h2>
          <InfoHint text={entries.length ? `${entries.length} ${t("journal.pnlCurve.subtitleSuffix")}` : t("journal.pnlCurve.subtitleEmpty")} />
        </div>
        {/* La cifra grande del total se fue a su propia tarjeta en la fila de KPIs
            (journal-total-panel, a la izquierda de Winrate): mostrarla aqui tambien era
            el mismo dato dos veces, una vez ya como tarjeta destacada. */}
        {isZoomed && (
          <div className="chart-heading-side">
            {/* Sin lupas: el zoom es con la rueda. El boton solo sale con zoom puesto,
                para no dejar sin salida a quien no descubra la rueda. Igual que en
                CapitalCurve. */}
            <button className="chart-reset-zoom" onClick={reset} type="button">
              <RotateCcw size={13} strokeWidth={2.4} />
              {t("capitalCurve.viewAll")}
            </button>
          </div>
        )}
      </div>
      {points.length > 0 ? (
        <>
          <div
            className="journal-pnl-chart-frame is-interactive"
            ref={frameRef}
            role="img"
            aria-label={t("journal.pnlCurve.ariaLabel")}
            onDoubleClick={reset}
            onPointerLeave={() => setActiveIndex(null)}
            onPointerMove={(event) => onPointerMove(event, scaledPoints)}
          >
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="journal-pnl-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(139, 92, 246, 0.34)" />
                  <stop offset="68%" stopColor="rgba(139, 92, 246, 0.12)" />
                  <stop offset="100%" stopColor="rgba(124, 58, 237, 0)" />
                </linearGradient>
              </defs>
              {/* Sin rejilla: ni lineas horizontales ni verticales, a peticion expresa
                  (antes tenia las cinco de cada, igual que CapitalCurve antes de que se
                  le quitaran las verticales). Solo queda la linea base (el cero real),
                  que no es decorativa: separa visualmente lo que esta en positivo de lo
                  que esta en negativo. */}
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
              {activeScaledPoint && (
                <line
                  className="chart-hover-line"
                  x1={activeScaledPoint.x}
                  x2={activeScaledPoint.x}
                  y1={padding.top}
                  y2={height - padding.bottom}
                />
              )}
            </svg>
            {lastScaledPoint && (
              <span
                className={`chart-value-badge ${signedTone(finalValue)}`}
                style={{ left: `${(lastScaledPoint.x / width) * 100}%`, top: `${(lastScaledPoint.y / height) * 100}%` }}
              >
                {formatMoney(finalValue, currency)}
              </span>
            )}
            {/* El punto activo va en HTML y no como <circle>: con preserveAspectRatio
                "none" las escalas X e Y difieren y un circulo saldria ovalado. */}
            {activeScaledPoint && (
              <span
                className="chart-dot is-active"
                style={{ left: `${(activeScaledPoint.x / width) * 100}%`, top: `${(activeScaledPoint.y / height) * 100}%` }}
              />
            )}
            {activeScaledPoint && activePoint && tooltipPosition && (
              <div className="chart-hover-card" style={tooltipPosition}>
                <span>{formatFullDate(activePoint.date, language)}</span>
                <em>
                  <i>{t("journal.pnlCurve.tooltipTotal")}</i>
                  <strong className={signedTone(activePoint.value)}>{formatMoney(activePoint.value, currency)}</strong>
                </em>
                <em>
                  <i>{t("journal.pnlCurve.tooltipDay")}</i>
                  <strong className={signedTone(activeDelta ?? 0)}>{formatMoney(activeDelta ?? 0, currency)}</strong>
                </em>
              </div>
            )}
          </div>
          {/* Solo las dos fechas: el importe central repetia el mismo dato que ya lleva
              la insignia de la esquina superior derecha de la curva (chart-value-badge),
              y encima en el eje de fechas se leia como una tercera fecha. */}
          <div className="chart-footer">
            <span>{points[0]?.date}</span>
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
  currency,
  entries,
  onSelectEntry,
}: {
  currency: Currency;
  entries: JournalEntry[];
  onSelectEntry: (entryId: string) => void;
}) {
  const t = useT();
  const { language } = useI18n();
  const directionOptions = useMemo(() => getDirectionOptions(t), [t]);

  return (
    <section className="panel journal-recent-panel">
      <div className="panel-heading">
        <div className="panel-title-row">
          <h2>{t("journal.recent.title")}</h2>
          <InfoHint text={t("journal.recent.subtitle")} />
        </div>
      </div>
      <div className="journal-recent-list">
        {entries.map((entry) => (
          <button className="journal-recent-row" key={entry.id} onClick={() => onSelectEntry(entry.id)} type="button">
            <span className="journal-recent-row-copy">
              <span className="journal-recent-row-heading">
                <span className="journal-recent-row-symbol">{entry.symbol}</span>
                <em className={`journal-card-direction ${entry.direction}`}>{findOptionLabel(directionOptions, entry.direction)}</em>
              </span>
              <small className="journal-recent-row-date">{formatJournalRecentDate(entry.date, language)}</small>
            </span>
            <strong className={signedTone(entry.pnl)}>{formatMoney(entry.pnl, currency)}</strong>
          </button>
        ))}
        {entries.length === 0 && <div className="journal-breakdown-empty">{t("journal.recent.empty")}</div>}
      </div>
    </section>
  );
}

/* Mismo criterio que formatFullDate: "Martes, 01/09/2026", dia de la semana en letra y
   fecha corta, para que cada trade reciente se lea sin tener que ir a la ficha. El orden
   dia/mes solo cambia en ingles (mes/dia), igual que en el legado. */
function formatJournalRecentDate(value: string, language: Language) {
  const date = parseLocalDate(value);
  if (!date) return value;
  const weekday = new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { weekday: "long" }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateLabel = language === "en" ? `${month}/${day}/${date.getFullYear()}` : `${day}/${month}/${date.getFullYear()}`;
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dateLabel}`;
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
        <div className="panel-title-row">
          <h2>{title}</h2>
          <InfoHint text={subtitle} />
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

/* Gauge semicircular de winrate, como el del legado. El arco se dibuja con un solo
   path y stroke-dasharray: la longitud del semicirculo es PI*r, asi que el tramo verde
   mide winRate*PI*r y el resto queda en rojo por debajo. Se usa SVG y no canvas (que es
   lo que hace app.js) porque el resto de graficos de React ya son SVG y asi hereda los
   tokens de color sin tener que releerlos en JS. */
function JournalWinrateGaugePanel({
  breakEven,
  losses,
  winRate,
  wins,
}: {
  breakEven: number;
  losses: number;
  winRate: number | null;
  wins: number;
}) {
  const t = useT();
  const radius = 52;
  const arco = Math.PI * radius;
  const proporcion = winRate === null ? 0 : Math.min(1, Math.max(0, winRate));

  return (
    <section className="panel journal-gauge-panel">
      <div className="panel-heading compact-heading">
        <div>
          <h2>{t("journal.kpi.winrate")}</h2>
        </div>
      </div>
      <strong className={`journal-gauge-value ${winRate === null ? "neutral" : winRate >= 0.5 ? "positive" : "negative"}`}>
        {formatRatioPercent(winRate)}
      </strong>
      <div className="journal-gauge-arc">
        <svg viewBox="0 0 128 72" aria-hidden="true">
          <path
            className="gauge-track"
            d={`M 12 64 A ${radius} ${radius} 0 0 1 116 64`}
            fill="none"
            strokeLinecap="round"
            strokeWidth="10"
          />
          <path
            className="gauge-fill"
            d={`M 12 64 A ${radius} ${radius} 0 0 1 116 64`}
            fill="none"
            strokeDasharray={`${arco * proporcion} ${arco}`}
            strokeLinecap="round"
            strokeWidth="10"
          />
        </svg>
      </div>
      <div className="journal-gauge-counts">
        <span className="positive">{wins}</span>
        <span className="neutral">{breakEven}</span>
        <span className="negative">{losses}</span>
      </div>
    </section>
  );
}

/* Barra dividida verde/rojo con una etiqueta a cada extremo. La usan Profit factor
   (reparto bruto ganado vs bruto perdido) y Avg win/loss (media de ganancia vs media de
   perdida), que en el legado se ven igual salvo por lo que cuelga debajo. */
function JournalSplitBarPanel({
  children,
  leftLabel,
  positiveShare,
  rightLabel,
  title,
  value,
  valueTone,
}: {
  children?: ReactElement | null;
  leftLabel: string;
  positiveShare: number;
  rightLabel: string;
  title: string;
  value?: string;
  valueTone?: string;
}) {
  return (
    <section className="panel journal-split-panel">
      <div className="panel-heading compact-heading">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      {value ? <strong className={`journal-split-value ${valueTone || "neutral"}`}>{value}</strong> : null}
      <div className="journal-split-bar" aria-hidden="true">
        <i className="positive" style={{ width: `${positiveShare}%` }} />
        <i className="negative" style={{ width: `${100 - positiveShare}%` }} />
      </div>
      <div className="journal-split-labels">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      {children}
    </section>
  );
}

function JournalWeekdayPanel({ currency, rows }: { currency: Currency; rows: JournalSummaryRow[] }) {
  const t = useT();
  const hasData = rows.some((row) => row.count > 0);

  return (
    <section className="panel journal-breakdown-panel">
      <div className="panel-heading compact-heading">
        <div className="panel-title-row">
          <h2>{t("journal.weekday.title")}</h2>
          <InfoHint text={t("journal.weekday.subtitle")} />
        </div>
      </div>
      {hasData ? (
        <div className="journal-weekday-bars">
          {/* Sin el detalle (operaciones y dinero) como texto visible: en el legado
              tampoco lo lleva aqui, solo cifra y dia — ese detalle va en el "title"
              (tooltip nativo), igual que journalWeekdayWinrateBarHtml en app.js.
              Comparte fila con Balance y Winrate por sesion (span 3 de 12, ~45px por
              barra), y ahi ni el formato con decimales cabe: "55,56 %" seguia
              desbordando incluso en la letra mas pequeña de la escala. La cifra
              visible pasa a formatPercentCompact (sin decimales); el dato completo, con
              decimales, se queda en el title.
              La cifra flota sobre su barra (position: absolute en .weekday-track strong)
              en vez de venir debajo en una tarjeta propia, igual que el legado: el mismo
              barHeight fija la altura de la barra y el "bottom" de la cifra, asi que la
              una sigue a la otra sin duplicar el calculo. */}
          {rows.map((row) => {
            const winRateLabel = row.winRate === null ? "-" : formatPercent(row.winRate);
            const winRateLabelCompact = row.winRate === null ? "-" : formatPercentCompact(row.winRate);
            const barHeight = winRateMeter(row.winRate);
            const detail = row.count
              ? `${row.count} ${t("journal.weekday.opsSuffix")} - ${formatMoney(row.pnl, currency)}`
              : t("journal.weekday.noData");
            return (
              <div className="journal-weekday-bar" key={row.id} title={`${row.label}: ${winRateLabel} - ${detail}`}>
                <div className="weekday-track">
                  <strong style={{ bottom: `calc(${barHeight}% + 7px)` }}>{winRateLabelCompact}</strong>
                  <i aria-hidden="true" style={{ height: `${barHeight}%` }} />
                </div>
                <span>{row.label}</span>
              </div>
            );
          })}
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
  const weekdayRows = weekdayLabels.map((label, index) => ({
    id: String(index),
    label,
    ...summarizeJournalEntries(entries.filter((entry) => getWeekdayIndex(entry.date) === index)),
  }));
  const errorRows = buildJournalErrorRows(entries, errorTypes);
  const bestSession =
    [...sessionRows].sort((left, right) => right.pnl - left.pnl || (right.winRate ?? -1) - (left.winRate ?? -1))[0] ??
    null;

  return {
    bestSession,
    errorRows,
    maxErrorCount: errorRows.reduce((max, row) => Math.max(max, row.count), 0),
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

/* R con signo explicito y dos decimales, como en el legado ("+1,10R" / "-0,69R"). El
   signo positivo se escribe a mano porque toLocaleString solo pone el negativo, y aqui
   el "+" es informacion: separa de un vistazo la media de ganadoras de la de perdedoras
   cuando las dos van una al lado de la otra. */
function formatSignedR(value: number | null) {
  if (value === null) return "-";
  const texto = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
  return `${value > 0 ? "+" : ""}${texto}R`;
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

/* "posicion" es la distancia recorrida sobre la circunferencia (mismas unidades que
   "circunferencia" en JournalErrorsPanel), no un angulo. El -Math.PI/2 hace que
   posicion 0 caiga en las 12, igual que hacia antes el <g transform="rotate(-90 64
   64)"> del circulo enmascarado; el resto avanza en sentido horario porque en SVG el
   eje Y crece hacia abajo, asi que un angulo creciente con cos/sin gira a la derecha
   en pantalla. */
function puntoEnAnillo(cx: number, cy: number, radio: number, posicion: number) {
  const angulo = posicion / radio - Math.PI / 2;
  return { x: cx + radio * Math.cos(angulo), y: cy + radio * Math.sin(angulo) };
}

/* El arco de cada tramo del donut de errores, como su propio <path> con dos extremos
   exactos (comando A), no como un circulo entero enmascarado con stroke-dasharray.
   Ver el comentario grande en JournalErrorsPanel para el porque del cambio. */
function arcoDonut(cx: number, cy: number, radio: number, inicio: number, fin: number) {
  const p1 = puntoEnAnillo(cx, cy, radio, inicio);
  const p2 = puntoEnAnillo(cx, cy, radio, fin);
  const anguloGrados = ((fin - inicio) / (2 * Math.PI * radio)) * 360;
  const arcoGrande = anguloGrados > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${radio} ${radio} 0 ${arcoGrande} 1 ${p2.x} ${p2.y}`;
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

/* Fecha larga para el tooltip ("27 jul 2026" en el legado). Mismo criterio que
   formatMonthLabel de aqui abajo; el mediodia evita que la zona horaria corra el dia. */
function formatFullDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
