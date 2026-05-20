const LEGACY_STORAGE_KEYS = ["finix:v1", "prop-firm-tracker:v1"];
const LEGACY_THEME_STORAGE_KEYS = ["finix:theme", "prop-firm-tracker:theme"];
const STORAGE_KEY = "trazza:v1";
const THEME_STORAGE_KEY = "trazza:theme";
const DASHBOARD_PRIVACY_STORAGE_KEY = "trazza:dashboard-privacy";
const PILLAR_STORAGE_KEY = "trazza:pillar";
const JOURNAL_VIEW_STORAGE_KEY = "trazza:journal-view";
const LOCAL_MIGRATION_BACKUP_KEY = "trazza:local-backup-before-cloud";
const LOCAL_MIGRATED_KEY = "trazza:local-migrated-to-cloud";
const SUPABASE_URL = "https://sfdxbchjvhcdnjlpuffg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZHhiY2hqdmhjZG5qbHB1ZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzUyMDYsImV4cCI6MjA5MzU1MTIwNn0.hYqL43T7yGc2WYCaNCpI78VaKYh9mgYO3mnrkclVp5g";
const EURO = "EUR";

const categoryLabels = {
  challenge: "Compra challenge",
  reset: "Reset",
  activation: "Activacion",
  subscription: "Mensualidad",
  platform: "Plataforma",
  commission: "Comision",
  payout: "Payout",
  refund: "Refund",
  other: "Otro",
};

const expenseCategories = ["challenge", "reset", "activation", "subscription", "platform", "commission", "other"];
const incomeCategories = ["payout", "refund", "other"];

const statusLabels = {
  active: "Activa",
  passed: "Pasada",
  funded: "Fondeada",
  failed: "Fallada",
  closed: "Cerrada",
};

const journalSessionLabels = {
  "trading-day": "Sesion trading",
  evaluation: "Evaluacion",
  funded: "Fondeada",
  "payout-day": "Payout day",
  "news-day": "News day",
  review: "Revision",
  other: "Otro",
};

const journalResultLabels = {
  good: "Buen dia",
  neutral: "Neutral",
  bad: "Mal dia",
};

const journalDirectionLabels = {
  long: "Long",
  short: "Short",
};

const journalEmotionLabels = {
  calm: "Calmado",
  focused: "Enfocado",
  anxious: "Ansioso",
  impatient: "Impaciente",
  fomo: "FOMO",
  revenge: "Revenge",
  tired: "Cansado",
  other: "Otro",
};

const defaultJournalErrorTypes = Object.freeze([
  { id: "earlyClose", label: "Cerrar pronto", color: "#3b82f6", position: 0, active: true },
  { id: "tooMuchRisk", label: "Demasiado riesgo", color: "#ef4444", position: 1, active: true },
  { id: "badStopMove", label: "Mover SL mal", color: "#f5b700", position: 2, active: true },
  { id: "tooLittleRisk", label: "Poco riesgo", color: "#34a853", position: 3, active: true },
  { id: "poorSetup", label: "Setup pobre", color: "#ff6b00", position: 4, active: true },
]);

const journalErrorColorPalette = Object.freeze([
  "#3b82f6",
  "#ef4444",
  "#f5b700",
  "#34a853",
  "#ff6b00",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#eab308",
  "#10b981",
  "#f43f5e",
  "#0ea5e9",
  "#8b5cf6",
  "#22c55e",
  "#d946ef",
  "#64748b",
]);

function cloneDefaultJournalErrorTypes() {
  return defaultJournalErrorTypes.map((type) => ({ ...type }));
}

const defaultState = {
  firms: [],
  accounts: [],
  transactions: [],
  journalEntries: [],
  journalErrorTypes: cloneDefaultJournalErrorTypes(),
};

const sectionPillars = {
  overview: "tracker",
  firms: "tracker",
  accounts: "tracker",
  transactions: "tracker",
  journal: "journal",
};

const pillarDefaultSections = {
  tracker: "overview",
  journal: "journal",
};

let state = loadState();
let confirmHandler = null;
let currentSession = null;
let currentUser = null;
let cloudLoading = false;
let authMode = "login";
let activePillar = getInitialPillar();
let activeSection = pillarDefaultSections[activePillar] || "overview";
let dashboardPrivacyHidden = getInitialDashboardPrivacy();
let journalView = getInitialJournalView();
let journalCalendarMonth = today().slice(0, 7);
let journalSelectedDate = "";
let journalDashboardLayoutFrame = 0;
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const NET_CHART_MIN_VISIBLE_POINTS = 6;
const NET_CHART_PAN_STEP = 0.12;
const JOURNAL_CHART_MIN_VISIBLE_POINTS = 6;
const JOURNAL_CHART_PAN_STEP = 0.12;
const JOURNAL_OPERATION_IMAGE_MAX_SIZE = 1200;
const JOURNAL_OPERATION_IMAGE_QUALITY = 0.82;
const DASHBOARD_PRIVACY_MASK = "••••••";

const netChartState = {
  dragStartView: null,
  dragStartX: 0,
  dragging: false,
  fullSeries: [],
  hoverIndex: null,
  model: null,
  pointer: null,
  pointerId: null,
  redrawFrame: 0,
  seriesKey: "",
  userRange: false,
  viewEnd: 0,
  viewStart: 0,
};

function createJournalTimeChartState() {
  return {
    dragStartView: null,
    dragStartX: 0,
    dragging: false,
    fullSeries: [],
    hoverIndex: null,
    model: null,
    pointer: null,
    pointerId: null,
    redrawFrame: 0,
    seriesKey: "",
    userRange: false,
    viewEnd: 0,
    viewStart: 0,
  };
}

const journalChartState = {
  errors: {
    hoverIndex: null,
    model: null,
    pointer: null,
    redrawFrame: 0,
  },
  pnl: createJournalTimeChartState(),
  discipline: createJournalTimeChartState(),
};

const els = {};

applyTheme(getInitialTheme());
applyDashboardPrivacyState();

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindElements();
    setAppAccess(false);
    setCurrentDate();
    bindEvents();
    initializeNavigation();
    updateThemeToggle();
    updateDashboardPrivacyToggle();
    await initializeCloud();
  } catch (error) {
    console.error(error);
    if (els.authScreen && els.appShell) {
      els.authScreen.hidden = false;
      els.appShell.hidden = true;
      if (els.sessionPill) els.sessionPill.hidden = true;
      if (els.logoutButton) els.logoutButton.hidden = true;
      els.authMessage.textContent = "No se pudo iniciar la app. Recarga la pagina.";
    }
  }
});

function bindElements() {
  [
    "authScreen",
    "authForm",
    "authNameField",
    "authName",
    "authEmail",
    "authPassword",
    "authTitle",
    "authIntro",
    "authLoginButton",
    "authSwitchText",
    "authSignupButton",
    "authMessage",
    "globalAddButton",
    "globalAddButtonText",
    "appShell",
    "pageTitle",
    "syncStatus",
    "syncStatusText",
    "currentDateLabel",
    "metricNet",
        "metricExpenses",
    "metricIncome",
    "metricRoi",
        "metricBreakEven",
    "metricActiveAccounts",
        "dashboardFirmFilter",
    "dashboardAccountFilter",
    "dashboardPeriodFilter",
    "dashboardFromFilter",
    "dashboardToFilter",
    "dashboardResetFilters",
    "dashboardPeriodHint",
    "expenseBreakdownList",
    "accountBreakdownList",
    "recentTransactionsList",
    "monthExpenses",
    "monthIncome",
    "monthNet",
    "netChart",
    "monthChart",
    "netChartEmpty",
    "monthChartEmpty",
    "firmsTableBody",
    "accountsTableBody",
    "transactionsTableBody",
    "journalSection",
    "journalCalendarGrid",
    "journalCalendarMonth",
    "journalCalendarPrev",
    "journalCalendarNext",
    "journalCalendarToday",
    "journalMonthTotal",
    "journalPnlChart",
    "journalPnlChartEmpty",
    "journalPnlSummary",
    "journalAccountOverview",
    "journalAccountOverviewName",
    "journalAccountOverviewBase",
    "journalAccountBalance",
    "journalAccountNetPnl",
    "journalAccountReturn",
    "journalWinrateValue",
    "journalWinrateHint",
    "journalProfitFactorValue",
    "journalProfitFactorHint",
    "journalErrorsChart",
    "journalErrorsChartEmpty",
    "journalErrorsSummary",
    "journalErrorsLegend",
    "journalDisciplineChart",
    "journalDisciplineChartEmpty",
    "journalDisciplineSummary",
    "journalErrorTypesList",
    "addJournalErrorButton",
    "manageJournalErrorsButton",
    "journalSelectedDateLabel",
    "journalViewHeading",
    "journalClearDateButton",
    "journalEntriesList",
    "firmsEmpty",
    "accountsEmpty",
    "transactionsEmpty",
    "journalEmpty",
    "accountFirmFilter",
    "accountStatusFilter",
    "accountSearch",
    "transactionFirmFilter",
    "transactionKindFilter",
    "transactionFromFilter",
    "transactionToFilter",
    "transactionSearch",
    "journalAccountFilter",
    "journalEntriesAccountFilter",
    "journalPeriodFilter",
    "journalSearch",
    "firmDialog",
    "firmForm",
    "firmDialogTitle",
    "firmId",
    "firmName",
    "firmType",
    "firmNotes",
    "accountDialog",
    "accountForm",
    "accountDialogTitle",
    "accountId",
    "accountFirm",
    "accountName",
    "accountSize",
    "accountStatus",
    "accountPurchasedAt",
    "accountNotes",
    "transactionDialog",
    "transactionForm",
    "transactionDialogTitle",
    "transactionId",
    "transactionDate",
    "transactionKind",
    "transactionCategory",
    "transactionAmount",
    "transactionFirm",
    "transactionAccount",
    "transactionNote",
    "journalDialog",
    "journalForm",
    "journalDialogTitle",
    "journalId",
    "journalDate",
    "journalFirm",
    "journalAccount",
    "journalTitle",
    "journalDirection",
    "journalEmotion",
    "journalDiscipline",
    "journalPnl",
    "journalOperationUrl",
    "journalOperationImageInput",
    "journalOperationDropzone",
    "journalOperationMediaText",
    "journalOperationPreview",
    "journalOperationImage",
    "journalOperationClear",
    "journalErrorsOptions",
    "journalNotes",
    "journalDetailDialog",
    "journalDetailTitle",
    "journalDetailDate",
    "journalDetailPnl",
    "journalDetailErrors",
    "journalDetailMediaShell",
    "journalDetailMediaButton",
    "journalDetailImage",
    "journalDetailLink",
    "journalDetailNotes",
    "journalDetailEditButton",
    "journalDetailDeleteButton",
    "journalImageZoomDialog",
    "journalImageZoom",
    "journalErrorManagerDialog",
    "journalErrorDialog",
    "journalErrorForm",
    "journalErrorDialogTitle",
    "journalErrorTypeId",
    "journalErrorLabel",
    "journalErrorColor",
    "confirmDialog",
    "confirmTitle",
    "confirmMessage",
    "confirmAcceptButton",
    "importFileInput",
    "migrateLocalButton",
    "toast",
    "dashboardPrivacyToggleButton",
    "themeToggleButton",
    "sessionPill",
    "userEmail",
    "logoutButton",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuthForm();
  });
  els.authSignupButton.addEventListener("click", toggleAuthMode);
  els.logoutButton.addEventListener("click", signOut);

  document.querySelectorAll(".pillar-button").forEach((button) => {
    button.addEventListener("click", () => setActivePillar(button.dataset.pillar));
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.journalView) {
        setJournalView(button.dataset.journalView);
      }
      setActiveSection(button.dataset.section);
    });
  });

  
  els.dashboardPrivacyToggleButton.addEventListener("click", toggleDashboardPrivacy);
  els.themeToggleButton.addEventListener("click", toggleTheme);
  els.dashboardFirmFilter.addEventListener("input", () => {
    fillDashboardAccountFilter();
    resetNetChartInteraction();
    renderDashboard();
  });
  els.dashboardAccountFilter.addEventListener("input", () => {
    resetNetChartInteraction();
    renderDashboard();
  });
  els.dashboardPeriodFilter.addEventListener("input", () => {
    updateDashboardDateInputs();
    resetNetChartInteraction();
    renderDashboard();
  });
  ["dashboardFromFilter", "dashboardToFilter"].forEach((id) => {
    els[id].addEventListener("input", () => {
      resetNetChartInteraction();
      renderDashboard();
    });
  });
  els.dashboardResetFilters.addEventListener("click", resetDashboardFilters);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.dataset.closeDialog));
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("close", clearJournalCardFocus);
  });

  els.firmForm.addEventListener("submit", saveFirmFromForm);
  els.accountForm.addEventListener("submit", saveAccountFromForm);
  els.transactionForm.addEventListener("submit", saveTransactionFromForm);
  els.journalForm.addEventListener("submit", saveJournalFromForm);
  els.journalErrorForm.addEventListener("submit", saveJournalErrorTypeFromForm);
  els.addJournalErrorButton.addEventListener("click", () => openJournalErrorDialog());
  els.manageJournalErrorsButton.addEventListener("click", openJournalErrorManagerDialog);
  els.journalDetailEditButton.addEventListener("click", editSelectedJournalDetail);
  els.journalDetailDeleteButton.addEventListener("click", deleteSelectedJournalDetail);
  els.journalDetailMediaButton.addEventListener("click", openJournalImageZoom);
  els.journalImageZoomDialog.addEventListener("click", closeJournalImageZoomFromBackdrop);
  els.journalImageZoomDialog.addEventListener("close", () => els.journalImageZoom.removeAttribute("src"));
  els.journalOperationDropzone.addEventListener("click", () => els.journalOperationImageInput.click());
  els.journalOperationDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.journalOperationImageInput.click();
    }
  });
  els.journalOperationDropzone.addEventListener("paste", handleJournalOperationPaste);
  els.journalForm.addEventListener("paste", handleJournalOperationPaste);
  els.journalOperationDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.journalOperationDropzone.classList.add("is-dragging");
  });
  els.journalOperationDropzone.addEventListener("dragleave", () => {
    els.journalOperationDropzone.classList.remove("is-dragging");
  });
  els.journalOperationDropzone.addEventListener("drop", handleJournalOperationDrop);
  els.journalOperationImageInput.addEventListener("change", handleJournalOperationFileInput);
  els.journalOperationClear.addEventListener("click", clearJournalOperationMedia);

  els.transactionKind.addEventListener("change", () => {
    fillTransactionCategories(els.transactionKind.value, els.transactionCategory.value);
  });
  els.transactionFirm.addEventListener("change", () => {
    fillAccountSelect(els.transactionAccount, els.transactionFirm.value, true);
  });
  els.transactionAccount.addEventListener("change", () => {
    const account = getAccount(els.transactionAccount.value);
    if (account) {
      els.transactionFirm.value = account.firmId;
      syncCustomSelect(els.transactionFirm);
      fillAccountSelect(els.transactionAccount, account.firmId, true, account.id);
    }
  });
  els.journalFirm.addEventListener("change", () => {
    fillAccountSelect(els.journalAccount, els.journalFirm.value, true);
  });
  els.journalAccount.addEventListener("change", () => {
    const account = getAccount(els.journalAccount.value);
    if (account) {
      els.journalFirm.value = account.firmId;
      syncCustomSelect(els.journalFirm);
      fillAccountSelect(els.journalAccount, account.firmId, true, account.id);
    }
  });

  ["accountFirmFilter", "accountStatusFilter", "accountSearch"].forEach((id) => {
    els[id].addEventListener("input", renderAccountsTable);
  });

  [
    "transactionFirmFilter",
    "transactionKindFilter",
    "transactionFromFilter",
    "transactionToFilter",
    "transactionSearch",
  ].forEach((id) => {
    els[id].addEventListener("input", renderTransactionsTable);
  });

  ["journalAccountFilter", "journalEntriesAccountFilter", "journalPeriodFilter", "journalSearch"].forEach((id) => {
    els[id].addEventListener("input", renderJournalApp);
  });
  els.journalCalendarPrev.addEventListener("click", () => shiftJournalCalendarMonth(-1));
  els.journalCalendarNext.addEventListener("click", () => shiftJournalCalendarMonth(1));
  els.journalCalendarToday.addEventListener("click", resetJournalCalendarMonth);
  els.journalClearDateButton.addEventListener("click", clearJournalSelectedDate);

  els.firmsTableBody.addEventListener("click", handleTableAction);
  els.accountsTableBody.addEventListener("click", handleTableAction);
  els.transactionsTableBody.addEventListener("click", handleTableAction);
  els.journalCalendarGrid.addEventListener("click", handleTableAction);
  els.journalEntriesList.addEventListener("click", handleTableAction);
  els.journalEntriesList.addEventListener("click", handleJournalCardClick);
  els.journalEntriesList.addEventListener("keydown", handleJournalCardKeyDown);
  els.journalErrorTypesList.addEventListener("click", handleTableAction);

  document.getElementById("exportJsonButton").addEventListener("click", exportJson);
  document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
  document.getElementById("importJsonButton").addEventListener("click", () => els.importFileInput.click());
  els.importFileInput.addEventListener("change", importJson);
  els.migrateLocalButton.addEventListener("click", migrateLocalData);
  document.addEventListener("click", handleEmptyStateAction);

  els.confirmAcceptButton.addEventListener("click", async () => {
    if (confirmHandler) {
      await confirmHandler();
      confirmHandler = null;
    }
    closeDialog("confirmDialog");
  });

  bindNetChartEvents();
  bindJournalChartEvents();
  enhanceSelects();

  window.addEventListener("resize", debounce(() => {
    drawCharts(getDashboardSummary());
    renderJournalDashboard();
  }, 120));
}

function enhanceSelects(root = document) {
  root.querySelectorAll("select").forEach((select) => {
    if (select.dataset.enhancedSelect === "true") {
      syncCustomSelect(select);
      return;
    }

    const shell = document.createElement("div");
    shell.className = "select-shell";
    const button = document.createElement("button");
    button.className = "select-display";
    button.type = "button";
    button.setAttribute("aria-haspopup", "listbox");
    button.innerHTML = `<span></span><i data-lucide="chevron-down"></i>`;
    const menu = document.createElement("div");
    menu.className = "select-menu";
    menu.setAttribute("role", "listbox");

    select.classList.add("enhanced-select");
    select.dataset.enhancedSelect = "true";
    select.parentNode.insertBefore(shell, select);
    shell.append(select, button, menu);

    button.addEventListener("click", () => {
      if (select.disabled) return;
      closeCustomSelects(select);
      shell.classList.toggle("open");
      button.setAttribute("aria-expanded", String(shell.classList.contains("open")));
    });
    select.addEventListener("change", () => syncCustomSelect(select));
    syncCustomSelect(select);
  });

  if (!enhanceSelects.bound) {
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".select-shell")) closeCustomSelects();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCustomSelects();
    });
    enhanceSelects.bound = true;
  }

  refreshIcons();
}

function syncCustomSelect(select) {
  if (!select?.dataset?.enhancedSelect) return;
  const shell = select.closest(".select-shell");
  if (!shell) return;
  const button = shell.querySelector(".select-display");
  const label = button?.querySelector("span");
  const menu = shell.querySelector(".select-menu");
  const selectedOption = select.selectedOptions?.[0] || select.options?.[0];

  if (label) label.textContent = selectedOption?.textContent || "Selecciona";
  if (button) {
    button.disabled = select.disabled;
    button.setAttribute("aria-expanded", String(shell.classList.contains("open")));
  }
  if (!menu) return;

  menu.innerHTML = Array.from(select.options || [])
    .map(
      (option) => `
        <button
          class="select-option${option.selected ? " selected" : ""}"
          type="button"
          role="option"
          data-value="${escapeHtml(option.value)}"
          aria-selected="${option.selected ? "true" : "false"}"
          ${option.disabled ? "disabled" : ""}
        >
          ${escapeHtml(option.textContent || option.value)}
        </button>
      `
    )
    .join("");

  menu.querySelectorAll(".select-option").forEach((optionButton) => {
    optionButton.addEventListener("click", () => {
      select.value = optionButton.dataset.value || "";
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeCustomSelects();
      syncCustomSelect(select);
    });
  });
}

function syncAllCustomSelects() {
  document.querySelectorAll("select[data-enhanced-select='true']").forEach(syncCustomSelect);
}

function closeCustomSelects(exceptSelect = null) {
  document.querySelectorAll(".select-shell.open").forEach((shell) => {
    if (exceptSelect && shell.contains(exceptSelect)) return;
    shell.classList.remove("open");
    shell.querySelector(".select-display")?.setAttribute("aria-expanded", "false");
  });
}

function bindJournalChartEvents() {
  bindJournalTimeChartEvents("pnl", els.journalPnlChart);
  bindJournalTimeChartEvents("discipline", els.journalDisciplineChart);

  const errorsCanvas = els.journalErrorsChart;
  if (errorsCanvas) {
    errorsCanvas.addEventListener("pointermove", handleJournalErrorsPointerMove);
    errorsCanvas.addEventListener("pointerleave", handleJournalErrorsPointerLeave);
  }
}

function bindJournalTimeChartEvents(kind, canvas) {
  if (!canvas) return;
  canvas.addEventListener("pointerdown", (event) => handleJournalTimePointerDown(kind, event));
  canvas.addEventListener("pointermove", (event) => handleJournalTimePointerMove(kind, event));
  canvas.addEventListener("pointerup", (event) => handleJournalTimePointerUp(kind, event));
  canvas.addEventListener("pointercancel", (event) => handleJournalTimePointerUp(kind, event));
  canvas.addEventListener("pointerleave", () => handleJournalTimePointerLeave(kind));
  canvas.addEventListener("dblclick", (event) => resetJournalTimeChartView(kind, event));
  canvas.addEventListener("keydown", (event) => handleJournalTimeKeyDown(kind, event));
  canvas.addEventListener("wheel", (event) => handleJournalTimeWheel(kind, event), { passive: false });
}

function requestJournalChartRedraw(kind) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart || stateForChart.redrawFrame) return;
  stateForChart.redrawFrame = requestAnimationFrame(() => {
    stateForChart.redrawFrame = 0;
    const entries = getJournalDashboardEntries();
    if (kind === "pnl") drawJournalPnlChart(entries);
    else if (kind === "discipline") drawJournalDisciplineChart(entries);
    else if (kind === "errors") drawJournalErrorsChart(entries);
  });
}

function handleJournalTimePointerDown(kind, event) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart?.model?.series.length) return;
  const point = getCanvasPoint(event, event.currentTarget);
  if (!isPointInChart(point, stateForChart.model)) return;

  stateForChart.dragging = true;
  stateForChart.dragStartX = point.x;
  stateForChart.dragStartView = getJournalTimeChartRange(kind);
  stateForChart.pointer = point;
  stateForChart.pointerId = event.pointerId;
  event.currentTarget.classList.add("is-panning");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  updateJournalTimeHoverFromPoint(kind, point);
  requestJournalChartRedraw(kind);
  event.preventDefault();
}

function handleJournalTimePointerMove(kind, event) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart?.model?.series.length) return;
  const point = getCanvasPoint(event, event.currentTarget);
  stateForChart.pointer = point;

  if (stateForChart.dragging && stateForChart.dragStartView) {
    const innerWidth = Math.max(1, stateForChart.model.innerWidth);
    const visibleCount = stateForChart.dragStartView.end - stateForChart.dragStartView.start + 1;
    const deltaPoints = Math.round(((stateForChart.dragStartX - point.x) / innerWidth) * Math.max(visibleCount - 1, 1));
    setJournalTimeChartView(
      kind,
      stateForChart.dragStartView.start + deltaPoints,
      stateForChart.dragStartView.end + deltaPoints,
      true
    );
    updateJournalTimeHoverFromPoint(kind, point);
    requestJournalChartRedraw(kind);
    return;
  }

  if (updateJournalTimeHoverFromPoint(kind, point)) {
    requestJournalChartRedraw(kind);
  }
}

function handleJournalTimePointerUp(kind, event) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart?.dragging) return;
  stateForChart.dragging = false;
  stateForChart.dragStartView = null;
  stateForChart.pointerId = null;
  event.currentTarget.classList.remove("is-panning");
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  updateJournalTimeHoverFromPoint(kind, getCanvasPoint(event, event.currentTarget));
  requestJournalChartRedraw(kind);
}

function handleJournalTimePointerLeave(kind) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart || stateForChart.dragging) return;
  if (stateForChart.hoverIndex === null && !stateForChart.pointer) return;
  stateForChart.hoverIndex = null;
  stateForChart.pointer = null;
  requestJournalChartRedraw(kind);
}

function handleJournalTimeWheel(kind, event) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart?.model?.series.length) return;
  const point = getCanvasPoint(event, event.currentTarget);
  if (!isPointInChart(point, stateForChart.model)) return;

  event.preventDefault();
  zoomJournalTimeChartAt(kind, point, event.deltaY < 0 ? 0.78 : 1.28);
  stateForChart.pointer = point;
  updateJournalTimeHoverFromPoint(kind, point);
  requestJournalChartRedraw(kind);
}

function handleJournalTimeKeyDown(kind, event) {
  const stateForChart = journalChartState[kind];
  if (!stateForChart?.model?.series.length) return;

  const range = getJournalTimeChartRange(kind);
  const visibleCount = range.end - range.start + 1;
  const panStep = Math.max(1, Math.round(visibleCount * JOURNAL_CHART_PAN_STEP));
  const centerPoint = {
    x: stateForChart.model.pad.left + stateForChart.model.innerWidth / 2,
    y: stateForChart.model.pad.top + stateForChart.model.innerHeight / 2,
  };

  if (event.key === "ArrowLeft") {
    setJournalTimeChartView(kind, range.start - panStep, range.end - panStep, true);
  } else if (event.key === "ArrowRight") {
    setJournalTimeChartView(kind, range.start + panStep, range.end + panStep, true);
  } else if (event.key === "+" || event.key === "=") {
    zoomJournalTimeChartAt(kind, centerPoint, 0.78);
  } else if (event.key === "-" || event.key === "_") {
    zoomJournalTimeChartAt(kind, centerPoint, 1.28);
  } else if (event.key === "Home" || event.key === "Escape") {
    resetJournalTimeChartView(kind, event);
    return;
  } else {
    return;
  }

  event.preventDefault();
  requestJournalChartRedraw(kind);
}

function handleJournalErrorsPointerMove(event) {
  const stateForChart = journalChartState.errors;
  if (!stateForChart?.model?.segments.length) return;
  const point = getCanvasPoint(event, els.journalErrorsChart);
  const previous = stateForChart.hoverIndex;
  stateForChart.pointer = point;
  stateForChart.hoverIndex = getJournalErrorsSegmentIndex(point, stateForChart.model);
  if (previous !== stateForChart.hoverIndex) requestJournalChartRedraw("errors");
}

function handleJournalErrorsPointerLeave() {
  const stateForChart = journalChartState.errors;
  if (stateForChart.hoverIndex === null && !stateForChart.pointer) return;
  stateForChart.hoverIndex = null;
  stateForChart.pointer = null;
  requestJournalChartRedraw("errors");
}

async function handleJournalOperationPaste(event) {
  const file = getImageFileFromDataTransfer(event.clipboardData);
  if (!file) return;
  event.preventDefault();
  await setJournalOperationImage(file);
}

async function handleJournalOperationDrop(event) {
  event.preventDefault();
  els.journalOperationDropzone.classList.remove("is-dragging");
  const file = getImageFileFromDataTransfer(event.dataTransfer);
  if (!file) return toast("Pega o arrastra una imagen valida.");
  await setJournalOperationImage(file);
}

async function handleJournalOperationFileInput(event) {
  const file = Array.from(event.target.files || []).find((item) => item.type.startsWith("image/"));
  event.target.value = "";
  if (!file) return;
  await setJournalOperationImage(file);
}

function getImageFileFromDataTransfer(dataTransfer) {
  return Array.from(dataTransfer?.files || []).find((file) => file.type.startsWith("image/")) || null;
}

async function setJournalOperationImage(file) {
  try {
    const dataUrl = await compressJournalOperationImage(file);
    setJournalOperationMedia(dataUrl);
  } catch (error) {
    toast(error.message || "No se pudo cargar la captura.");
  }
}

function clearJournalOperationMedia() {
  setJournalOperationMedia("");
}

function setJournalOperationMedia(value = "") {
  const media = String(value || "");
  els.journalOperationUrl.value = media;
  const isImage = isImageDataUrl(media);

  els.journalOperationClear.hidden = !media;
  els.journalOperationPreview.hidden = !isImage;
  els.journalOperationMediaText.hidden = isImage;

  if (isImage) {
    els.journalOperationImage.src = media;
  } else {
    els.journalOperationImage.removeAttribute("src");
  }

  if (!media) {
    els.journalOperationMediaText.innerHTML = `
      <i data-lucide="image-plus"></i>
      <span>Pega una imagen, arrastrala aqui o haz clic para subirla.</span>
    `;
  } else if (!isImage) {
    els.journalOperationMediaText.innerHTML = `
      <i data-lucide="external-link"></i>
      <span>Enlace de operacion guardado.</span>
    `;
  }
  refreshIcons();
}

async function compressJournalOperationImage(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen.");
  }

  const source = await readImageFile(file);
  const { width, height } = source;
  const scale = Math.min(1, JOURNAL_OPERATION_IMAGE_MAX_SIZE / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  closeImageSource(source);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JOURNAL_OPERATION_IMAGE_QUALITY);
  });
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blobToDataUrl(blob);
}

async function readImageFile(file) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  const dataUrl = await blobToDataUrl(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = dataUrl;
  });
}

function closeImageSource(source) {
  if (typeof source?.close === "function") source.close();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

function isImageDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(String(value || ""));
}

function bindNetChartEvents() {
  const canvas = els.netChart;
  if (!canvas) return;

  canvas.addEventListener("pointerdown", handleNetChartPointerDown);
  canvas.addEventListener("pointermove", handleNetChartPointerMove);
  canvas.addEventListener("pointerup", handleNetChartPointerUp);
  canvas.addEventListener("pointercancel", handleNetChartPointerUp);
  canvas.addEventListener("pointerleave", handleNetChartPointerLeave);
  canvas.addEventListener("dblclick", resetNetChartView);
  canvas.addEventListener("keydown", handleNetChartKeyDown);
  canvas.addEventListener("wheel", handleNetChartWheel, { passive: false });
}

function handleNetChartPointerDown(event) {
  if (!netChartState.model?.series.length) return;
  const point = getCanvasPoint(event, els.netChart);
  if (!isPointInChart(point, netChartState.model)) return;

  netChartState.dragging = true;
  netChartState.dragStartX = point.x;
  netChartState.dragStartView = getNetChartRange(netChartState.fullSeries);
  netChartState.pointer = point;
  netChartState.pointerId = event.pointerId;
  els.netChart.classList.add("is-panning");
  els.netChart.setPointerCapture?.(event.pointerId);
  updateNetChartHoverFromPoint(point);
  requestNetChartRedraw();
  event.preventDefault();
}

function handleNetChartPointerMove(event) {
  if (!netChartState.model?.series.length) return;
  const point = getCanvasPoint(event, els.netChart);
  netChartState.pointer = point;

  if (netChartState.dragging && netChartState.dragStartView) {
    const innerWidth = Math.max(1, netChartState.model.innerWidth);
    const visibleCount = netChartState.dragStartView.end - netChartState.dragStartView.start + 1;
    const deltaPoints = Math.round(((netChartState.dragStartX - point.x) / innerWidth) * Math.max(visibleCount - 1, 1));
    setNetChartView(
      netChartState.dragStartView.start + deltaPoints,
      netChartState.dragStartView.end + deltaPoints,
      true
    );
    updateNetChartHoverFromPoint(point);
    requestNetChartRedraw();
    return;
  }

  if (updateNetChartHoverFromPoint(point)) {
    requestNetChartRedraw();
  }
}

function handleNetChartPointerUp(event) {
  if (!netChartState.dragging) return;
  netChartState.dragging = false;
  netChartState.dragStartView = null;
  netChartState.pointerId = null;
  els.netChart.classList.remove("is-panning");
  els.netChart.releasePointerCapture?.(event.pointerId);
  updateNetChartHoverFromPoint(getCanvasPoint(event, els.netChart));
  requestNetChartRedraw();
}

function handleNetChartPointerLeave() {
  if (netChartState.dragging) return;
  if (netChartState.hoverIndex === null && !netChartState.pointer) return;
  netChartState.hoverIndex = null;
  netChartState.pointer = null;
  requestNetChartRedraw();
}

function handleNetChartWheel(event) {
  if (!netChartState.model?.series.length) return;
  const point = getCanvasPoint(event, els.netChart);
  if (!isPointInChart(point, netChartState.model)) return;

  event.preventDefault();
  zoomNetChartAt(point, event.deltaY < 0 ? 0.78 : 1.28);
  netChartState.pointer = point;
  updateNetChartHoverFromPoint(point);
  requestNetChartRedraw();
}

function handleNetChartKeyDown(event) {
  if (!netChartState.model?.series.length) return;

  const range = getNetChartRange(netChartState.fullSeries);
  const visibleCount = range.end - range.start + 1;
  const panStep = Math.max(1, Math.round(visibleCount * NET_CHART_PAN_STEP));
  const centerPoint = {
    x: netChartState.model.pad.left + netChartState.model.innerWidth / 2,
    y: netChartState.model.pad.top + netChartState.model.innerHeight / 2,
  };

  if (event.key === "ArrowLeft") {
    setNetChartView(range.start - panStep, range.end - panStep, true);
  } else if (event.key === "ArrowRight") {
    setNetChartView(range.start + panStep, range.end + panStep, true);
  } else if (event.key === "+" || event.key === "=") {
    zoomNetChartAt(centerPoint, 0.78);
  } else if (event.key === "-" || event.key === "_") {
    zoomNetChartAt(centerPoint, 1.28);
  } else if (event.key === "Home" || event.key === "Escape") {
    resetNetChartView();
    event.preventDefault();
    return;
  } else {
    return;
  }

  event.preventDefault();
  requestNetChartRedraw();
}

function requestNetChartRedraw() {
  if (netChartState.redrawFrame) return;
  netChartState.redrawFrame = requestAnimationFrame(() => {
    netChartState.redrawFrame = 0;
    drawCharts(getDashboardSummary());
  });
}

async function initializeCloud() {
  maybeCreateLocalMigrationBackup();

  if (!supabaseClient) {
    setAppAccess(false);
    els.authMessage.textContent = "No se pudo cargar Supabase. Revisa tu conexion.";
    return;
  }

  setAppAccess(false);
  setAuthBusy(true, "Comprobando sesion...");

  const { data, error } = await supabaseClient.auth.getSession();
  setAuthBusy(false);
  if (error) {
    els.authMessage.textContent = error.message;
    return;
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });

  await handleSession(data.session);
}

async function handleSession(session) {
  currentSession = session;
  currentUser = session?.user || null;
  setAppAccess(Boolean(currentUser));

  if (!currentUser) {
    setAuthMode("login");
    state = loadState();
    refreshAll();
    return;
  }

  await loadCloudState();
}

function setAppAccess(isAuthenticated) {
  els.authScreen.hidden = isAuthenticated;
  els.appShell.hidden = !isAuthenticated;
  els.sessionPill.hidden = !isAuthenticated;
  els.logoutButton.hidden = !isAuthenticated;
  els.userEmail.textContent = getCurrentUserDisplayName();
  updateMigrationButton();
  refreshIcons();
}

function setAuthBusy(isBusy, message = "") {
  els.authLoginButton.disabled = isBusy;
  els.authSignupButton.disabled = isBusy;
  els.authMessage.textContent = message;
}

function setSyncStatus(status, message = "") {
  if (!els.syncStatus || !els.syncStatusText) return;

  window.clearTimeout(setSyncStatus.timer);
  els.syncStatus.classList.remove("loading", "error");

  if (status === "idle") {
    els.syncStatus.hidden = true;
    return;
  }

  els.syncStatus.hidden = false;
  els.syncStatus.classList.add(status);
  els.syncStatusText.textContent = message;
  refreshIcons();

  if (status === "error") {
    setSyncStatus.timer = window.setTimeout(() => setSyncStatus("idle"), 4200);
  }
}

function getAuthCredentials() {
  return {
    fullName: els.authName.value.trim(),
    email: els.authEmail.value.trim(),
    password: els.authPassword.value,
  };
}

function getCurrentUserDisplayName() {
  if (!currentUser) return "";
  const metadata = currentUser.user_metadata || {};
  return metadata.full_name || metadata.name || currentUser.email || "";
}

function toggleAuthMode() {
  setAuthMode(authMode === "login" ? "signup" : "login");
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = authMode === "signup";
  els.authTitle.hidden = !isSignup;
  els.authTitle.textContent = isSignup ? "Crear cuenta" : "";
  els.authIntro.textContent = isSignup
    ? "Crea tu acceso para guardar tus datos en la nube."
    : "Accede para sincronizar tus firms, cuentas, movimientos y journal.";
  els.authNameField.hidden = !isSignup;
  els.authName.disabled = !isSignup;
  els.authName.required = isSignup;
  els.authLoginButton.textContent = isSignup ? "Crear cuenta" : "Entrar";
  els.authSwitchText.textContent = isSignup ? "Ya tienes cuenta?" : "No tienes cuenta?";
  els.authSignupButton.textContent = isSignup ? "Entrar" : "Crear cuenta";
  els.authPassword.autocomplete = isSignup ? "new-password" : "current-password";
  els.authMessage.textContent = "";
}

function submitAuthForm() {
  if (authMode === "signup") {
    signUp();
    return;
  }
  signIn();
}

async function signIn() {
  const { email, password } = getAuthCredentials();
  if (!email || !password || !supabaseClient) return;

  setAuthBusy(true, "Entrando...");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setAuthBusy(false);

  if (error) {
    els.authMessage.textContent = error.message;
    return;
  }
  els.authMessage.textContent = "";
}

async function signUp() {
  const { fullName, email, password } = getAuthCredentials();
  if (!fullName || !email || !password || !supabaseClient) return;

  setAuthBusy(true, "Creando cuenta...");
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  setAuthBusy(false);

  if (error) {
    els.authMessage.textContent = error.message;
    return;
  }

  if (!data.session) {
    els.authMessage.textContent = "Cuenta creada. Revisa tu email para confirmar el acceso.";
    return;
  }

  els.authMessage.textContent = "Cuenta creada. Entrando...";
}

async function signOut() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    toast(error.message);
  }
}

async function loadCloudState() {
  if (!currentUser || !supabaseClient || cloudLoading) return;
  cloudLoading = true;
  let hasError = false;
  setSyncStatus("loading", "Sincronizando datos...");

  try {
    const [firmsResult, accountsResult, transactionsResult, journalResult, journalErrorTypes] = await Promise.all([
      supabaseClient.from("firms").select("*").order("name", { ascending: true }),
      supabaseClient.from("accounts").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("transactions").select("*").order("date", { ascending: true }),
      fetchJournalEntries(),
      fetchJournalErrorTypes(),
    ]);

    [firmsResult, accountsResult, transactionsResult].forEach(throwIfSupabaseError);

    state = {
      firms: (firmsResult.data || []).map(fromDbFirm),
      accounts: (accountsResult.data || []).map(fromDbAccount),
      transactions: (transactionsResult.data || []).map(fromDbTransaction),
      journalEntries: journalResult,
      journalErrorTypes,
    };
    refreshAll();
    updateMigrationButton();
  } catch (error) {
    hasError = true;
    setSyncStatus("error", "No se pudo sincronizar");
    toast(error.message || "No se pudieron cargar los datos.");
  } finally {
    cloudLoading = false;
    if (!hasError) {
      setSyncStatus("idle");
    }
  }
}

async function fetchJournalEntries() {
  const result = await supabaseClient.from("journal_entries").select("*").order("date", { ascending: false });
  if (result.error) {
    if (isMissingJournalTableError(result.error)) {
      toast("Crea la tabla journal_entries en Supabase para activar el journal.");
      return [];
    }
    throw result.error;
  }
  return (result.data || []).map(fromDbJournalEntry);
}

async function fetchJournalErrorTypes() {
  const result = await supabaseClient
    .from("journal_error_types")
    .select("*")
    .order("position", { ascending: true })
    .order("label", { ascending: true });

  if (result.error) {
    if (isMissingJournalErrorTypesTableError(result.error)) {
      toast("Ejecuta supabase-journal.sql para personalizar errores del journal.");
      return cloneDefaultJournalErrorTypes();
    }
    throw result.error;
  }

  return ensureDefaultJournalErrorTypes((result.data || []).map(fromDbJournalErrorType));
}

async function seedDefaultJournalErrorTypes() {
  if (!currentUser || !supabaseClient) return cloneDefaultJournalErrorTypes();
  const seed = cloneDefaultJournalErrorTypes();
  const result = await supabaseClient
    .from("journal_error_types")
    .upsert(seed.map(journalErrorTypeToDb), { onConflict: "user_id,id" })
    .select("*")
    .order("position", { ascending: true })
    .order("label", { ascending: true });

  if (result.error) {
    if (isMissingJournalErrorTypesTableError(result.error)) return seed;
    throw result.error;
  }
  return normalizeJournalErrorTypes((result.data || []).map(fromDbJournalErrorType));
}

async function ensureDefaultJournalErrorTypes(existingTypes) {
  const existing = normalizeJournalErrorTypes(existingTypes, { includeDefaults: false });
  const existingIds = new Set(existing.map((type) => type.id));
  const missingDefaults = cloneDefaultJournalErrorTypes().filter((type) => !existingIds.has(type.id));

  if (!missingDefaults.length) return normalizeJournalErrorTypes(existing);
  if (!currentUser || !supabaseClient) return normalizeJournalErrorTypes(existing);

  const result = await supabaseClient
    .from("journal_error_types")
    .upsert(missingDefaults.map(journalErrorTypeToDb), { onConflict: "user_id,id" })
    .select("*")
    .order("position", { ascending: true })
    .order("label", { ascending: true });

  if (result.error) {
    if (isMissingJournalErrorTypesTableError(result.error)) return normalizeJournalErrorTypes(existing);
    throw result.error;
  }

  return normalizeJournalErrorTypes([...existing, ...(result.data || []).map(fromDbJournalErrorType)]);
}

function isMissingJournalTableError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (message.includes("journal_entries") && message.includes("does not exist")) ||
    message.includes("Could not find the table")
  );
}

function isMissingJournalErrorTypesTableError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (message.includes("journal_error_types") && message.includes("does not exist")) ||
    message.includes("Could not find the table")
  );
}

function isJournalSetupError(error) {
  const message = String(error?.message || "");
  return (
    isMissingJournalTableError(error) ||
    isMissingJournalErrorTypesTableError(error) ||
    error?.code === "PGRST204" ||
    message.includes("pnl") ||
    message.includes("errors") ||
    message.includes("operation_url") ||
    message.includes("trade_direction")
  );
}

function handleJournalTableResult(result, requireTable = false) {
  if (result.error && isJournalSetupError(result.error)) {
    if (requireTable) {
      throw new Error("Ejecuta supabase-journal.sql en Supabase para actualizar el journal.");
    }
    return false;
  }
  throwIfSupabaseError(result);
  return true;
}

function getInitialTheme() {
  const stored =
    localStorage.getItem(THEME_STORAGE_KEY) ||
    LEGACY_THEME_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!localStorage.getItem(THEME_STORAGE_KEY) && stored) {
    localStorage.setItem(THEME_STORAGE_KEY, stored);
  }
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

function getInitialDashboardPrivacy() {
  return localStorage.getItem(DASHBOARD_PRIVACY_STORAGE_KEY) === "hidden";
}

function getInitialPillar() {
  const stored = localStorage.getItem(PILLAR_STORAGE_KEY);
  return stored === "journal" ? "journal" : "tracker";
}

function getInitialJournalView() {
  const stored = localStorage.getItem(JOURNAL_VIEW_STORAGE_KEY);
  return stored === "entries" ? "entries" : "dashboard";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function applyDashboardPrivacyState() {
  document.documentElement.dataset.dashboardPrivacy = dashboardPrivacyHidden ? "hidden" : "visible";
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  updateThemeToggle();
  drawCharts(getDashboardSummary());
  renderJournalDashboard();
}

function toggleDashboardPrivacy() {
  dashboardPrivacyHidden = !dashboardPrivacyHidden;
  localStorage.setItem(DASHBOARD_PRIVACY_STORAGE_KEY, dashboardPrivacyHidden ? "hidden" : "visible");
  applyDashboardPrivacyState();
  updateDashboardPrivacyToggle();
  renderDashboard();
  renderJournalDashboard();
}

function updateThemeToggle() {
  if (!els.themeToggleButton) return;
  const isDark = document.documentElement.dataset.theme === "dark";
  els.themeToggleButton.innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}"></i>`;
  els.themeToggleButton.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  els.themeToggleButton.title = isDark ? "Modo claro" : "Modo oscuro";
  refreshIcons();
}

function updateDashboardPrivacyToggle() {
  if (!els.dashboardPrivacyToggleButton) return;
  els.dashboardPrivacyToggleButton.innerHTML = `<i data-lucide="${dashboardPrivacyHidden ? "eye-off" : "eye"}"></i>`;
  els.dashboardPrivacyToggleButton.setAttribute(
    "aria-label",
    dashboardPrivacyHidden ? "Mostrar datos del dashboard" : "Ocultar datos del dashboard"
  );
  els.dashboardPrivacyToggleButton.setAttribute("aria-pressed", String(dashboardPrivacyHidden));
  els.dashboardPrivacyToggleButton.title = dashboardPrivacyHidden ? "Mostrar datos" : "Ocultar datos";
  refreshIcons();
}

function setCurrentDate() {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  els.currentDateLabel.textContent = formatter.format(new Date());
}

function loadState() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return structuredClone(defaultState);
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw);
    }
    const parsed = JSON.parse(raw);
    return {
      firms: Array.isArray(parsed.firms) ? parsed.firms : [],
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      journalEntries: Array.isArray(parsed.journalEntries) ? parsed.journalEntries : [],
      journalErrorTypes: normalizeJournalErrorTypes(parsed.journalErrorTypes),
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function throwIfSupabaseError(result) {
  if (result.error) throw result.error;
}

function fromDbFirm(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function fromDbAccount(row) {
  return {
    id: row.id,
    firmId: row.firm_id || "",
    name: row.name,
    size: row.size || "",
    status: row.status,
    purchasedAt: row.purchased_at || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function fromDbTransaction(row) {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind,
    category: row.category,
    amount: Number(row.amount || 0),
    currency: EURO,
    firmId: row.firm_id || "",
    accountId: row.account_id || "",
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function fromDbJournalEntry(row) {
  return {
    id: row.id,
    date: row.date,
    firmId: row.firm_id || "",
    accountId: row.account_id || "",
    title: row.title || "",
    direction: normalizeJournalDirection(row.trade_direction),
    sessionType: row.session_type || "trading-day",
    result: row.result || "neutral",
    emotion: row.emotion || "focused",
    discipline: Number(row.discipline || 3),
    pnl: Number(row.pnl || 0),
    errors: sanitizeJournalErrors(row.errors),
    operationUrl: row.operation_url || "",
    notes: row.notes || "",
    lesson: row.lesson || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function fromDbJournalErrorType(row) {
  return {
    id: row.id,
    label: row.label || "",
    color: row.color || "#3b82f6",
    position: Number(row.position || 0),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function firmToDb(firm) {
  return {
    id: firm.id,
    user_id: currentUser.id,
    name: firm.name,
    type: firm.type,
    notes: firm.notes || null,
  };
}

function accountToDb(account) {
  return {
    id: account.id,
    user_id: currentUser.id,
    firm_id: account.firmId || null,
    name: account.name,
    size: account.size || null,
    status: account.status,
    purchased_at: account.purchasedAt || null,
    notes: account.notes || null,
  };
}

function transactionToDb(transaction) {
  return {
    id: transaction.id,
    user_id: currentUser.id,
    firm_id: transaction.firmId || null,
    account_id: transaction.accountId || null,
    date: transaction.date,
    kind: transaction.kind,
    category: transaction.category,
    amount: transaction.amount,
    note: transaction.note || null,
  };
}

function journalEntryToDb(entry) {
  return {
    id: entry.id,
    user_id: currentUser.id,
    firm_id: entry.firmId || null,
    account_id: entry.accountId || null,
    date: entry.date,
    title: entry.title,
    trade_direction: entry.direction || null,
    session_type: entry.sessionType,
    result: entry.result,
    emotion: entry.emotion,
    discipline: entry.discipline,
    pnl: Number(entry.pnl || 0),
    errors: sanitizeJournalErrors(entry.errors),
    operation_url: entry.operationUrl || null,
    notes: entry.notes || null,
    lesson: entry.lesson || null,
    updated_at: entry.updatedAt || nowIso(),
  };
}

function journalErrorTypeToDb(type) {
  return {
    id: type.id,
    user_id: currentUser.id,
    label: String(type.label || "").trim(),
    color: normalizeHexColor(type.color) || "#3b82f6",
    position: Number(type.position || 0),
    active: type.active !== false,
    updated_at: type.updatedAt || nowIso(),
  };
}

function refreshAll() {
  fillFirmSelects();
  renderJournalErrorChoices();
  updateDashboardDateInputs();
  fillAccountSelect(els.transactionAccount, els.transactionFirm.value, true);
  renderDashboard();
  renderFirmsTable();
  renderAccountsTable();
  renderTransactionsTable();
  renderJournalApp();
  syncAllCustomSelects();
  refreshIcons();
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartPalette() {
  return {
    axis: themeColor("--chart-axis"),
    grid: themeColor("--chart-grid"),
    guide: themeColor("--chart-guide"),
    labelBg: themeColor("--chart-label-bg"),
    labelBorder: themeColor("--chart-label-border"),
    labelText: themeColor("--chart-label-text"),
    muted: themeColor("--muted"),
    capital: themeColor("--capital"),
    capitalFill: themeColor("--capital-fill"),
    capitalFillSoft: themeColor("--capital-fill-soft"),
    green: themeColor("--green"),
    red: themeColor("--red"),
    cyan: themeColor("--cyan"),
  };
}

function initializeNavigation() {
  const initialSection = activePillar === "journal" ? "journal" : "overview";
  setActiveSection(initialSection);
}

function setActivePillar(pillar) {
  if (!pillarDefaultSections[pillar]) return;
  if (pillar === "journal") {
    journalView = "dashboard";
    localStorage.setItem(JOURNAL_VIEW_STORAGE_KEY, journalView);
  }
  setActiveSection(pillarDefaultSections[pillar]);
}

function setJournalView(view) {
  if (!["dashboard", "entries"].includes(view)) return;
  journalView = view;
  localStorage.setItem(JOURNAL_VIEW_STORAGE_KEY, journalView);
  if (els.journalSection) {
    els.journalSection.dataset.journalView = journalView;
  }
  if (activeSection === "journal" && els.pageTitle) {
    els.pageTitle.textContent = journalView === "entries" ? "Journal - Entradas" : "Journal - Dashboard";
  }
  updateGlobalAddButton();
  updateNavigationState();
}

function setActiveSection(section) {
  if (!sectionPillars[section]) return;
  const titles = {
    overview: "Panel",
    firms: "Firms",
    accounts: "Cuentas",
    transactions: "Movimientos",
    journal: journalView === "entries" ? "Journal - Entradas" : "Journal - Dashboard",
  };

  activeSection = section;
  activePillar = sectionPillars[section];
  localStorage.setItem(PILLAR_STORAGE_KEY, activePillar);

  document.querySelectorAll(".section-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${section}Section`);
  });
  if (els.journalSection) {
    els.journalSection.dataset.journalView = journalView;
  }
  updateGlobalAddButton();
  updateNavigationState();
  els.pageTitle.textContent = titles[section] || "Panel";
  drawCharts(getDashboardSummary());
  if (section === "journal") {
    renderJournalApp();
    scheduleJournalDashboardChartRender();
  }
}

function updateJournalPanelHeading() {
  if (!els.journalPanelTitle || !els.journalPanelSubtitle) return;
  if (journalView === "entries") {
    els.journalPanelTitle.textContent = "Entradas";
    els.journalPanelSubtitle.textContent = "Operaciones, decisiones y notas";
    return;
  }
  els.journalPanelTitle.textContent = "Dashboard";
  els.journalPanelSubtitle.textContent = "P&L, disciplina, errores y calendario";
}

function updateGlobalAddButton() {
  if (!els.globalAddButton || !els.globalAddButtonText) return;

  let text = "Nuevo";
  let action = null;

  if (activePillar === "tracker") {
    if (activeSection === "firms") {
      text = "Nueva firm";
      action = () => openFirmDialog();
    } else if (activeSection === "accounts") {
      text = "Nueva cuenta";
      action = () => openAccountDialog();
    } else {
      text = "Nuevo movimiento";
      action = () => openTransactionDialog();
    }
  } else if (activePillar === "journal") {
    text = "Nueva entrada";
    action = () => openJournalDialog();
  }

  els.globalAddButtonText.textContent = text;
  els.globalAddButton.onclick = action;
}

function updateNavigationState() {
  document.querySelectorAll(".pillar-button").forEach((button) => {
    const isActive = button.dataset.pillar === activePillar;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  document.querySelectorAll("[data-pillar-menu]").forEach((group) => {
    group.classList.toggle("active", group.dataset.pillarMenu === activePillar);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const isSectionActive = button.dataset.section === activeSection;
    const isJournalMatch =
      activeSection !== "journal" || !button.dataset.journalView || button.dataset.journalView === journalView;
    button.classList.toggle("active", isSectionActive && isJournalMatch);
  });
}

function handleEmptyStateAction(event) {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  const button = target?.closest("[data-empty-action]");
  if (!button) return;

  const actions = {
    "add-firm": () => openFirmDialog(),
    "add-account": () => openAccountDialog(),
    "add-transaction": () => openTransactionDialog(),
    "add-journal": () => openJournalDialog(),
    "reset-account-filters": resetAccountFilters,
    "reset-transaction-filters": resetTransactionFilters,
    "reset-journal-filters": resetJournalFilters,
  };

  actions[button.dataset.emptyAction]?.();
}

function resetAccountFilters() {
  els.accountFirmFilter.value = "all";
  els.accountStatusFilter.value = "all";
  els.accountSearch.value = "";
  syncAllCustomSelects();
  renderAccountsTable();
}

function resetTransactionFilters() {
  els.transactionFirmFilter.value = "all";
  els.transactionKindFilter.value = "all";
  els.transactionFromFilter.value = "";
  els.transactionToFilter.value = "";
  els.transactionSearch.value = "";
  syncAllCustomSelects();
  renderTransactionsTable();
}

function resetJournalFilters() {
  fillJournalAccountFilter();
  els.journalAccountFilter.value = "all";
  els.journalEntriesAccountFilter.value = "all";
  els.journalPeriodFilter.value = "all";
  els.journalSearch.value = "";
  journalSelectedDate = "";
  syncAllCustomSelects();
  renderJournalApp();
}

function shiftJournalCalendarMonth(offset) {
  const date = parseLocalDate(`${journalCalendarMonth}-01`);
  date.setMonth(date.getMonth() + offset);
  journalCalendarMonth = dateToIsoDate(date).slice(0, 7);
  renderJournalCalendar();
}

function resetJournalCalendarMonth() {
  journalCalendarMonth = today().slice(0, 7);
  renderJournalCalendar();
}

function selectJournalDate(date) {
  if (!isValidIsoDate(date)) return;
  journalSelectedDate = date;
  els.journalPeriodFilter.value = "all";
  syncCustomSelect(els.journalPeriodFilter);
  setJournalView("entries");
  renderJournalApp();
}

function clearJournalSelectedDate() {
  journalSelectedDate = "";
  renderJournalApp();
}

function fillFirmSelects() {
  const firmOptions = state.firms
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((firm) => `<option value="${escapeHtml(firm.id)}">${escapeHtml(firm.name)}</option>`)
    .join("");

  const filterOptions = `<option value="all">Todas</option>${firmOptions}`;
  const firstFirmId = state.firms[0]?.id || "";
  setSelectOptions(els.dashboardFirmFilter, filterOptions, "all");
  setSelectOptions(els.accountFirmFilter, filterOptions, "all");
  setSelectOptions(els.transactionFirmFilter, filterOptions, "all");
  setSelectOptions(els.accountFirm, firmOptions || `<option value="">Crea una firm primero</option>`, firstFirmId);
  setSelectOptions(els.transactionFirm, firmOptions || `<option value="">Crea una firm primero</option>`, firstFirmId);
  setSelectOptions(els.journalFirm, firmOptions || `<option value="">Crea una firm primero</option>`, firstFirmId);
  fillDashboardAccountFilter();
  fillJournalAccountFilter();
}

function setSelectOptions(select, optionsHtml, fallbackValue = "") {
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML = optionsHtml;
  const values = Array.from(select.options || []).map((option) => option.value);

  if (values.includes(previousValue)) {
    select.value = previousValue;
  } else if (values.includes(fallbackValue)) {
    select.value = fallbackValue;
  } else {
    select.value = values[0] || "";
  }
  syncCustomSelect(select);
}

function fillDashboardAccountFilter() {
  if (!els.dashboardAccountFilter) return;
  const firmId = els.dashboardFirmFilter.value || "all";
  const accountOptions = state.accounts
    .filter((account) => firmId === "all" || account.firmId === firmId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");

  setSelectOptions(els.dashboardAccountFilter, `<option value="all">Todas</option>${accountOptions}`, "all");
}

function fillJournalAccountFilter() {
  if (!els.journalAccountFilter && !els.journalEntriesAccountFilter) return;
  const accountOptions = state.accounts
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");

  const options = `<option value="all">Todas</option>${accountOptions}`;
  setSelectOptions(els.journalAccountFilter, options, "all");
  setSelectOptions(els.journalEntriesAccountFilter, options, "all");
}

function fillAccountSelect(select, firmId, includeEmpty, selectedId = "") {
  const accounts = state.accounts
    .filter((account) => !firmId || account.firmId === firmId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const empty = includeEmpty ? `<option value="">Sin cuenta concreta</option>` : "";
  select.innerHTML = `${empty}${accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("")}`;
  select.value = selectedId || "";
  syncCustomSelect(select);
}

function fillTransactionCategories(kind, selected = "") {
  const categories = kind === "income" ? incomeCategories : expenseCategories;
  els.transactionCategory.innerHTML = categories
    .map((category) => `<option value="${category}">${categoryLabels[category]}</option>`)
    .join("");
  if (categories.includes(selected)) {
    els.transactionCategory.value = selected;
  }
  syncCustomSelect(els.transactionCategory);
}

function getDashboardFilters() {
  const period = els.dashboardPeriodFilter?.value || "all";
  const range = getDashboardDateRange(period);
  return {
    accountId: els.dashboardAccountFilter?.value || "all",
    firmId: els.dashboardFirmFilter?.value || "all",
    period,
    ...range,
  };
}

function getDashboardDateRange(period) {
  if (period === "custom") {
    return {
      from: els.dashboardFromFilter?.value || "",
      to: els.dashboardToFilter?.value || "",
    };
  }

  return getPeriodDateRange(period);
}

function getPeriodDateRange(period) {
  const end = today();

  if (period === "current-month") {
    return { from: `${end.slice(0, 7)}-01`, to: end };
  }
  if (period === "last-30") {
    return { from: shiftIsoDate(end, -29), to: end };
  }
  if (period === "last-90") {
    return { from: shiftIsoDate(end, -89), to: end };
  }
  if (period === "year") {
    return { from: `${end.slice(0, 4)}-01-01`, to: end };
  }

  return { from: "", to: "" };
}

function getDashboardSummary() {
  const filters = getDashboardFilters();
  const accounts = state.accounts.filter((account) => {
    if (filters.firmId !== "all" && account.firmId !== filters.firmId) return false;
    return filters.accountId === "all" || account.id === filters.accountId;
  });
  const transactions = state.transactions.filter((transaction) => {
    const firmId = resolveFirmId(transaction);
    if (filters.firmId !== "all" && firmId !== filters.firmId) return false;
    if (filters.accountId !== "all" && transaction.accountId !== filters.accountId) return false;
    if (filters.from && (!transaction.date || transaction.date < filters.from)) return false;
    if (filters.to && (!transaction.date || transaction.date > filters.to)) return false;
    return true;
  });

  return {
    ...getSummary(transactions, accounts),
    filters,
  };
}

function updateDashboardDateInputs() {
  const isCustom = els.dashboardPeriodFilter?.value === "custom";
  els.dashboardFromFilter.disabled = !isCustom;
  els.dashboardToFilter.disabled = !isCustom;
}

function resetDashboardFilters() {
  els.dashboardFirmFilter.value = "all";
  fillDashboardAccountFilter();
  els.dashboardAccountFilter.value = "all";
  els.dashboardPeriodFilter.value = "all";
  els.dashboardFromFilter.value = "";
  els.dashboardToFilter.value = "";
  syncAllCustomSelects();
  updateDashboardDateInputs();
  resetNetChartInteraction();
  renderDashboard();
}

function getDashboardPeriodLabel(filters) {
  const periodLabels = {
    all: "Todo el historial",
    "current-month": "Mes actual",
    "last-30": "Ultimos 30 dias",
    "last-90": "Ultimos 90 dias",
    year: "Este año",
    custom:
      filters.from || filters.to
        ? `${filters.from ? formatDate(filters.from) : "Inicio"} - ${filters.to ? formatDate(filters.to) : "Hoy"}`
        : "Rango personalizado",
  };
  const account = filters.accountId !== "all" ? getAccount(filters.accountId) : null;
  const firm = !account && filters.firmId !== "all" ? getFirm(filters.firmId) : null;
  const scope = account?.name || firm?.name || "";
  const periodLabel = periodLabels[filters.period] || periodLabels.all;
  return scope ? `${periodLabel} - ${scope}` : periodLabel;
}

function getSummary(transactionsSource = state.transactions, accountsSource = state.accounts) {
  const transactions = transactionsSource.map((transaction) => ({
    ...transaction,
    resolvedFirmId: resolveFirmId(transaction),
  }));
  const expenses = sum(transactions.filter((tx) => tx.kind === "expense").map((tx) => tx.amount));
  const income = sum(transactions.filter((tx) => tx.kind === "income").map((tx) => tx.amount));
  const net = income - expenses;
  const roi = expenses > 0 ? (net / expenses) * 100 : 0;
  const breakEven = Math.max(0, expenses - income);
  const activeAccounts = accountsSource.filter((account) =>
    ["active", "passed", "funded"].includes(account.status)
  ).length;

  return {
    accounts: accountsSource,
    transactions,
    expenses,
    income,
    net,
    roi,
    breakEven,
    activeAccounts,
    accountCount: accountsSource.length,
  };
}

function renderDashboard() {
  const summary = getDashboardSummary();

  els.metricNet.textContent = sensitiveMoney(summary.net);
  els.metricExpenses.textContent = sensitiveMoney(summary.expenses);
  els.metricIncome.textContent = sensitiveMoney(summary.income);
  els.metricRoi.textContent = sensitivePercent(summary.roi);
  els.metricBreakEven.textContent = sensitiveMoney(summary.breakEven);
  els.metricActiveAccounts.textContent = sensitiveCount(summary.activeAccounts);
  els.dashboardPeriodHint.textContent = getDashboardPeriodLabel(summary.filters);

  document.querySelector(".metric-net").classList.toggle("positive", summary.net > 0);
  document.querySelector(".metric-net").classList.toggle("negative", summary.net < 0);

  els.monthExpenses.textContent = sensitiveMoney(summary.expenses);
  els.monthIncome.textContent = sensitiveMoney(summary.income);
  els.monthNet.textContent = sensitiveMoney(summary.net);
  els.monthNet.className = summary.net >= 0 ? "amount positive" : "amount negative";

  renderDashboardBreakdowns(summary);
  drawCharts(summary);
}

function isDashboardFiltered(filters) {
  return (
    filters.firmId !== "all" ||
    filters.accountId !== "all" ||
    filters.period !== "all" ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

function renderDashboardBreakdowns(summary) {
  renderExpenseBreakdown(summary);
  renderAccountBreakdown(summary);
  renderRecentTransactions(summary);
}

function renderExpenseBreakdown(summary) {
  const rows = groupBy(summary.transactions.filter((tx) => tx.kind === "expense"), (tx) => tx.category)
    .map(([category, transactions]) => {
      const total = sum(transactions.map((tx) => tx.amount));
      return {
        category,
        count: transactions.length,
        label: categoryLabels[category] || category,
        percent: summary.expenses > 0 ? (total / summary.expenses) * 100 : 0,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    renderInsightEmpty(els.expenseBreakdownList, "Sin gastos en el filtro");
    return;
  }

  els.expenseBreakdownList.innerHTML = rows
    .map(
      (row) => `
        <div class="insight-row">
          <div class="insight-main">
            <div class="insight-title-line">
              <strong>${escapeHtml(row.label)}</strong>
              <span>${sensitivePercent(row.percent)}</span>
            </div>
            <div class="insight-bar" style="--share: ${clamp(row.percent, 2, 100)}%">
              <i></i>
            </div>
            <span>${sensitiveCount(row.count)} ${row.count === 1 ? "movimiento" : "movimientos"}</span>
          </div>
          <b class="amount negative">${sensitiveMoney(row.total)}</b>
        </div>
      `
    )
    .join("");
}

function renderAccountBreakdown(summary) {
  const accountRows = summary.accounts.map((account) => {
    const transactions = summary.transactions.filter((tx) => tx.accountId === account.id);
    return accountBreakdownRow(account.name, getFirm(account.firmId)?.name || "Sin firm", transactions);
  });
  const looseTransactions = summary.transactions.filter((tx) => !tx.accountId);
  const rows = [
    ...accountRows,
    ...(looseTransactions.length ? [accountBreakdownRow("Sin cuenta", "Movimientos sin cuenta concreta", looseTransactions)] : []),
  ]
    .filter((row) => row.expenses > 0 || row.income > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, 6);

  if (!rows.length) {
    renderInsightEmpty(els.accountBreakdownList, "Sin movimientos por cuenta en el filtro");
    return;
  }

  els.accountBreakdownList.innerHTML = rows
    .map(
      (row) => `
        <div class="insight-row">
          <div class="insight-main">
            <div class="insight-title-line">
              <strong>${escapeHtml(row.name)}</strong>
              <span>${sensitivePercent(row.roi)}</span>
            </div>
            <span>${escapeHtml(row.meta)}</span>
            <div class="insight-split">
              <span>Gasto ${sensitiveMoney(row.expenses)}</span>
              <span>Retiros ${sensitiveMoney(row.income)}</span>
            </div>
          </div>
          <b class="amount ${row.net >= 0 ? "positive" : "negative"}">${sensitiveMoney(row.net)}</b>
        </div>
      `
    )
    .join("");
}

function accountBreakdownRow(name, meta, transactions) {
  const expenses = sum(transactions.filter((tx) => tx.kind === "expense").map((tx) => tx.amount));
  const income = sum(transactions.filter((tx) => tx.kind === "income").map((tx) => tx.amount));
  const net = income - expenses;
  return {
    expenses,
    income,
    meta,
    name,
    net,
    roi: expenses > 0 ? (net / expenses) * 100 : 0,
  };
}

function renderRecentTransactions(summary) {
  const rows = summary.transactions
    .slice()
    .sort((a, b) => {
      const byDate = (b.date || "").localeCompare(a.date || "");
      return byDate || (b.createdAt || "").localeCompare(a.createdAt || "");
    })
    .slice(0, 6);

  if (!rows.length) {
    renderInsightEmpty(els.recentTransactionsList, "Sin movimientos en el filtro");
    return;
  }

  els.recentTransactionsList.innerHTML = rows
    .map((tx) => {
      const firm = getFirm(resolveFirmId(tx));
      const account = getAccount(tx.accountId);
      const signed = tx.kind === "income" ? tx.amount : -tx.amount;
      return `
        <div class="insight-row insight-row-transaction">
          <span class="badge ${tx.kind}">${tx.kind === "income" ? "Retiro" : "Gasto"}</span>
          <div class="insight-main">
            <strong>${escapeHtml(categoryLabels[tx.category] || tx.category)}</strong>
            <span>${formatDate(tx.date)} - ${escapeHtml(firm?.name || "Sin firm")} - ${escapeHtml(account?.name || "Sin cuenta")}</span>
          </div>
          <b class="amount ${signed >= 0 ? "positive" : "negative"}">${sensitiveMoney(signed)}</b>
        </div>
      `;
    })
    .join("");
}

function renderInsightEmpty(element, message) {
  element.innerHTML = `<div class="insight-empty">${escapeHtml(message)}</div>`;
}

function groupBy(items, getKey) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });
  return [...grouped.entries()];
}

function renderFirmsTable() {
  const rows = state.firms
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((firm) => {
      const firmTransactions = state.transactions.filter((tx) => resolveFirmId(tx) === firm.id);
      const expenses = sum(firmTransactions.filter((tx) => tx.kind === "expense").map((tx) => tx.amount));
      const income = sum(firmTransactions.filter((tx) => tx.kind === "income").map((tx) => tx.amount));
      const net = income - expenses;
      const roi = expenses > 0 ? (net / expenses) * 100 : 0;
      const accountCount = state.accounts.filter((account) => account.firmId === firm.id).length;
      return `
        <tr>
          <td data-label="Firm">
            <div class="table-title">
              <strong>${escapeHtml(firm.name)}</strong>
              <span>${escapeHtml(firm.notes || "")}</span>
            </div>
          </td>
          <td data-label="Tipo">${escapeHtml(firm.type)}</td>
          <td data-label="Cuentas">${accountCount}</td>
          <td data-label="Gastos" class="amount negative">${formatMoney(expenses)}</td>
          <td data-label="Retiros" class="amount positive">${formatMoney(income)}</td>
          <td data-label="Neto" class="amount ${net >= 0 ? "positive" : "negative"}">${formatMoney(net)}</td>
          <td data-label="ROI">${formatPercent(roi)}</td>
          <td data-label="Acciones">
            <div class="row-actions">
              ${actionButton("edit-firm", firm.id, "Editar", "pencil")}
              ${actionButton("delete-firm", firm.id, "Eliminar", "trash-2")}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  els.firmsTableBody.innerHTML = rows;
  setTableVisible(els.firmsTableBody, Boolean(rows));
  if (state.firms.length) {
    hideEmptyState(els.firmsEmpty);
  } else {
    showEmptyState(
      els.firmsEmpty,
      "Todavia no hay firms",
      "Crea tu primera firm para empezar a organizar cuentas, compras y payouts.",
      "Nueva firm",
      "add-firm"
    );
  }
  refreshIcons();
}

function renderAccountsTable() {
  const firmFilter = els.accountFirmFilter.value || "all";
  const statusFilter = els.accountStatusFilter.value || "all";
  const search = normalize(els.accountSearch.value);

  const accounts = state.accounts
    .filter((account) => firmFilter === "all" || account.firmId === firmFilter)
    .filter((account) => statusFilter === "all" || account.status === statusFilter)
    .filter((account) => {
      if (!search) return true;
      const firm = getFirm(account.firmId);
      return normalize(`${account.name} ${account.size} ${firm?.name || ""} ${account.notes || ""}`).includes(search);
    })
    .sort((a, b) => (b.purchasedAt || "").localeCompare(a.purchasedAt || ""));

  els.accountsTableBody.innerHTML = accounts
    .map((account) => {
      const firm = getFirm(account.firmId);
      const txs = state.transactions.filter((tx) => tx.accountId === account.id);
      const expenses = sum(txs.filter((tx) => tx.kind === "expense").map((tx) => tx.amount));
      const income = sum(txs.filter((tx) => tx.kind === "income").map((tx) => tx.amount));
      const net = income - expenses;
      return `
        <tr>
          <td data-label="Cuenta">
            <div class="table-title">
              <strong>${escapeHtml(account.name)}</strong>
              <span>${escapeHtml(account.notes || "")}</span>
            </div>
          </td>
          <td data-label="Firm">${escapeHtml(firm?.name || "Sin firm")}</td>
          <td data-label="Tamaño">${escapeHtml(account.size || "-")}</td>
          <td data-label="Estado"><span class="badge ${account.status}">${statusLabels[account.status] || account.status}</span></td>
          <td data-label="Compra">${formatDate(account.purchasedAt)}</td>
          <td data-label="Gastos" class="amount negative">${formatMoney(expenses)}</td>
          <td data-label="Retiros" class="amount positive">${formatMoney(income)}</td>
          <td data-label="Neto" class="amount ${net >= 0 ? "positive" : "negative"}">${formatMoney(net)}</td>
          <td data-label="Acciones">
            <div class="row-actions">
              ${actionButton("edit-account", account.id, "Editar", "pencil")}
              ${actionButton("delete-account", account.id, "Eliminar", "trash-2")}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  setTableVisible(els.accountsTableBody, accounts.length > 0);
  if (accounts.length) {
    hideEmptyState(els.accountsEmpty);
  } else if (!state.firms.length) {
    showEmptyState(
      els.accountsEmpty,
      "Primero crea una firm",
      "Las cuentas necesitan una firm asociada para que el dashboard pueda agrupar los resultados.",
      "Nueva firm",
      "add-firm"
    );
  } else if (!state.accounts.length) {
    showEmptyState(
      els.accountsEmpty,
      "Todavia no hay cuentas",
      "Añade la primera cuenta para seguir su estado, coste y retiradas.",
      "Nueva cuenta",
      "add-account"
    );
  } else {
    showEmptyState(
      els.accountsEmpty,
      "Sin cuentas con esos filtros",
      "Prueba con otra firm, otro estado o limpia la busqueda.",
      "Limpiar filtros",
      "reset-account-filters",
      "rotate-ccw"
    );
  }
  refreshIcons();
}

function renderTransactionsTable() {
  const firmFilter = els.transactionFirmFilter.value || "all";
  const kindFilter = els.transactionKindFilter.value || "all";
  const from = els.transactionFromFilter.value;
  const to = els.transactionToFilter.value;
  const search = normalize(els.transactionSearch.value);

  const transactions = state.transactions
    .filter((tx) => firmFilter === "all" || resolveFirmId(tx) === firmFilter)
    .filter((tx) => kindFilter === "all" || tx.kind === kindFilter)
    .filter((tx) => !from || tx.date >= from)
    .filter((tx) => !to || tx.date <= to)
    .filter((tx) => {
      if (!search) return true;
      const firm = getFirm(resolveFirmId(tx));
      const account = getAccount(tx.accountId);
      return normalize(`${categoryLabels[tx.category] || tx.category} ${tx.note || ""} ${firm?.name || ""} ${account?.name || ""}`).includes(search);
    })
    .sort((a, b) => {
      const byDate = (b.date || "").localeCompare(a.date || "");
      return byDate || (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  els.transactionsTableBody.innerHTML = transactions
    .map((tx) => {
      const firm = getFirm(resolveFirmId(tx));
      const account = getAccount(tx.accountId);
      const signed = tx.kind === "income" ? tx.amount : -tx.amount;
      return `
        <tr>
          <td data-label="Fecha">${formatDate(tx.date)}</td>
          <td data-label="Tipo"><span class="badge ${tx.kind}">${tx.kind === "income" ? "Retiro" : "Gasto"}</span></td>
          <td data-label="Categoria">${categoryLabels[tx.category] || escapeHtml(tx.category)}</td>
          <td data-label="Firm">${escapeHtml(firm?.name || "Sin firm")}</td>
          <td data-label="Cuenta">${escapeHtml(account?.name || "-")}</td>
          <td data-label="Nota">${escapeHtml(tx.note || "-")}</td>
          <td data-label="Importe" class="amount ${signed >= 0 ? "positive" : "negative"}">${formatMoney(signed)}</td>
          <td data-label="Acciones">
            <div class="row-actions">
              ${actionButton("edit-transaction", tx.id, "Editar", "pencil")}
              ${actionButton("delete-transaction", tx.id, "Eliminar", "trash-2")}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  setTableVisible(els.transactionsTableBody, transactions.length > 0);
  if (transactions.length) {
    hideEmptyState(els.transactionsEmpty);
  } else if (!state.firms.length) {
    showEmptyState(
      els.transactionsEmpty,
      "Primero crea una firm",
      "Los movimientos se agrupan por firm para que el capital y el ROI salgan correctamente.",
      "Nueva firm",
      "add-firm"
    );
  } else if (!state.transactions.length) {
    showEmptyState(
      els.transactionsEmpty,
      "Todavia no hay movimientos",
      "Registra compras, resets, fees o payouts para alimentar el dashboard.",
      "Nuevo movimiento",
      "add-transaction"
    );
  } else {
    showEmptyState(
      els.transactionsEmpty,
      "Sin movimientos con esos filtros",
      "Ajusta la firm, el tipo, las fechas o la busqueda para ver mas resultados.",
      "Limpiar filtros",
      "reset-transaction-filters",
      "rotate-ccw"
    );
  }
  refreshIcons();
}

function renderJournalApp() {
  renderJournalDashboard();
  renderJournalEntries();
}

function renderJournalDashboard() {
  const entries = getJournalDashboardEntries();
  renderJournalAccountOverview(entries);
  renderJournalPerformanceMetrics(entries);
  drawJournalPnlChart(entries);
  drawJournalErrorsChart(entries);
  drawJournalDisciplineChart(entries);
  renderJournalErrorSettings();
  renderJournalCalendar();
  scheduleJournalDashboardChartRender();
}

function getJournalDashboardEntries() {
  return getFilteredJournalEntries({ includePeriod: false, includeSearch: false, includeSelectedDate: false });
}

function scheduleJournalDashboardChartRender(attempt = 0) {
  if (journalDashboardLayoutFrame) return;
  journalDashboardLayoutFrame = requestAnimationFrame(() => {
    journalDashboardLayoutFrame = 0;
    if (activeSection !== "journal" || journalView !== "dashboard") return;

    const canvases = [els.journalPnlChart, els.journalErrorsChart, els.journalDisciplineChart].filter(Boolean);
    const hasPendingLayout = canvases.some((canvas) => !canDrawCanvas(canvas));
    const entries = getJournalDashboardEntries();

    drawJournalPnlChart(entries);
    drawJournalErrorsChart(entries);
    drawJournalDisciplineChart(entries);

    if (hasPendingLayout && attempt < 6) {
      scheduleJournalDashboardChartRender(attempt + 1);
    }
  });
}

function renderJournalAccountOverview(entries) {
  const accountId = els.journalAccountFilter.value || "all";
  if (accountId === "all") {
    els.journalAccountOverview.hidden = true;
    return;
  }

  const account = getAccount(accountId);
  const firm = getFirm(account?.firmId);
  const base = parseAccountSizeAmount(account?.size);
  const netPnl = sum(entries.map((entry) => entry.pnl));
  const balance = Number.isFinite(base) ? base + netPnl : netPnl;
  const returnPercent = Number.isFinite(base) && base > 0 ? (netPnl / base) * 100 : null;

  els.journalAccountOverview.hidden = false;
  els.journalAccountOverviewName.textContent = [account?.name || "Cuenta", firm?.name].filter(Boolean).join(" - ");
  els.journalAccountOverviewBase.textContent = Number.isFinite(base)
    ? `Base ${sensitiveTradingMoney(base)}`
    : "Añade tamaño de cuenta para calcular %";
  els.journalAccountBalance.textContent = sensitiveTradingMoney(balance);
  els.journalAccountNetPnl.textContent = sensitiveSignedTradingMoney(netPnl);
  els.journalAccountNetPnl.className = pnlToneClass(netPnl);
  els.journalAccountReturn.textContent = returnPercent === null ? "-" : sensitiveSignedPercent(returnPercent);
  els.journalAccountReturn.className = returnPercent === null ? "neutral" : pnlToneClass(returnPercent);
}

function renderJournalPerformanceMetrics(entries) {
  const stats = getJournalPerformanceStats(entries);
  const winrateTone = stats.winrate === null ? "neutral" : stats.winrate >= 50 ? "positive" : "negative";
  const profitFactorTone =
    stats.profitFactor === null ? "neutral" : stats.profitFactor >= 1 ? "positive" : "negative";

  els.journalWinrateValue.textContent = stats.winrate === null ? "-" : sensitivePercent(stats.winrate);
  els.journalWinrateValue.className = winrateTone;
  els.journalWinrateHint.textContent = stats.closed
    ? `${sensitiveCount(stats.wins)}W - ${sensitiveCount(stats.losses)}L${stats.breakEven ? ` - ${sensitiveCount(stats.breakEven)} BE` : ""}`
    : "Sin operaciones cerradas";

  els.journalProfitFactorValue.textContent =
    stats.profitFactor === null
      ? "-"
      : stats.profitFactor === Infinity
        ? sensitiveText("∞")
        : sensitiveRatio(stats.profitFactor);
  els.journalProfitFactorValue.className = profitFactorTone;
  els.journalProfitFactorHint.textContent =
    stats.grossLoss > 0
      ? `${sensitiveMoney(stats.grossProfit)} / ${sensitiveMoney(stats.grossLoss)}`
      : stats.grossProfit > 0
        ? "Sin perdidas registradas"
        : "Ganancias / perdidas";
}

function getJournalPerformanceStats(entries) {
  const values = entries.map((entry) => Number(entry.pnl)).filter(Number.isFinite);
  const wins = values.filter((value) => value > 0);
  const losses = values.filter((value) => value < 0);
  const breakEven = values.filter((value) => value === 0).length;
  const grossProfit = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const closed = wins.length + losses.length;
  const winrate = closed ? (wins.length / closed) * 100 : null;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;

  return {
    breakEven,
    closed,
    grossLoss,
    grossProfit,
    losses: losses.length,
    profitFactor,
    winrate,
    wins: wins.length,
  };
}

function syncJournalTimeChartState(kind, fullSeries, seriesKey) {
  const stateForChart = journalChartState[kind];
  stateForChart.fullSeries = fullSeries;

  if (!fullSeries.length) {
    stateForChart.hoverIndex = null;
    stateForChart.model = null;
    stateForChart.pointer = null;
    stateForChart.seriesKey = "";
    stateForChart.userRange = false;
    stateForChart.viewStart = 0;
    stateForChart.viewEnd = 0;
    return;
  }

  if (seriesKey !== stateForChart.seriesKey) {
    stateForChart.seriesKey = seriesKey;
    if (!stateForChart.userRange) {
      stateForChart.viewStart = 0;
      stateForChart.viewEnd = fullSeries.length - 1;
    }
  }

  setJournalTimeChartView(kind, stateForChart.viewStart, stateForChart.viewEnd, stateForChart.userRange);
  if (stateForChart.hoverIndex > fullSeries.length - 1) {
    stateForChart.hoverIndex = null;
  }
}

function getJournalTimeChartRange(kind) {
  const stateForChart = journalChartState[kind];
  const total = stateForChart.fullSeries.length;
  if (!total) return { start: 0, end: 0 };
  const start = clamp(Math.round(stateForChart.viewStart), 0, total - 1);
  const end = clamp(Math.round(stateForChart.viewEnd), start, total - 1);
  return { start, end };
}

function getJournalTimeVisibleSeries(kind) {
  const stateForChart = journalChartState[kind];
  const range = getJournalTimeChartRange(kind);
  return stateForChart.fullSeries.slice(range.start, range.end + 1).map((point, index) => ({
    ...point,
    fullIndex: range.start + index,
  }));
}

function setJournalTimeChartView(kind, start, end, userRange = true) {
  const stateForChart = journalChartState[kind];
  const total = stateForChart.fullSeries.length;
  if (!total) return;

  const lastIndex = total - 1;
  const desiredCount = Math.max(1, Math.round(end - start + 1));
  const visibleCount = Math.min(total, Math.max(Math.min(JOURNAL_CHART_MIN_VISIBLE_POINTS, total), desiredCount));

  if (visibleCount >= total) {
    stateForChart.viewStart = 0;
    stateForChart.viewEnd = lastIndex;
    stateForChart.userRange = false;
    return;
  }

  let nextStart = Math.round(start);
  let nextEnd = nextStart + visibleCount - 1;

  if (nextStart < 0) {
    nextStart = 0;
    nextEnd = visibleCount - 1;
  }
  if (nextEnd > lastIndex) {
    nextEnd = lastIndex;
    nextStart = lastIndex - visibleCount + 1;
  }

  stateForChart.viewStart = nextStart;
  stateForChart.viewEnd = nextEnd;
  stateForChart.userRange = userRange;
}

function zoomJournalTimeChartAt(kind, point, factor) {
  const stateForChart = journalChartState[kind];
  const total = stateForChart.fullSeries.length;
  if (!total || !stateForChart.model) return;

  const range = getJournalTimeChartRange(kind);
  const visibleCount = range.end - range.start + 1;
  const minCount = Math.min(JOURNAL_CHART_MIN_VISIBLE_POINTS, total);
  const nextCount = clamp(Math.round(visibleCount * factor), minCount, total);
  if (nextCount === visibleCount) return;

  const ratio = clamp((point.x - stateForChart.model.pad.left) / Math.max(1, stateForChart.model.innerWidth), 0, 1);
  const anchor = range.start + ratio * Math.max(visibleCount - 1, 1);
  const nextStart = Math.round(anchor - ratio * Math.max(nextCount - 1, 1));
  setJournalTimeChartView(kind, nextStart, nextStart + nextCount - 1, true);
}

function resetJournalTimeChartView(kind, event) {
  if (event) event.preventDefault();
  const stateForChart = journalChartState[kind];
  if (!stateForChart.fullSeries.length) return;
  stateForChart.userRange = false;
  setJournalTimeChartView(kind, 0, stateForChart.fullSeries.length - 1, false);
  requestJournalChartRedraw(kind);
}

function updateJournalTimeHoverFromPoint(kind, point) {
  const stateForChart = journalChartState[kind];
  const previous = stateForChart.hoverIndex;
  const model = stateForChart.model;
  if (!model?.series.length || !isPointInChart(point, model)) {
    stateForChart.hoverIndex = null;
    return previous !== null;
  }

  const relativeX = clamp((point.x - model.pad.left) / Math.max(1, model.innerWidth), 0, 1);
  const visibleIndex = clamp(Math.round(relativeX * Math.max(model.series.length - 1, 0)), 0, model.series.length - 1);
  stateForChart.hoverIndex = model.series[visibleIndex].fullIndex;
  return previous !== stateForChart.hoverIndex;
}

function drawJournalPnlChart(entries) {
  const canvas = els.journalPnlChart;
  if (!canDrawCanvas(canvas)) return;
  const ctx = canvas.getContext("2d");
  const palette = chartPalette();
  const fullSeries = buildJournalPnlSeries(entries);
  setupCanvas(canvas, ctx);
  const size = chartSize(canvas);
  ctx.clearRect(0, 0, size.width, size.height);

  if (!fullSeries.length) {
    syncJournalTimeChartState("pnl", fullSeries, "");
    clearCanvasDomLabels(canvas);
    els.journalPnlChartEmpty.style.display = "grid";
    els.journalPnlSummary.textContent = "Sin entradas con P&L registrado.";
    return;
  }
  els.journalPnlChartEmpty.style.display = "none";

  const first = fullSeries[0];
  const lastFull = fullSeries[fullSeries.length - 1];
  const seriesKey = `${fullSeries.length}:${first.date}:${first.total}:${lastFull.date}:${lastFull.total}:${lastFull.pnl}`;
  syncJournalTimeChartState("pnl", fullSeries, seriesKey);
  const series = getJournalTimeVisibleSeries("pnl");
  const total = lastFull.total;
  const best = Math.max(...fullSeries.map((point) => point.total));
  const worst = Math.min(...fullSeries.map((point) => point.total));
  els.journalPnlSummary.textContent = `${sensitiveSignedMoney(total)} total - Max ${sensitiveSignedMoney(best)} - Min ${sensitiveSignedMoney(worst)}`;

  const rawMin = Math.min(0, ...series.map((point) => point.total));
  const rawMax = Math.max(0, ...series.map((point) => point.total));
  const padding = Math.max((rawMax - rawMin) * 0.12, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const pad = chartPadding(canvas);
  const range = max - min || 1;
  const xFor = (index) => pad.left + (index / Math.max(series.length - 1, 1)) * (size.width - pad.left - pad.right);
  const yFor = (value) => pad.top + ((max - value) / range) * (size.height - pad.top - pad.bottom);
  const zeroY = yFor(0);
  const dateTicks = getXAxisTicks(series.map((point) => ({ ...point, net: point.total })), canvas);
  const model = {
    canvas,
    fullSeries,
    height: size.height,
    innerHeight: size.height - pad.top - pad.bottom,
    innerWidth: size.width - pad.left - pad.right,
    max,
    min,
    pad,
    series,
    viewEnd: getJournalTimeChartRange("pnl").end,
    viewStart: getJournalTimeChartRange("pnl").start,
    width: size.width,
    xFor,
    yFor,
  };
  journalChartState.pnl.model = model;
  if (journalChartState.pnl.pointer) updateJournalTimeHoverFromPoint("pnl", journalChartState.pnl.pointer);

  drawGrid(ctx, canvas, min, max, null);
  drawDateGuides(ctx, canvas, dateTicks, xFor, palette);
  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const axisY = alignCanvasLine(zeroY, canvas);
  ctx.moveTo(pad.left, axisY);
  ctx.lineTo(size.width - pad.right, axisY);
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, yFor(best), 0, zeroY);
  gradient.addColorStop(0, palette.capitalFill);
  gradient.addColorStop(1, palette.capitalFillSoft || "rgba(124, 58, 237, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(xFor(0), zeroY);
  drawSmoothSeriesPath(ctx, series, "total", xFor, yFor, true);
  ctx.lineTo(xFor(series.length - 1), zeroY);
  ctx.closePath();
  ctx.fill();

  drawSeriesLine(ctx, series, "total", xFor, yFor, palette.capital, 3);
  const last = series[series.length - 1];
  const domLabels = getJournalTimeDomLabels(canvas, pad, size, series, formatAxisMoney(max), formatAxisMoney(min));
  if (journalChartState.pnl.hoverIndex === null) {
    domLabels.push(getChartValueDomLabel(formatSignedMoney(last.total), size.width - pad.right, yFor(last.total)));
  } else {
    const tooltip = drawJournalPnlHover(ctx, model, palette);
    if (tooltip) domLabels.push(tooltip);
  }
  setCanvasDomLabels(canvas, domLabels);
}

function buildJournalPnlSeries(entries) {
  const totalsByDate = new Map();
  entries
    .filter((entry) => entry.date && Number.isFinite(Number(entry.pnl)))
    .forEach((entry) => {
      totalsByDate.set(entry.date, (totalsByDate.get(entry.date) || 0) + Number(entry.pnl || 0));
    });

  let total = 0;
  return [...totalsByDate.keys()].sort().map((date) => {
    const pnl = totalsByDate.get(date) || 0;
    total += pnl;
    return { date, pnl, total };
  });
}

function drawJournalDisciplineChart(entries) {
  const canvas = els.journalDisciplineChart;
  if (!canDrawCanvas(canvas)) return;
  const ctx = canvas.getContext("2d");
  const palette = chartPalette();
  const fullSeries = buildJournalDisciplineSeries(entries);
  setupCanvas(canvas, ctx);
  const size = chartSize(canvas);
  ctx.clearRect(0, 0, size.width, size.height);

  if (!fullSeries.length) {
    syncJournalTimeChartState("discipline", fullSeries, "");
    clearCanvasDomLabels(canvas);
    els.journalDisciplineChartEmpty.style.display = "grid";
    els.journalDisciplineSummary.textContent = "Sin entradas con disciplina.";
    return;
  }
  els.journalDisciplineChartEmpty.style.display = "none";

  const firstPoint = fullSeries[0];
  const lastFull = fullSeries[fullSeries.length - 1];
  const seriesKey = `${fullSeries.length}:${firstPoint.date}:${firstPoint.discipline}:${lastFull.date}:${lastFull.discipline}:${lastFull.count}`;
  syncJournalTimeChartState("discipline", fullSeries, seriesKey);
  const series = getJournalTimeVisibleSeries("discipline");
  const average = sum(fullSeries.map((point) => point.discipline)) / fullSeries.length;
  const first = firstPoint.discipline;
  const last = lastFull.discipline;
  const trend = last - first;
  els.journalDisciplineSummary.textContent = `Media ${sensitiveText(`${average.toFixed(1)}/5`)} - ${sensitiveText(`${trend >= 0 ? "+" : ""}${trend.toFixed(1)}`)} desde el inicio.`;

  const min = 1;
  const max = 5;
  const pad = chartPadding(canvas);
  const xFor = (index) => pad.left + (index / Math.max(series.length - 1, 1)) * (size.width - pad.left - pad.right);
  const yFor = (value) => pad.top + ((max - value) / (max - min)) * (size.height - pad.top - pad.bottom);
  const dateTicks = getXAxisTicks(series.map((point) => ({ ...point, net: point.discipline })), canvas);
  const model = {
    canvas,
    fullSeries,
    height: size.height,
    innerHeight: size.height - pad.top - pad.bottom,
    innerWidth: size.width - pad.left - pad.right,
    max,
    min,
    pad,
    series,
    viewEnd: getJournalTimeChartRange("discipline").end,
    viewStart: getJournalTimeChartRange("discipline").start,
    width: size.width,
    xFor,
    yFor,
  };
  journalChartState.discipline.model = model;
  if (journalChartState.discipline.pointer) {
    updateJournalTimeHoverFromPoint("discipline", journalChartState.discipline.pointer);
  }

  drawGrid(ctx, canvas, min, max, null);
  drawDateGuides(ctx, canvas, dateTicks, xFor, palette);
  drawSeriesLine(ctx, series, "discipline", xFor, yFor, palette.cyan || palette.capital, 3);

  ctx.fillStyle = palette.cyan || palette.capital;
  series.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.discipline);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const latest = series[series.length - 1];
  const domLabels = getJournalTimeDomLabels(canvas, pad, size, series, "5/5", "1/5");
  if (journalChartState.discipline.hoverIndex === null) {
    domLabels.push(getChartValueDomLabel(`${latest.discipline.toFixed(1)}/5`, size.width - pad.right, yFor(latest.discipline)));
  } else {
    const tooltip = drawJournalDisciplineHover(ctx, model, palette);
    if (tooltip) domLabels.push(tooltip);
  }
  setCanvasDomLabels(canvas, domLabels);
}

function buildJournalDisciplineSeries(entries) {
  const grouped = new Map();
  entries
    .filter((entry) => entry.date && Number.isFinite(Number(entry.discipline)))
    .forEach((entry) => {
      const values = grouped.get(entry.date) || [];
      values.push(clamp(Number(entry.discipline || 3), 1, 5));
      grouped.set(entry.date, values);
    });

  return [...grouped.keys()].sort().map((date) => {
    const values = grouped.get(date) || [];
    return {
      date,
      count: values.length,
      discipline: sum(values) / Math.max(values.length, 1),
    };
  });
}

function drawJournalPnlHover(ctx, model, palette) {
  const visibleIndex = journalChartState.pnl.hoverIndex - model.viewStart;
  const point = model.series[visibleIndex];
  if (!point) return null;

  const x = model.xFor(visibleIndex);
  const y = model.yFor(point.total);
  drawJournalTimeGuide(ctx, model, x, palette);
  drawHoverDot(ctx, x, y, palette.capital, palette, 5);
  return getChartTooltipDomLabel(
    x,
    y,
    formatDate(point.date),
    [
      { label: "P&L total", value: formatSignedMoney(point.total), color: palette.capital },
      { label: "P&L dia", value: formatSignedMoney(point.pnl), color: point.pnl >= 0 ? palette.green : palette.red },
    ],
    model.canvas
  );
}

function drawJournalDisciplineHover(ctx, model, palette) {
  const visibleIndex = journalChartState.discipline.hoverIndex - model.viewStart;
  const point = model.series[visibleIndex];
  if (!point) return null;

  const x = model.xFor(visibleIndex);
  const y = model.yFor(point.discipline);
  const color = palette.cyan || palette.capital;
  drawJournalTimeGuide(ctx, model, x, palette);
  drawHoverDot(ctx, x, y, color, palette, 5);
  return getChartTooltipDomLabel(
    x,
    y,
    formatDate(point.date),
    [
      { label: "Disciplina", value: `${point.discipline.toFixed(1)}/5`, color },
      { label: "Entradas", value: String(point.count || 1), color: palette.muted },
    ],
    model.canvas
  );
}

function drawJournalTimeGuide(ctx, model, x, palette) {
  const guideX = alignCanvasLine(x, model.canvas);
  ctx.save();
  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(guideX, model.pad.top);
  ctx.lineTo(guideX, model.height - model.pad.bottom);
  ctx.stroke();
  ctx.restore();
}

function getJournalTimeDomLabels(canvas, pad, size, series, topLabel, bottomLabel) {
  return [
    { kind: "label", className: "axis-y", text: sensitiveText(topLabel), x: pad.left - 8, y: pad.top, anchor: "right-middle" },
    { kind: "label", className: "axis-y", text: sensitiveText(bottomLabel), x: pad.left - 8, y: size.height - pad.bottom, anchor: "right-middle" },
    { kind: "label", className: "axis-x", text: formatShortDate(series[0]?.date), x: pad.left, y: size.height - 10, anchor: "left-bottom" },
    {
      kind: "label",
      className: "axis-x",
      text: formatShortDate(series[series.length - 1]?.date),
      x: size.width - pad.right,
      y: size.height - 10,
      anchor: "right-bottom",
    },
  ];
}

function getChartValueDomLabel(text, x, y) {
  return { kind: "value", text: sensitiveText(text), x, y: y - 8, anchor: "right-top" };
}

function getChartTooltipDomLabel(x, y, title, rows, canvas = null) {
  const size = canvas ? chartSize(canvas) : { width: 0 };
  const anchor = size.width && x > size.width * 0.62 ? "tooltip-left" : "tooltip-right";
  return {
    kind: "tooltip",
    x,
    y,
    title,
    rows: rows.map((row) => ({ ...row, value: sensitiveText(row.value) })),
    anchor,
  };
}

function getChartCenterDomLabel(value, label, x, y) {
  return { kind: "center", value: sensitiveText(value), label, x, y };
}

function drawJournalErrorsChart(entries) {
  const canvas = els.journalErrorsChart;
  if (!canDrawCanvas(canvas)) return;
  const ctx = canvas.getContext("2d");
  const rows = getJournalErrorRows(entries);
  setupCanvas(canvas, ctx);
  const size = chartSize(canvas);
  ctx.clearRect(0, 0, size.width, size.height);

  if (!rows.length) {
    journalChartState.errors.model = null;
    journalChartState.errors.hoverIndex = null;
    clearCanvasDomLabels(canvas);
    els.journalErrorsChartEmpty.style.display = "grid";
    els.journalErrorsSummary.textContent = "Sin errores registrados.";
    els.journalErrorsLegend.innerHTML = "";
    return;
  }
  els.journalErrorsChartEmpty.style.display = "none";

  const total = sum(rows.map((row) => row.count));
  els.journalErrorsSummary.textContent = `${sensitiveCount(total)} ${total === 1 ? "error registrado" : "errores registrados"} en el filtro actual.`;
  els.journalErrorsLegend.innerHTML = rows
    .map(
      (row) => `
        <div class="journal-error-legend-row">
          <i style="--error-color: ${escapeHtml(row.color)}"></i>
          <span>${escapeHtml(row.label)}</span>
          <strong>${sensitiveCount(row.count)}</strong>
        </div>
      `
    )
    .join("");

  const radius = Math.max(1, Math.min(size.width, size.height) * 0.38);
  const innerRadius = radius * 0.5;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  let start = -Math.PI / 2;
  const segments = [];

  rows.forEach((row, index) => {
    const angle = (row.count / total) * Math.PI * 2;
    const isHover = journalChartState.errors.hoverIndex === index;
    const segmentRadius = isHover ? radius + 5 : radius;
    ctx.save();
    if (journalChartState.errors.hoverIndex !== null && !isHover) ctx.globalAlpha = 0.58;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, segmentRadius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = row.color;
    ctx.fill();
    ctx.restore();
    segments.push({ end: start + angle, index, row, start });
    start += angle;
  });
  journalChartState.errors.model = { canvas, centerX, centerY, innerRadius, radius, segments };

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = themeColor("--surface");
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(1, innerRadius - 1), 0, Math.PI * 2);
  ctx.fill();

  const domLabels = [getChartCenterDomLabel(String(total), "errores", centerX, centerY)];
  if (journalChartState.errors.hoverIndex !== null) {
    const tooltip = drawJournalErrorsHover(ctx, journalChartState.errors.model);
    if (tooltip) domLabels.push(tooltip);
  }
  setCanvasDomLabels(canvas, domLabels);
}

function getJournalErrorsSegmentIndex(point, model) {
  const dx = point.x - model.centerX;
  const dy = point.y - model.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < model.innerRadius || distance > model.radius + 8) return null;

  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  return model.segments.find((segment) => angle >= segment.start && angle <= segment.end)?.index ?? null;
}

function drawJournalErrorsHover(ctx, model) {
  const segment = model.segments.find((item) => item.index === journalChartState.errors.hoverIndex);
  if (!segment) return null;
  const middleAngle = (segment.start + segment.end) / 2;
  const x = model.centerX + Math.cos(middleAngle) * model.radius;
  const y = model.centerY + Math.sin(middleAngle) * model.radius;
  const total = sum(model.segments.map((item) => item.row.count));
  const percent = total ? (segment.row.count / total) * 100 : 0;
  return getChartTooltipDomLabel(
    x,
    y,
    segment.row.label,
    [
      { label: "Veces", value: String(segment.row.count), color: segment.row.color },
      { label: "Peso", value: `${percent.toFixed(0)}%`, color: "var(--muted)" },
    ],
    model.canvas
  );
}

function getJournalErrorRows(entries) {
  const counts = new Map();
  entries.forEach((entry) => {
    sanitizeJournalErrors(entry.errors).forEach((error) => {
      counts.set(error, (counts.get(error) || 0) + 1);
    });
  });
  const knownRows = getJournalErrorTypes({ activeOnly: false })
    .map((type) => ({
      id: type.id,
      label: type.label,
      color: type.color,
      count: counts.get(type.id) || 0,
    }));
  const knownIds = new Set(knownRows.map((row) => row.id));
  counts.forEach((count, id) => {
    if (!knownIds.has(id)) {
      knownRows.push({ id, label: id, color: "#71717a", count });
    }
  });
  return knownRows
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

function renderJournalErrorSettings() {
  const errorTypes = getJournalErrorTypes({ activeOnly: false });
  if (!els.journalErrorTypesList) return;
  els.journalErrorTypesList.innerHTML = errorTypes
    .map((type) => {
      const count = state.journalEntries.filter((entry) => sanitizeJournalErrors(entry.errors).includes(type.id)).length;
      return `
        <div class="journal-error-type-row${type.active ? "" : " is-archived"}">
          <i style="--error-color: ${escapeHtml(type.color)}"></i>
          <div>
            <strong>${escapeHtml(type.label)}</strong>
            <span>${count} ${count === 1 ? "entrada" : "entradas"}${type.active ? "" : " - oculto"}</span>
          </div>
          <div class="row-actions">
            ${actionButton("edit-journal-error", type.id, "Editar", "pencil")}
            ${actionButton(type.active ? "archive-journal-error" : "restore-journal-error", type.id, type.active ? "Ocultar" : "Activar", type.active ? "eye-off" : "eye")}
          </div>
        </div>
      `;
    })
    .join("");
  refreshIcons();
}

function renderJournalErrorChoices(selectedErrors = getSelectedJournalErrors()) {
  if (!els.journalErrorsOptions) return;
  const selected = new Set(sanitizeJournalErrors(selectedErrors));
  const activeTypes = getJournalErrorTypes({ activeOnly: false }).filter((type) => type.active || selected.has(type.id));
  els.journalErrorsOptions.innerHTML = activeTypes.length
    ? activeTypes
        .map(
          (type) => `
            <label>
              <input type="checkbox" name="journalErrors" value="${escapeHtml(type.id)}" ${selected.has(type.id) ? "checked" : ""} />
              <i style="--error-color: ${escapeHtml(type.color)}"></i>
              <span>${escapeHtml(type.label)}</span>
            </label>
          `
        )
        .join("")
    : `<p class="journal-errors-empty">Añade errores desde el dashboard para marcarlos aqui.</p>`;
}

function getFilteredJournalEntries(options = {}) {
  const includePeriod = options.includePeriod !== false;
  const includeSearch = options.includeSearch !== false;
  const includeSelectedDate = options.includeSelectedDate !== false;
  const includeAccount = options.includeAccount !== false;
  const accountSelect = options.accountSource === "entries" ? els.journalEntriesAccountFilter : els.journalAccountFilter;
  const accountFilter = includeAccount ? accountSelect?.value || "all" : "all";
  const period = els.journalPeriodFilter.value || "all";
  const { from, to } = includePeriod ? getPeriodDateRange(period) : { from: "", to: "" };
  const search = includeSearch ? normalize(els.journalSearch.value) : "";

  return state.journalEntries
    .filter((entry) => accountFilter === "all" || entry.accountId === accountFilter)
    .filter((entry) => !from || entry.date >= from)
    .filter((entry) => !to || entry.date <= to)
    .filter((entry) => !includeSelectedDate || !journalSelectedDate || entry.date === journalSelectedDate)
    .filter((entry) => {
      if (!search) return true;
      const firm = getFirm(entry.firmId);
      const account = getAccount(entry.accountId);
      const text = [
        entry.title,
        getJournalDirectionLabel(entry),
        entry.notes,
        entry.pnl,
        entry.operationUrl,
        sanitizeJournalErrors(entry.errors).map(getJournalErrorLabel).join(" "),
        journalSessionLabels[entry.sessionType],
        journalResultLabels[entry.result],
        journalEmotionLabels[entry.emotion],
        firm?.name,
        account?.name,
      ].join(" ");
      return normalize(text).includes(search);
    });
}

function renderJournalCalendar() {
  const monthStart = parseLocalDate(`${journalCalendarMonth}-01`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - startOffset);
  const entries = getFilteredJournalEntries({ includePeriod: false, includeSearch: false, includeSelectedDate: false });
  const entriesByDate = new Map();

  entries.forEach((entry) => {
    if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, []);
    entriesByDate.get(entry.date).push(entry);
  });

  const header = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
    .map((day) => `<div class="journal-calendar-head">${day}</div>`)
    .join("");
  const rows = [];
  const monthEntries = [];

  while (cursor <= monthEnd || rows.length === 0) {
    const weekCells = [];
    const weekEntries = [];

    for (let day = 0; day < 7; day += 1) {
      const iso = dateToIsoDate(cursor);
      const dayEntries = entriesByDate.get(iso) || [];
      const dayPnl = sum(dayEntries.map((entry) => entry.pnl));
      const isCurrentMonth = cursor.getMonth() === monthStart.getMonth();
      const className = [
        "journal-calendar-day",
        isCurrentMonth ? "is-current" : "is-adjacent",
        dayEntries.length ? "has-entries" : "",
        journalSelectedDate === iso ? "is-selected" : "",
        pnlToneClass(dayPnl),
      ]
        .filter(Boolean)
        .join(" ");

      if (isCurrentMonth) monthEntries.push(...dayEntries);
      weekEntries.push(...dayEntries);
      weekCells.push(`
        <button class="${className}" type="button" data-action="select-journal-day" data-date="${iso}">
          <span class="journal-calendar-date">${cursor.getDate()}</span>
          ${dayEntries.length ? `<strong>${sensitiveSignedMoney(dayPnl)}</strong>` : "<strong></strong>"}
          ${dayEntries.length && !dashboardPrivacyHidden ? `<small>${dayEntries.length} ${dayEntries.length === 1 ? "entrada" : "entradas"}</small>` : "<small></small>"}
        </button>
      `);
      cursor.setDate(cursor.getDate() + 1);
    }

    const weekPnl = sum(weekEntries.map((entry) => entry.pnl));
    rows.push(`
      ${weekCells.join("")}
      <div class="journal-calendar-week-total ${pnlToneClass(weekPnl)}">
        <span>Semana</span>
        <strong>${sensitiveSignedMoney(weekPnl)}</strong>
        ${!dashboardPrivacyHidden ? `<small>${weekEntries.length} ${weekEntries.length === 1 ? "entrada" : "entradas"}</small>` : "<small></small>"}
      </div>
    `);
  }

  const monthPnl = sum(monthEntries.map((entry) => entry.pnl));
  const activeDays = new Set(monthEntries.map((entry) => entry.date));
  const winningDays = [...activeDays].filter((date) => sum((entriesByDate.get(date) || []).map((entry) => entry.pnl)) > 0);
  els.journalCalendarMonth.textContent = formatMonthLabel(journalCalendarMonth);
  els.journalMonthTotal.textContent = sensitiveSignedMoney(monthPnl);
  els.journalMonthTotal.className = pnlToneClass(monthPnl);
    els.journalCalendarGrid.innerHTML = `${header}<div class="journal-calendar-head weekly">Semana</div>${rows.join("")}`;
  els.journalViewHeading.hidden = !journalSelectedDate;
  els.journalSelectedDateLabel.hidden = !journalSelectedDate;
  els.journalClearDateButton.hidden = !journalSelectedDate;
  els.journalSelectedDateLabel.textContent = journalSelectedDate ? `Dia seleccionado: ${formatDate(journalSelectedDate)}` : "";
  refreshIcons();
}

function renderJournalEntries() {
  const entries = getFilteredJournalEntries({ accountSource: "entries" })
    .sort((a, b) => {
      const byDate = (b.date || "").localeCompare(a.date || "");
      return byDate || (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  els.journalEntriesList.innerHTML = entries.map(journalCardHtml).join("");
  els.journalEntriesList.hidden = entries.length === 0;

  if (entries.length) {
    hideEmptyState(els.journalEmpty);
  } else if (!state.firms.length) {
    showEmptyState(
      els.journalEmpty,
      "Primero crea una firm",
      "El journal se organiza por firm para que puedas revisar cada etapa con contexto.",
      "Nueva firm",
      "add-firm"
    );
  } else if (!state.journalEntries.length) {
    showEmptyState(
      els.journalEmpty,
      "Todavia no hay entradas",
      "Registra operaciones, decisiones y notas sin mezclarlo con los movimientos economicos.",
      "Nueva entrada",
      "add-journal"
    );
  } else {
    showEmptyState(
      els.journalEmpty,
      "Sin entradas con esos filtros",
      "Ajusta la cuenta, el periodo o la busqueda para ver mas resultados.",
      "Limpiar filtros",
      "reset-journal-filters",
      "rotate-ccw"
    );
  }
  refreshIcons();
}

function journalCardHtml(entry) {
  const pnl = Number(entry.pnl || 0);
  const tone = pnlToneClass(pnl);
  const asset = getJournalAssetLabel(entry);
  const cardTitle = formatJournalGalleryTitle(entry);
  const direction = normalizeJournalDirection(entry.direction);
  const directionLabel = getJournalDirectionLabel(entry);
  const media = getJournalGalleryMediaHtml(entry.operationUrl, asset);

  return `
    <article
      class="journal-card ${tone}"
      tabindex="0"
      data-id="${escapeHtml(entry.id)}"
      aria-label="${escapeHtml(cardTitle)}"
    >
      ${media}
      <div class="journal-card-footer">
        <strong class="journal-card-title">
          <span>${escapeHtml(asset)}</span>
          ${direction ? `<em class="journal-card-direction ${direction}">${escapeHtml(directionLabel)}</em>` : ""}
        </strong>
        <span class="journal-gallery-pnl ${tone}">${formatSignedMoney(pnl)}</span>
      </div>
    </article>
  `;
}

function getJournalGalleryMediaHtml(operationUrl, title = "") {
  const alt = escapeHtml(title || "Captura de la operacion");
  if (isImageDataUrl(operationUrl)) {
    return `
      <a class="journal-gallery-media" href="${escapeHtml(operationUrl)}" target="_blank" rel="noreferrer" aria-label="Abrir captura">
        <img src="${escapeHtml(operationUrl)}" alt="${alt}" />
      </a>
    `;
  }
  if (operationUrl) {
    return `
      <a class="journal-gallery-media is-placeholder" href="${escapeHtml(operationUrl)}" target="_blank" rel="noreferrer">
        <i data-lucide="external-link"></i>
        <span>Ver operacion</span>
      </a>
    `;
  }
  return `
    <div class="journal-gallery-media is-placeholder">
      <i data-lucide="image"></i>
      <span>Sin captura</span>
    </div>
  `;
}

function getJournalAssetLabel(entry) {
  return entry?.title || "Activo sin definir";
}

function normalizeJournalAsset(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeJournalDirection(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return journalDirectionLabels[normalized] ? normalized : "";
}

function getJournalDirectionLabel(entry) {
  return journalDirectionLabels[normalizeJournalDirection(entry?.direction)] || "Sin dirección";
}

function formatJournalGalleryTitle(entry) {
  const asset = getJournalAssetLabel(entry);
  const direction = normalizeJournalDirection(entry?.direction);
  return direction ? `${asset} ${getJournalDirectionLabel(entry)}` : asset;
}

function formatJournalGalleryDate(value) {
  if (!value) return "Sin fecha";
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}/${month}/${date.getFullYear()}`;
}

function setTableVisible(tableBody, isVisible) {
  const tableWrap = tableBody?.closest(".table-wrap");
  if (tableWrap) {
    tableWrap.hidden = !isVisible;
  }
}

function showEmptyState(element, title, text, actionLabel = "", action = "", icon = "plus") {
  if (!element) return;
  const button = action
    ? `<button class="secondary-button compact-button" type="button" data-empty-action="${escapeHtml(action)}">
        <i data-lucide="${escapeHtml(icon)}"></i>
        <span>${escapeHtml(actionLabel)}</span>
      </button>`
    : "";

  element.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(text)}</span>
    ${button}
  `;
  element.style.display = "grid";
}

function hideEmptyState(element) {
  if (!element) return;
  element.style.display = "none";
  element.innerHTML = "";
}

function drawCharts(summary) {
  drawNetChart(summary.transactions);
  drawMonthChart(summary.transactions);
}

function syncNetChartState(fullSeries) {
  netChartState.fullSeries = fullSeries;

  if (!fullSeries.length) {
    netChartState.hoverIndex = null;
    netChartState.model = null;
    netChartState.pointer = null;
    netChartState.seriesKey = "";
    netChartState.userRange = false;
    netChartState.viewStart = 0;
    netChartState.viewEnd = 0;
    return;
  }

  const first = fullSeries[0];
  const last = fullSeries[fullSeries.length - 1];
  const seriesKey = `${fullSeries.length}:${first.date}:${first.net}:${last.date}:${last.net}:${last.income}:${last.expense}`;
  if (seriesKey !== netChartState.seriesKey) {
    netChartState.seriesKey = seriesKey;
    if (!netChartState.userRange) {
      netChartState.viewStart = 0;
      netChartState.viewEnd = fullSeries.length - 1;
    }
  }

  setNetChartView(netChartState.viewStart, netChartState.viewEnd, netChartState.userRange);
  if (netChartState.hoverIndex > fullSeries.length - 1) {
    netChartState.hoverIndex = null;
  }
}

function getNetChartRange(fullSeries) {
  if (!fullSeries.length) return { start: 0, end: 0 };
  const start = clamp(Math.round(netChartState.viewStart), 0, fullSeries.length - 1);
  const end = clamp(Math.round(netChartState.viewEnd), start, fullSeries.length - 1);
  return { start, end };
}

function getNetChartVisibleSeries(fullSeries) {
  const range = getNetChartRange(fullSeries);
  return fullSeries.slice(range.start, range.end + 1).map((point, index) => ({
    ...point,
    fullIndex: range.start + index,
  }));
}

function setNetChartView(start, end, userRange = true) {
  const total = netChartState.fullSeries.length;
  if (!total) return;

  const lastIndex = total - 1;
  const desiredCount = Math.max(1, Math.round(end - start + 1));
  const visibleCount = Math.min(total, Math.max(Math.min(NET_CHART_MIN_VISIBLE_POINTS, total), desiredCount));

  if (visibleCount >= total) {
    netChartState.viewStart = 0;
    netChartState.viewEnd = lastIndex;
    netChartState.userRange = false;
    return;
  }

  let nextStart = Math.round(start);
  let nextEnd = nextStart + visibleCount - 1;

  if (nextStart < 0) {
    nextStart = 0;
    nextEnd = visibleCount - 1;
  }
  if (nextEnd > lastIndex) {
    nextEnd = lastIndex;
    nextStart = lastIndex - visibleCount + 1;
  }

  netChartState.viewStart = nextStart;
  netChartState.viewEnd = nextEnd;
  netChartState.userRange = userRange;
}

function zoomNetChartAt(point, factor) {
  const total = netChartState.fullSeries.length;
  if (!total || !netChartState.model) return;

  const range = getNetChartRange(netChartState.fullSeries);
  const visibleCount = range.end - range.start + 1;
  const minCount = Math.min(NET_CHART_MIN_VISIBLE_POINTS, total);
  const nextCount = clamp(Math.round(visibleCount * factor), minCount, total);
  if (nextCount === visibleCount) return;

  const ratio = clamp((point.x - netChartState.model.pad.left) / Math.max(1, netChartState.model.innerWidth), 0, 1);
  const anchor = range.start + ratio * Math.max(visibleCount - 1, 1);
  const nextStart = Math.round(anchor - ratio * Math.max(nextCount - 1, 1));
  setNetChartView(nextStart, nextStart + nextCount - 1, true);
}

function resetNetChartView(event) {
  if (event) event.preventDefault();
  if (!netChartState.fullSeries.length) return;
  netChartState.userRange = false;
  setNetChartView(0, netChartState.fullSeries.length - 1, false);
  requestNetChartRedraw();
}

function resetNetChartInteraction() {
  netChartState.dragStartView = null;
  netChartState.dragging = false;
  netChartState.hoverIndex = null;
  netChartState.pointer = null;
  netChartState.pointerId = null;
  netChartState.userRange = false;
  netChartState.viewStart = 0;
  netChartState.viewEnd = Math.max(0, netChartState.fullSeries.length - 1);
}

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const size = chartSize(canvas);
  const scaleX = size.width / Math.max(rect.width, 1);
  const scaleY = size.height / Math.max(rect.height, 1);
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function isPointInChart(point, model) {
  return (
    point.x >= model.pad.left &&
    point.x <= model.width - model.pad.right &&
    point.y >= model.pad.top &&
    point.y <= model.height - model.pad.bottom
  );
}

function updateNetChartHoverFromPoint(point) {
  const previous = netChartState.hoverIndex;
  const model = netChartState.model;
  if (!model?.series.length || !isPointInChart(point, model)) {
    netChartState.hoverIndex = null;
    return previous !== null;
  }

  const relativeX = clamp((point.x - model.pad.left) / Math.max(1, model.innerWidth), 0, 1);
  const visibleIndex = clamp(Math.round(relativeX * Math.max(model.series.length - 1, 0)), 0, model.series.length - 1);
  netChartState.hoverIndex = model.series[visibleIndex].fullIndex;
  return previous !== netChartState.hoverIndex;
}

function drawNetChart(transactions) {
  const canvas = els.netChart;
  const ctx = canvas.getContext("2d");
  const fullSeries = buildCapitalSeries(transactions);
  const palette = chartPalette();

  setupCanvas(canvas, ctx);
  const size = chartSize(canvas);
  ctx.clearRect(0, 0, size.width, size.height);

  if (!fullSeries.length) {
    syncNetChartState(fullSeries);
    els.netChartEmpty.style.display = "grid";
    return;
  }
  els.netChartEmpty.style.display = "none";

  syncNetChartState(fullSeries);
  const series = getNetChartVisibleSeries(fullSeries);
  const values = series.flatMap((point) => [point.net, point.income, point.expense]);
  const rawMin = Math.min(0, ...series.map((point) => point.net));
  const rawMax = Math.max(0, ...values);
  const padding = Math.max((rawMax - rawMin) * 0.08, rawMax > 0 ? rawMax * 0.04 : 1);
  const min = rawMin < 0 ? rawMin - padding : 0;
  const max = rawMax + padding;
  drawGrid(ctx, canvas, min, max);

  const pad = chartPadding(canvas);
  const range = max - min || 1;
  const xFor = (index) => pad.left + (index / Math.max(series.length - 1, 1)) * (size.width - pad.left - pad.right);
  const yFor = (value) => pad.top + ((max - value) / range) * (size.height - pad.top - pad.bottom);
  const dateTicks = getXAxisTicks(series, canvas);
  const model = {
    canvas,
    fullSeries,
    height: size.height,
    innerHeight: size.height - pad.top - pad.bottom,
    innerWidth: size.width - pad.left - pad.right,
    max,
    min,
    pad,
    series,
    viewEnd: getNetChartRange(fullSeries).end,
    viewStart: getNetChartRange(fullSeries).start,
    width: size.width,
    xFor,
    yFor,
  };
  netChartState.model = model;
  if (netChartState.pointer) {
    updateNetChartHoverFromPoint(netChartState.pointer);
  }

  const zeroY = yFor(0);
  drawDateGuides(ctx, canvas, dateTicks, xFor, palette);
  drawCapitalArea(ctx, series, xFor, yFor, zeroY, palette);

  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const axisY = alignCanvasLine(zeroY, canvas);
  ctx.moveTo(pad.left, axisY);
  ctx.lineTo(size.width - pad.right, axisY);
  ctx.stroke();

  drawSeriesLine(ctx, series, "expense", xFor, yFor, palette.red, 2);
  drawSeriesLine(ctx, series, "income", xFor, yFor, palette.green, 2);
  drawSeriesLine(ctx, series, "net", xFor, yFor, palette.capital, 3);

  const last = series[series.length - 1];
  ctx.fillStyle = palette.capital;
  ctx.beginPath();
  ctx.arc(xFor(series.length - 1), yFor(last.net), 5, 0, Math.PI * 2);
  ctx.fill();

  drawXAxisLabels(ctx, canvas, dateTicks, xFor, palette);
  if (netChartState.hoverIndex === null) {
    drawChartLabel(ctx, canvas, `${formatMoney(last.net)}`, size.width - pad.right, yFor(last.net), "right");
  } else {
    drawNetChartHover(ctx, model, palette);
  }
}

function buildCapitalSeries(transactions) {
  const validTransactions = transactions.filter((tx) => tx.date && Number(tx.amount) > 0);
  if (!validTransactions.length) return [];

  const totalsByDate = new Map();
  validTransactions.forEach((tx) => {
    const current = totalsByDate.get(tx.date) || { income: 0, expense: 0 };
    if (tx.kind === "income") current.income += Number(tx.amount);
    else current.expense += Number(tx.amount);
    totalsByDate.set(tx.date, current);
  });

  const dates = [...totalsByDate.keys()].sort();
  let cursor = shiftIsoDate(dates[0], -1);
  const end = shiftIsoDate(dates[dates.length - 1], 1);
  let net = 0;
  const series = [];

  while (cursor <= end) {
    const totals = totalsByDate.get(cursor) || { income: 0, expense: 0 };
    net += totals.income - totals.expense;
    series.push({
      date: cursor,
      income: totals.income,
      expense: totals.expense,
      net,
    });
    cursor = shiftIsoDate(cursor, 1);
  }

  return series;
}

function drawNetChartHover(ctx, model, palette) {
  const visibleIndex = netChartState.hoverIndex - model.viewStart;
  const point = model.series[visibleIndex];
  if (!point) return;

  const x = model.xFor(visibleIndex);
  const netY = model.yFor(point.net);
  const incomeY = model.yFor(point.income);
  const expenseY = model.yFor(point.expense);
  const bottom = model.height - model.pad.bottom;

  ctx.save();
  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(x, model.pad.top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.restore();

  drawHoverDot(ctx, x, expenseY, palette.red, palette);
  drawHoverDot(ctx, x, incomeY, palette.green, palette);
  drawHoverDot(ctx, x, netY, palette.capital, palette, 5);

  drawChartTooltip(
    ctx,
    model.canvas,
    x,
    netY,
    formatDate(point.date),
    [
      { label: "Capital", value: formatMoney(point.net), color: palette.capital },
      { label: "Payouts", value: formatMoney(point.income), color: palette.green },
      { label: "Gastos", value: formatMoney(point.expense), color: palette.red },
      {
        label: "Neto dia",
        value: formatMoney(point.income - point.expense),
        color: point.income - point.expense >= 0 ? palette.green : palette.red,
      },
    ],
    palette
  );
}

function drawHoverDot(ctx, x, y, color, palette, radius = 4) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = palette.labelBg;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawChartTooltip(ctx, canvas, x, y, title, rows, palette) {
  ctx.save();
  const displayRows = rows.map((row) => ({ ...row, value: sensitiveText(row.value) }));
  const size = chartSize(canvas);
  const horizontalPadding = 12;
  const rowGap = 21;
  const titleHeight = 28;
  ctx.font = "600 12px system-ui, sans-serif";
  const titleWidth = ctx.measureText(title).width;
  ctx.font = "12px system-ui, sans-serif";
  const rowWidth = Math.max(
    titleWidth,
    ...displayRows.map((row) => ctx.measureText(row.label).width + ctx.measureText(row.value).width + 48)
  );
  const width = Math.min(size.width - 16, Math.max(188, rowWidth + horizontalPadding * 2));
  const height = titleHeight + rows.length * rowGap + 8;
  let left = x + 14;
  if (left + width > size.width - 8) left = x - width - 14;
  left = clamp(left, 8, size.width - width - 8);
  const top = clamp(y - height / 2, 8, size.height - height - 8);

  ctx.fillStyle = palette.labelBg;
  ctx.strokeStyle = palette.labelBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, left, top, width, height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.labelText;
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, left + horizontalPadding, top + 17);

  displayRows.forEach((row, index) => {
    const rowY = top + titleHeight + 10 + index * rowGap;
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(left + horizontalPadding + 3, rowY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.muted;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(row.label, left + horizontalPadding + 14, rowY);

    ctx.fillStyle = palette.labelText;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(row.value, left + width - horizontalPadding, rowY);
  });

  ctx.restore();
}

function drawCapitalArea(ctx, series, xFor, yFor, zeroY, palette) {
  const topY = Math.min(...series.map((point) => yFor(point.net)));
  const gradient = ctx.createLinearGradient(0, topY, 0, zeroY);
  gradient.addColorStop(0, palette.capitalFill);
  gradient.addColorStop(1, palette.capitalFillSoft || "rgba(124, 58, 237, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(xFor(0), zeroY);
  drawSmoothSeriesPath(ctx, series, "net", xFor, yFor, true);
  ctx.lineTo(xFor(series.length - 1), zeroY);
  ctx.closePath();
  ctx.fill();
}

function drawSeriesLine(ctx, series, key, xFor, yFor, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  drawSmoothSeriesPath(ctx, series, key, xFor, yFor);
  ctx.stroke();
}

function drawSmoothSeriesPath(ctx, series, key, xFor, yFor, connectFromCurrentPoint = false) {
  if (!series.length) return;

  const points = series.map((point, index) => ({
    x: xFor(index),
    y: yFor(point[key]),
  }));

  if (connectFromCurrentPoint) ctx.lineTo(points[0].x, points[0].y);
  else ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) return;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
}

function drawDateGuides(ctx, canvas, ticks, xFor, palette) {
  const pad = chartPadding(canvas);
  const size = chartSize(canvas);
  const top = pad.top;
  const bottom = size.height - pad.bottom;
  ctx.strokeStyle = palette.guide;
  ctx.lineWidth = 1;

  ticks.forEach((tick) => {
    const x = alignCanvasLine(xFor(tick.index), canvas);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  });
}

function drawXAxisLabels(ctx, canvas, ticks, xFor, palette) {
  const pad = chartPadding(canvas);
  const size = chartSize(canvas);
  ctx.fillStyle = palette.muted;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";

  ticks.forEach((tick, tickIndex) => {
    const x = xFor(tick.index);
    const label = formatShortDate(tick.date);
    if (tickIndex === 0) ctx.textAlign = "left";
    else if (tickIndex === ticks.length - 1) ctx.textAlign = "right";
    else ctx.textAlign = "center";
    ctx.fillText(label, x, size.height - 10);
  });
}

function getXAxisTicks(series, canvas) {
  if (!series.length) return [];

  const pad = chartPadding(canvas);
  const size = chartSize(canvas);
  const innerWidth = size.width - pad.left - pad.right;
  const maxLabels = Math.max(2, Math.floor(innerWidth / 105));
  const totalDays = Math.max(1, series.length - 1);
  const rawInterval = Math.ceil(totalDays / Math.max(maxLabels - 1, 1));
  const interval = chooseDayInterval(rawInterval);
  const ticks = [];

  for (let index = 0; index < series.length; index += interval) {
    ticks.push({ index, date: series[index].date });
  }

  const lastIndex = series.length - 1;
  if (ticks[ticks.length - 1]?.index !== lastIndex) {
    ticks.push({ index: lastIndex, date: series[lastIndex].date });
  }

  return preventCrowdedDateTicks(ticks, xForTick(series, canvas), 70);
}

function chooseDayInterval(rawInterval) {
  const intervals = [1, 2, 3, 5, 7, 10, 14, 15, 30, 45, 60, 90, 180, 365];
  return intervals.find((interval) => interval >= rawInterval) || rawInterval;
}

function preventCrowdedDateTicks(ticks, xFor, minDistance) {
  if (ticks.length <= 2) return ticks;

  const filtered = [ticks[0]];
  for (let index = 1; index < ticks.length - 1; index += 1) {
    const previous = filtered[filtered.length - 1];
    const current = ticks[index];
    if (xFor(current.index) - xFor(previous.index) >= minDistance) {
      filtered.push(current);
    }
  }

  const last = ticks[ticks.length - 1];
  const previous = filtered[filtered.length - 1];
  if (xFor(last.index) - xFor(previous.index) < minDistance && filtered.length > 1) {
    filtered.pop();
  }
  filtered.push(last);
  return filtered;
}

function xForTick(series, canvas) {
  const pad = chartPadding(canvas);
  const size = chartSize(canvas);
  return (index) => pad.left + (index / Math.max(series.length - 1, 1)) * (size.width - pad.left - pad.right);
}

function drawMonthChart(transactions) {
  const canvas = els.monthChart;
  const ctx = canvas.getContext("2d");
  const palette = chartPalette();
  setupCanvas(canvas, ctx);
  const size = chartSize(canvas);
  ctx.clearRect(0, 0, size.width, size.height);

  if (!transactions.length) {
    els.monthChartEmpty.style.display = "grid";
    return;
  }
  els.monthChartEmpty.style.display = "none";

  const months = getLastMonths(6, transactions);
  const grouped = months.map((month) => {
    const txs = transactions.filter((tx) => toMonthKey(tx.date) === month.key);
    const expenses = sum(txs.filter((tx) => tx.kind === "expense").map((tx) => tx.amount));
    const income = sum(txs.filter((tx) => tx.kind === "income").map((tx) => tx.amount));
    return { ...month, expenses, income };
  });
  const max = Math.max(1, ...grouped.flatMap((item) => [item.expenses, item.income]));
  const pad = chartPadding(canvas);
  const innerWidth = size.width - pad.left - pad.right;
  const innerHeight = size.height - pad.top - pad.bottom;
  const groupWidth = innerWidth / grouped.length;
  const barWidth = Math.max(8, Math.min(26, groupWidth * 0.25));

  drawGrid(ctx, canvas, 0, max);

  grouped.forEach((item, index) => {
    const center = pad.left + index * groupWidth + groupWidth / 2;
    const expenseHeight = (item.expenses / max) * innerHeight;
    const incomeHeight = (item.income / max) * innerHeight;
    const baseline = pad.top + innerHeight;

    ctx.fillStyle = palette.red;
    roundRect(ctx, center - barWidth - 2, baseline - expenseHeight, barWidth, expenseHeight, 4);
    ctx.fill();

    ctx.fillStyle = palette.green;
    roundRect(ctx, center + 2, baseline - incomeHeight, barWidth, incomeHeight, 4);
    ctx.fill();

    ctx.fillStyle = palette.muted;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.label, center, size.height - 10);
  });
}

function setupCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 4));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  canvas.chartWidth = width;
  canvas.chartHeight = height;
  canvas.chartDpr = dpr;
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

function chartSize(canvas) {
  return {
    height: canvas.chartHeight || canvas.getBoundingClientRect().height || canvas.height,
    width: canvas.chartWidth || canvas.getBoundingClientRect().width || canvas.width,
  };
}

function alignCanvasLine(value, canvas, lineWidth = 1) {
  const dpr = canvas?.chartDpr || Math.max(1, window.devicePixelRatio || 1);
  const physicalWidth = Math.max(1, Math.round(lineWidth * dpr));
  const physicalValue = Math.round(value * dpr);
  const offset = physicalWidth % 2 === 1 ? 0.5 : 0;
  return (physicalValue + offset) / dpr;
}

function setCanvasDomLabels(canvas, items = []) {
  const wrap = canvas?.parentElement;
  if (!wrap || typeof document.createElement !== "function") return;
  let layer = wrap.querySelector(".canvas-dom-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "canvas-dom-layer";
    wrap.appendChild(layer);
  }
  layer.innerHTML = "";
  items.filter(Boolean).forEach((item) => {
    const element = document.createElement("div");
    element.className = `canvas-dom-item ${item.kind ? `is-${item.kind}` : ""} ${item.className || ""}`;
    element.style.left = `${Math.round(item.x)}px`;
    element.style.top = `${Math.round(item.y)}px`;
    element.dataset.anchor = item.anchor || "";

    if (item.kind === "tooltip") {
      renderCanvasDomTooltip(element, item);
    } else if (item.kind === "center") {
      element.innerHTML = `<strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span>`;
    } else {
      element.textContent = item.text || "";
    }
    layer.appendChild(element);
  });
}

function clearCanvasDomLabels(canvas) {
  const layer = canvas?.parentElement?.querySelector(".canvas-dom-layer");
  if (layer) layer.innerHTML = "";
}

function renderCanvasDomTooltip(element, item) {
  element.innerHTML = `
    <strong>${escapeHtml(item.title)}</strong>
    ${item.rows
      .map(
        (row) => `
          <span class="chart-tooltip-row">
            <i style="--tooltip-color: ${escapeHtml(row.color)}"></i>
            <em>${escapeHtml(row.label)}</em>
            <b>${escapeHtml(row.value)}</b>
          </span>
        `
      )
      .join("")}
  `;
}

function canDrawCanvas(canvas, minSize = 24) {
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  return rect.width >= minSize && rect.height >= minSize;
}

function chartPadding(canvas) {
  const size = chartSize(canvas);
  const compact = size.height < 210;
  return {
    top: 24,
    right: 18,
    bottom: compact ? 34 : 38,
    left: size.width < 420 ? 68 : 84,
  };
}

function drawGrid(ctx, canvas, min, max, formatter = formatAxisMoney) {
  const palette = chartPalette();
  const pad = chartPadding(canvas);
  const size = chartSize(canvas);
  const lines = 4;
  const top = pad.top;
  const bottom = size.height - pad.bottom;
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= lines; i += 1) {
    const y = alignCanvasLine(top + (i / lines) * (bottom - top), canvas);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(size.width - pad.right, y);
    ctx.stroke();
  }

  if (!formatter) return;

  ctx.fillStyle = palette.muted;
  ctx.font = "11.5px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(sensitiveText(formatter(max)), pad.left - 8, top);
  ctx.fillText(sensitiveText(formatter(min)), pad.left - 8, bottom);
  ctx.textBaseline = "alphabetic";
}

function drawChartLabel(ctx, canvas, label, x, y, align = "left") {
  const palette = chartPalette();
  const size = chartSize(canvas);
  const displayLabel = sensitiveText(label);
  ctx.font = "12px system-ui, sans-serif";
  const width = ctx.measureText(displayLabel).width + 14;
  const height = 26;
  const left = align === "right" ? x - width : x;
  const top = Math.max(8, Math.min(size.height - height - 8, y - height - 8));
  ctx.fillStyle = palette.labelBg;
  ctx.strokeStyle = palette.labelBorder;
  roundRect(ctx, left, top, width, height, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.labelText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(displayLabel, left + width / 2, top + height / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function openFirmDialog(firm = null) {
  els.firmForm.reset();
  els.firmId.value = firm?.id || "";
  els.firmName.value = firm?.name || "";
  els.firmType.value = firm?.type || "Futuros";
  els.firmNotes.value = firm?.notes || "";
  els.firmDialogTitle.textContent = firm ? "Editar firm" : "Nueva firm";
  syncAllCustomSelects();
  showDialog(els.firmDialog);
}

function openAccountDialog(account = null) {
  if (!state.firms.length) {
    openFirmDialog();
    toast("Crea una firm antes de añadir cuentas.");
    return;
  }

  fillFirmSelects();
  els.accountForm.reset();
  els.accountId.value = account?.id || "";
  els.accountFirm.value = account?.firmId || state.firms[0].id;
  els.accountName.value = account?.name || "";
  els.accountSize.value = account?.size || "";
  els.accountStatus.value = account?.status || "active";
  els.accountPurchasedAt.value = account?.purchasedAt || today();
  els.accountNotes.value = account?.notes || "";
  els.accountDialogTitle.textContent = account ? "Editar cuenta" : "Nueva cuenta";
  syncAllCustomSelects();
  showDialog(els.accountDialog);
}

function openTransactionDialog(transaction = null) {
  if (!state.firms.length) {
    openFirmDialog();
    toast("Crea una firm antes de añadir movimientos.");
    return;
  }

  fillFirmSelects();
  els.transactionForm.reset();
  const firmId = transaction?.firmId || resolveFirmId(transaction || {}) || state.firms[0].id;
  els.transactionId.value = transaction?.id || "";
  els.transactionDate.value = transaction?.date || today();
  els.transactionKind.value = transaction?.kind || "expense";
  fillTransactionCategories(els.transactionKind.value, transaction?.category);
  els.transactionAmount.value = transaction?.amount ?? "";
  els.transactionFirm.value = firmId;
  fillAccountSelect(els.transactionAccount, firmId, true, transaction?.accountId || "");
  els.transactionNote.value = transaction?.note || "";
  els.transactionDialogTitle.textContent = transaction ? "Editar movimiento" : "Nuevo movimiento";
  syncAllCustomSelects();
  showDialog(els.transactionDialog);
}

function openJournalDialog(entry = null) {
  if (!state.firms.length) {
    openFirmDialog();
    toast("Crea una firm antes de añadir entradas al journal.");
    return;
  }

  fillFirmSelects();
  els.journalForm.reset();
  const account = getAccount(entry?.accountId);
  const firmId = entry?.firmId || account?.firmId || state.firms[0].id;
  els.journalId.value = entry?.id || "";
  els.journalDate.value = entry?.date || today();
  els.journalFirm.value = firmId;
  fillAccountSelect(els.journalAccount, firmId, true, entry?.accountId || "");
  els.journalTitle.value = entry?.title || "";
  els.journalDirection.value = normalizeJournalDirection(entry?.direction);
  els.journalEmotion.value = entry?.emotion || "focused";
  els.journalDiscipline.value = String(entry?.discipline || 3);
  els.journalPnl.value = entry ? Number(entry.pnl || 0) : "";
  setJournalOperationMedia(entry?.operationUrl || "");
  renderJournalErrorChoices(entry?.errors || []);
  setJournalErrorFields(entry?.errors || []);
  els.journalNotes.value = entry?.notes || entry?.lesson || "";
  els.journalDialogTitle.textContent = entry ? "Editar entrada" : "Nueva entrada";
  syncAllCustomSelects();
  showDialog(els.journalDialog);
}

function openJournalDetailDialog(entry) {
  if (!entry) return;

  const pnl = Number(entry.pnl || 0);
  const tone = pnlToneClass(pnl);
  const errors = sanitizeJournalErrors(entry.errors);

  els.journalDetailDialog.dataset.entryId = entry.id;
  els.journalDetailTitle.textContent = getJournalAssetLabel(entry);
  els.journalDetailDate.textContent = formatJournalGalleryDate(entry.date);
  els.journalDetailPnl.textContent = formatSignedMoney(pnl);
  els.journalDetailPnl.className = `journal-pnl ${tone} journal-detail-pnl`;
  els.journalDetailErrors.innerHTML = errors.length
    ? errors.map((error) => `<span>${escapeHtml(getJournalErrorLabel(error))}</span>`).join("")
    : `<span class="journal-detail-empty">Sin errores</span>`;
  renderJournalDetailMedia(entry);
  els.journalDetailNotes.textContent = entry.notes || entry.lesson || "Sin notas.";
  showDialog(els.journalDetailDialog);
}

function renderJournalDetailMedia(entry) {
  const media = String(entry?.operationUrl || "");
  const isImage = isImageDataUrl(media);

  els.journalDetailMediaShell.hidden = !media;
  els.journalDetailMediaButton.hidden = !isImage;
  els.journalDetailLink.hidden = !media || isImage;
  els.journalDetailMediaButton.dataset.src = isImage ? media : "";

  if (isImage) {
    els.journalDetailImage.src = media;
    els.journalDetailImage.alt = `Captura de ${getJournalAssetLabel(entry)}`;
    els.journalDetailLink.removeAttribute("href");
  } else {
    els.journalDetailImage.removeAttribute("src");
    els.journalDetailImage.alt = "Captura de la operacion";
    if (media) els.journalDetailLink.href = media;
    else els.journalDetailLink.removeAttribute("href");
  }
}

function openJournalImageZoom() {
  const src = els.journalDetailMediaButton.dataset.src || els.journalDetailImage.getAttribute("src");
  if (!src) return;
  els.journalImageZoom.src = src;
  els.journalImageZoom.alt = `Captura ampliada de ${els.journalDetailTitle.textContent || "el activo"}`;
  showDialog(els.journalImageZoomDialog);
}

function closeJournalImageZoomFromBackdrop(event) {
  if (event.target === els.journalImageZoomDialog) closeDialog("journalImageZoomDialog");
}

function editSelectedJournalDetail() {
  const entry = getJournalEntry(els.journalDetailDialog.dataset.entryId);
  closeDialog("journalDetailDialog");
  if (entry) openJournalDialog(entry);
}

function deleteSelectedJournalDetail() {
  const entry = getJournalEntry(els.journalDetailDialog.dataset.entryId);
  closeDialog("journalDetailDialog");
  if (entry) requestDeleteJournalEntry(entry.id);
}

function openJournalErrorDialog(type = null) {
  els.journalErrorForm.reset();
  els.journalErrorTypeId.value = type?.id || "";
  els.journalErrorLabel.value = type?.label || "";
  els.journalErrorColor.value = type ? normalizeHexColor(type.color) || getNextJournalErrorColor(type.id) : getNextJournalErrorColor();
  els.journalErrorColor.disabled = !type;
  els.journalErrorDialogTitle.textContent = type ? "Editar error" : "Nuevo error";
  showDialog(els.journalErrorDialog);
}

function openJournalErrorManagerDialog() {
  renderJournalErrorSettings();
  showDialog(els.journalErrorManagerDialog);
}

function clearFormValidity(form) {
  form?.querySelectorAll("input, select, textarea").forEach((field) => {
    field.setCustomValidity?.("");
  });
}

function markInvalid(field, message) {
  if (field) {
    field.setCustomValidity?.(message);
    field.reportValidity?.();
    field.addEventListener?.("input", () => field.setCustomValidity?.(""), { once: true });
    field.addEventListener?.("change", () => field.setCustomValidity?.(""), { once: true });
    const customSelectButton = field.matches?.("select") ? field.closest(".select-shell")?.querySelector(".select-display") : null;
    (customSelectButton || field).focus?.();
  }
  toast(message);
  return false;
}

function isFormBusy(form) {
  return form?.dataset.busy === "true";
}

function setFormBusy(form, isBusy) {
  if (!form) return;
  form.dataset.busy = isBusy ? "true" : "false";
  form.querySelectorAll('button[type="submit"]').forEach((button) => {
    button.disabled = isBusy;
  });
}

function parsePositiveAmount(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return Number.NaN;
  return Number(text);
}

function parseSignedAmount(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return 0;
  return Number(text);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = parseLocalDate(value);
  return dateToIsoDate(date) === value;
}

function validateFirm(firm, id) {
  if (!firm.name) return markInvalid(els.firmName, "Pon un nombre para la firm.");
  if (firm.name.length < 2) return markInvalid(els.firmName, "El nombre de la firm es demasiado corto.");
  if (!["Futuros", "CFDs", "Mixta"].includes(firm.type)) {
    return markInvalid(els.firmType, "Selecciona un tipo de firm valido.");
  }
  const duplicated = state.firms.some((item) => item.id !== id && normalize(item.name) === normalize(firm.name));
  if (duplicated) return markInvalid(els.firmName, "Ya existe una firm con ese nombre.");
  return true;
}

function validateAccount(account, id) {
  if (!getFirm(account.firmId)) return markInvalid(els.accountFirm, "Selecciona una firm valida.");
  if (!account.name) return markInvalid(els.accountName, "Pon un nombre para la cuenta.");
  if (account.name.length < 2) return markInvalid(els.accountName, "El nombre de la cuenta es demasiado corto.");
  if (!statusLabels[account.status]) return markInvalid(els.accountStatus, "Selecciona un estado valido.");
  if (account.purchasedAt && !isValidIsoDate(account.purchasedAt)) {
    return markInvalid(els.accountPurchasedAt, "La fecha de compra no es valida.");
  }
  if (account.purchasedAt && account.purchasedAt > today()) {
    return markInvalid(els.accountPurchasedAt, "La fecha de compra no puede ser futura.");
  }
  const duplicated = state.accounts.some(
    (item) =>
      item.id !== id &&
      item.firmId === account.firmId &&
      normalize(item.name) === normalize(account.name)
  );
  if (duplicated) return markInvalid(els.accountName, "Ya hay una cuenta con ese nombre en esta firm.");
  return true;
}

function validateTransaction(transaction, selectedAccountId, account) {
  if (!isValidIsoDate(transaction.date)) return markInvalid(els.transactionDate, "La fecha del movimiento no es valida.");
  if (transaction.date > today()) return markInvalid(els.transactionDate, "La fecha del movimiento no puede ser futura.");
  if (!["expense", "income"].includes(transaction.kind)) {
    return markInvalid(els.transactionKind, "Selecciona un tipo de movimiento valido.");
  }
  const validCategories = transaction.kind === "income" ? incomeCategories : expenseCategories;
  if (!validCategories.includes(transaction.category)) {
    return markInvalid(els.transactionCategory, "La categoria no corresponde con el tipo de movimiento.");
  }
  if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    return markInvalid(els.transactionAmount, "El importe debe ser mayor que 0.");
  }
  if (!getFirm(transaction.firmId)) return markInvalid(els.transactionFirm, "Selecciona una firm valida.");
  if (selectedAccountId && !account) return markInvalid(els.transactionAccount, "Selecciona una cuenta valida.");
  if (account && account.firmId !== transaction.firmId) {
    return markInvalid(els.transactionAccount, "La cuenta seleccionada no pertenece a esa firm.");
  }
  return true;
}

function validateJournalEntry(entry, selectedAccountId, account) {
  if (!isValidIsoDate(entry.date)) return markInvalid(els.journalDate, "La fecha de la entrada no es valida.");
  if (entry.date > today()) return markInvalid(els.journalDate, "La fecha de la entrada no puede ser futura.");
  if (!getFirm(entry.firmId)) return markInvalid(els.journalFirm, "Selecciona una firm valida.");
  if (selectedAccountId && !account) return markInvalid(els.journalAccount, "Selecciona una cuenta valida.");
  if (account && account.firmId !== entry.firmId) {
    return markInvalid(els.journalAccount, "La cuenta seleccionada no pertenece a esa firm.");
  }
  if (!entry.title) return markInvalid(els.journalTitle, "Pon un activo para la entrada.");
  if (!journalDirectionLabels[entry.direction]) return markInvalid(els.journalDirection, "Selecciona si la operacion fue long o short.");
  if (!journalEmotionLabels[entry.emotion]) return markInvalid(els.journalEmotion, "Selecciona un estado mental valido.");
  if (!Number.isInteger(entry.discipline) || entry.discipline < 1 || entry.discipline > 5) {
    return markInvalid(els.journalDiscipline, "La disciplina debe estar entre 1 y 5.");
  }
  if (!Number.isFinite(entry.pnl)) return markInvalid(els.journalPnl, "El P&L debe ser un numero valido.");
  if (entry.operationUrl && !isValidJournalOperationMedia(entry.operationUrl)) {
    return markInvalid(els.journalOperationDropzone, "Pega una imagen valida para la operacion.");
  }
  if (entry.errors.some((error) => !getJournalErrorType(error))) {
    toast("Hay un error de journal no valido.");
    return false;
  }
  return true;
}

function isValidJournalOperationMedia(value) {
  return isImageDataUrl(value) || isValidUrl(value);
}

async function saveFirmFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");
  if (isFormBusy(els.firmForm)) return;
  clearFormValidity(els.firmForm);

  const id = els.firmId.value || createId();
  const existing = state.firms.find((firm) => firm.id === id);
  const firm = {
    id,
    name: els.firmName.value.trim(),
    type: els.firmType.value,
    notes: els.firmNotes.value.trim(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (!validateFirm(firm, id)) return;

  setFormBusy(els.firmForm, true);
  try {
    const result = await supabaseClient.from("firms").upsert(firmToDb(firm)).select().single();
    throwIfSupabaseError(result);
    const savedFirm = fromDbFirm(result.data);

    if (existing) {
      state.firms = state.firms.map((item) => (item.id === id ? savedFirm : item));
    } else {
      state.firms.push(savedFirm);
    }

    persist();
    closeDialog("firmDialog");
    refreshAll();
    toast("Firm guardada.");
  } catch (error) {
    toast(error.message || "No se pudo guardar la firm.");
  } finally {
    setFormBusy(els.firmForm, false);
  }
}

async function saveAccountFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");
  if (isFormBusy(els.accountForm)) return;
  clearFormValidity(els.accountForm);

  const id = els.accountId.value || createId();
  const existing = state.accounts.find((account) => account.id === id);
  const account = {
    id,
    firmId: els.accountFirm.value,
    name: els.accountName.value.trim(),
    size: els.accountSize.value.trim(),
    status: els.accountStatus.value,
    purchasedAt: els.accountPurchasedAt.value,
    notes: els.accountNotes.value.trim(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (!validateAccount(account, id)) return;

  setFormBusy(els.accountForm, true);
  try {
    const result = await supabaseClient.from("accounts").upsert(accountToDb(account)).select().single();
    throwIfSupabaseError(result);
    const savedAccount = fromDbAccount(result.data);

    if (existing) {
      state.accounts = state.accounts.map((item) => (item.id === id ? savedAccount : item));
      state.transactions = state.transactions.map((tx) =>
        tx.accountId === id ? { ...tx, firmId: savedAccount.firmId, updatedAt: nowIso() } : tx
      );
      const txUpdate = await supabaseClient
        .from("transactions")
        .update({ firm_id: savedAccount.firmId })
        .eq("account_id", id);
      throwIfSupabaseError(txUpdate);
      if (state.journalEntries.some((entry) => entry.accountId === id)) {
        state.journalEntries = state.journalEntries.map((entry) =>
          entry.accountId === id ? { ...entry, firmId: savedAccount.firmId, updatedAt: nowIso() } : entry
        );
        const journalUpdate = await supabaseClient
          .from("journal_entries")
          .update({ firm_id: savedAccount.firmId })
          .eq("account_id", id);
        if (journalUpdate.error && isMissingJournalTableError(journalUpdate.error)) {
          throw new Error("Crea la tabla journal_entries en Supabase para sincronizar el journal.");
        }
        throwIfSupabaseError(journalUpdate);
      }
    } else {
      state.accounts.push(savedAccount);
    }

    persist();
    closeDialog("accountDialog");
    refreshAll();
    toast("Cuenta guardada.");
  } catch (error) {
    toast(error.message || "No se pudo guardar la cuenta.");
  } finally {
    setFormBusy(els.accountForm, false);
  }
}

async function saveTransactionFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");
  if (isFormBusy(els.transactionForm)) return;
  clearFormValidity(els.transactionForm);

  const id = els.transactionId.value || createId();
  const existing = state.transactions.find((tx) => tx.id === id);
  const amount = parsePositiveAmount(els.transactionAmount.value);
  const selectedAccountId = els.transactionAccount.value;
  const account = selectedAccountId ? getAccount(selectedAccountId) : null;
  const transaction = {
    id,
    date: els.transactionDate.value,
    kind: els.transactionKind.value,
    category: els.transactionCategory.value,
    amount,
    currency: EURO,
    firmId: els.transactionFirm.value,
    accountId: account?.id || "",
    note: els.transactionNote.value.trim(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (!validateTransaction(transaction, selectedAccountId, account)) return;

  setFormBusy(els.transactionForm, true);
  try {
    const result = await supabaseClient.from("transactions").upsert(transactionToDb(transaction)).select().single();
    throwIfSupabaseError(result);
    const savedTransaction = fromDbTransaction(result.data);

    if (existing) {
      state.transactions = state.transactions.map((item) => (item.id === id ? savedTransaction : item));
    } else {
      state.transactions.push(savedTransaction);
    }

    persist();
    closeDialog("transactionDialog");
    refreshAll();
    toast("Movimiento guardado.");
  } catch (error) {
    toast(error.message || "No se pudo guardar el movimiento.");
  } finally {
    setFormBusy(els.transactionForm, false);
  }
}

async function saveJournalFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");
  if (isFormBusy(els.journalForm)) return;
  clearFormValidity(els.journalForm);

  const id = els.journalId.value || createId();
  const existing = state.journalEntries.find((entry) => entry.id === id);
  const selectedAccountId = els.journalAccount.value;
  const account = selectedAccountId ? getAccount(selectedAccountId) : null;
  const pnl = parseSignedAmount(els.journalPnl.value);
  const errors = getSelectedJournalErrors();
  const operationUrl = els.journalOperationUrl.value.trim();
  const entry = {
    id,
    date: els.journalDate.value,
    firmId: els.journalFirm.value,
    accountId: account?.id || "",
    title: normalizeJournalAsset(els.journalTitle.value),
    direction: normalizeJournalDirection(els.journalDirection.value),
    sessionType: existing?.sessionType || "trading-day",
    result: existing?.result || "neutral",
    emotion: els.journalEmotion.value,
    discipline: Number(els.journalDiscipline.value),
    pnl,
    errors,
    operationUrl,
    notes: els.journalNotes.value.trim(),
    lesson: "",
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (!validateJournalEntry(entry, selectedAccountId, account)) return;

  setFormBusy(els.journalForm, true);
  try {
    const result = await supabaseClient.from("journal_entries").upsert(journalEntryToDb(entry)).select().single();
    if (result.error && isJournalSetupError(result.error)) {
      throw new Error("Ejecuta supabase-journal.sql en Supabase para actualizar el journal.");
    }
    throwIfSupabaseError(result);
    const savedEntry = fromDbJournalEntry(result.data);

    if (existing) {
      state.journalEntries = state.journalEntries.map((item) => (item.id === id ? savedEntry : item));
    } else {
      state.journalEntries.push(savedEntry);
    }

    persist();
    closeDialog("journalDialog");
    refreshAll();
    toast("Entrada guardada.");
  } catch (error) {
    toast(error.message || "No se pudo guardar la entrada.");
  } finally {
    setFormBusy(els.journalForm, false);
  }
}

async function saveJournalErrorTypeFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");
  if (isFormBusy(els.journalErrorForm)) return;
  clearFormValidity(els.journalErrorForm);

  const id = els.journalErrorTypeId.value || createId();
  const existing = getJournalErrorType(id);
  const label = els.journalErrorLabel.value.trim();
  const color = existing
    ? normalizeHexColor(els.journalErrorColor.value) || getNextJournalErrorColor(existing.id)
    : getNextJournalErrorColor();
  const duplicated = getJournalErrorTypes({ activeOnly: false }).some(
    (type) => type.id !== id && normalize(type.label) === normalize(label)
  );

  if (label.length < 2) return markInvalid(els.journalErrorLabel, "Pon un nombre para el error.");
  if (duplicated) return markInvalid(els.journalErrorLabel, "Ya existe un error con ese nombre.");

  const type = {
    id,
    label,
    color,
    position: existing?.position ?? getJournalErrorTypes({ activeOnly: false }).length,
    active: true,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  setFormBusy(els.journalErrorForm, true);
  try {
    const result = await supabaseClient
      .from("journal_error_types")
      .upsert(journalErrorTypeToDb(type), { onConflict: "user_id,id" })
      .select()
      .single();
    if (result.error && isMissingJournalErrorTypesTableError(result.error)) {
      throw new Error("Ejecuta supabase-journal.sql en Supabase para personalizar errores.");
    }
    throwIfSupabaseError(result);
    const savedType = fromDbJournalErrorType(result.data);

    if (existing) {
      state.journalErrorTypes = getJournalErrorTypes({ activeOnly: false }).map((item) =>
        item.id === id ? savedType : item
      );
    } else {
      state.journalErrorTypes = [...getJournalErrorTypes({ activeOnly: false }), savedType];
    }

    state.journalErrorTypes = normalizeJournalErrorTypes(state.journalErrorTypes);
    persist();
    closeDialog("journalErrorDialog");
    refreshAll();
    toast("Error guardado.");
  } catch (error) {
    toast(error.message || "No se pudo guardar el error.");
  } finally {
    setFormBusy(els.journalErrorForm, false);
  }
}

function handleTableAction(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget || !event.currentTarget.contains(actionTarget)) return;
  event.preventDefault();
  const { action, id } = actionTarget.dataset;

  if (action === "select-journal-day") selectJournalDate(actionTarget.dataset.date);
  if (action === "edit-firm") openFirmDialog(getFirm(id));
  if (action === "edit-account") openAccountDialog(getAccount(id));
  if (action === "edit-transaction") openTransactionDialog(getTransaction(id));
  if (action === "edit-journal") openJournalDialog(getJournalEntry(id));
  if (action === "edit-journal-error") openJournalErrorDialog(getJournalErrorType(id));
  if (action === "archive-journal-error") requestToggleJournalErrorType(id, false);
  if (action === "restore-journal-error") requestToggleJournalErrorType(id, true);
  if (action === "delete-firm") requestDeleteFirm(id);
  if (action === "delete-account") requestDeleteAccount(id);
  if (action === "delete-transaction") requestDeleteTransaction(id);
  if (action === "delete-journal") requestDeleteJournalEntry(id);
}

function handleJournalCardClick(event) {
  if (event.target.closest("[data-action], button, input, select, textarea")) return;
  const card = event.target.closest(".journal-card");
  if (!card || !els.journalEntriesList.contains(card)) return;
  event.preventDefault();
  openJournalDetailDialog(getJournalEntry(card.dataset.id));
}

function handleJournalCardKeyDown(event) {
  if (!["Enter", " "].includes(event.key)) return;
  if (event.target.closest("[data-action], button, input, select, textarea")) return;
  const card = event.target.closest(".journal-card");
  if (!card) return;
  event.preventDefault();
  openJournalDetailDialog(getJournalEntry(card.dataset.id));
}

function clearJournalCardFocus() {
  requestAnimationFrame(() => {
    const activeElement = document.activeElement;
    if (activeElement?.closest?.(".journal-card")) {
      activeElement.blur();
    }
  });
}

function requestToggleJournalErrorType(id, active) {
  const type = getJournalErrorType(id);
  if (!type) return;
  const actionLabel = active ? "activar" : "ocultar";
  openConfirm(active ? "Activar error" : "Ocultar error", `Quieres ${actionLabel} "${type.label}"?`, async () => {
    const nextType = { ...type, active, updatedAt: nowIso() };
    try {
      const result = await supabaseClient
        .from("journal_error_types")
        .upsert(journalErrorTypeToDb(nextType), { onConflict: "user_id,id" })
        .select()
        .single();
      if (result.error && isMissingJournalErrorTypesTableError(result.error)) {
        throw new Error("Ejecuta supabase-journal.sql en Supabase para personalizar errores.");
      }
      throwIfSupabaseError(result);
      const savedType = fromDbJournalErrorType(result.data);
      state.journalErrorTypes = getJournalErrorTypes({ activeOnly: false }).map((item) =>
        item.id === id ? savedType : item
      );
      persist();
      refreshAll();
      toast(active ? "Error activado." : "Error ocultado.");
    } catch (error) {
      toast(error.message || "No se pudo actualizar el error.");
    }
  });
}

function requestDeleteFirm(id) {
  const firm = getFirm(id);
  const hasAccounts = state.accounts.some((account) => account.firmId === id);
  const hasTransactions = state.transactions.some((tx) => resolveFirmId(tx) === id);
  const hasJournalEntries = state.journalEntries.some((entry) => entry.firmId === id);

  if (hasAccounts || hasTransactions || hasJournalEntries) {
    toast("No puedes eliminar una firm con cuentas, movimientos o entradas de journal.");
    return;
  }

  openConfirm("Eliminar firm", `Eliminar ${firm?.name || "esta firm"}?`, async () => {
    try {
      const result = await supabaseClient.from("firms").delete().eq("id", id);
      throwIfSupabaseError(result);
      state.firms = state.firms.filter((item) => item.id !== id);
      persist();
      refreshAll();
      toast("Firm eliminada.");
    } catch (error) {
      toast(error.message || "No se pudo eliminar la firm.");
    }
  });
}

function requestDeleteAccount(id) {
  const account = getAccount(id);
  const hasTransactions = state.transactions.some((tx) => tx.accountId === id);
  const hasJournalEntries = state.journalEntries.some((entry) => entry.accountId === id);

  if (hasTransactions || hasJournalEntries) {
    toast("No puedes eliminar una cuenta con movimientos o entradas de journal.");
    return;
  }

  openConfirm("Eliminar cuenta", `Eliminar ${account?.name || "esta cuenta"}?`, async () => {
    try {
      const result = await supabaseClient.from("accounts").delete().eq("id", id);
      throwIfSupabaseError(result);
      state.accounts = state.accounts.filter((item) => item.id !== id);
      persist();
      refreshAll();
      toast("Cuenta eliminada.");
    } catch (error) {
      toast(error.message || "No se pudo eliminar la cuenta.");
    }
  });
}

function requestDeleteTransaction(id) {
  openConfirm("Eliminar movimiento", "Eliminar este movimiento?", async () => {
    try {
      const result = await supabaseClient.from("transactions").delete().eq("id", id);
      throwIfSupabaseError(result);
      state.transactions = state.transactions.filter((item) => item.id !== id);
      persist();
      refreshAll();
      toast("Movimiento eliminado.");
    } catch (error) {
      toast(error.message || "No se pudo eliminar el movimiento.");
    }
  });
}

function requestDeleteJournalEntry(id) {
  openConfirm("Eliminar entrada", "Eliminar esta entrada de journal?", async () => {
    try {
      const result = await supabaseClient.from("journal_entries").delete().eq("id", id);
      if (result.error && isMissingJournalTableError(result.error)) {
        throw new Error("Crea la tabla journal_entries en Supabase para sincronizar el journal.");
      }
      throwIfSupabaseError(result);
      state.journalEntries = state.journalEntries.filter((item) => item.id !== id);
      persist();
      refreshAll();
      toast("Entrada eliminada.");
    } catch (error) {
      toast(error.message || "No se pudo eliminar la entrada.");
    }
  });
}

function openConfirm(title, message, handler) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  confirmHandler = handler;
  showDialog(els.confirmDialog);
}

function showDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  refreshIcons();
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function exportJson() {
  const payload = {
    exportedAt: nowIso(),
    app: "trazza",
    version: 1,
    data: state,
  };
  downloadFile(`trazza-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
  toast("JSON exportado.");
}

function exportCsv() {
  const rows = [
    ["fecha", "tipo", "categoria", "firm", "cuenta", "nota", "importe", "moneda"],
    ...state.transactions
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((tx) => {
        const firm = getFirm(resolveFirmId(tx));
        const account = getAccount(tx.accountId);
        const signed = tx.kind === "income" ? tx.amount : -tx.amount;
        return [
          tx.date,
          tx.kind === "income" ? "retiro" : "gasto",
          categoryLabels[tx.category] || tx.category,
          firm?.name || "",
          account?.name || "",
          tx.note || "",
          signed.toFixed(2),
          tx.currency || EURO,
        ];
      }),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`trazza-movimientos-${today()}.csv`, csv, "text/csv;charset=utf-8");
  toast("CSV exportado.");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parsed.data || parsed;
      if (!Array.isArray(imported.firms) || !Array.isArray(imported.accounts) || !Array.isArray(imported.transactions)) {
        throw new Error("Invalid file");
      }

      if (currentUser) {
        await replaceCloudState(imported);
      } else {
        state = {
          firms: imported.firms,
          accounts: imported.accounts,
          transactions: imported.transactions,
          journalEntries: Array.isArray(imported.journalEntries) ? imported.journalEntries : [],
          journalErrorTypes: normalizeJournalErrorTypes(imported.journalErrorTypes),
        };
        persist();
        refreshAll();
      }
      toast("Datos importados.");
    } catch (error) {
      toast(error.message || "El archivo no es valido.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

async function migrateLocalData() {
  const localState = getLocalStateForMigration();
  if (!localState) {
    toast("No hay datos locales para subir.");
    updateMigrationButton();
    return;
  }

  try {
    await replaceCloudState(localState);
    localStorage.setItem(LOCAL_MIGRATED_KEY, nowIso());
    updateMigrationButton();
    toast("Datos locales subidos a Supabase.");
  } catch (error) {
    toast(error.message || "No se pudieron subir los datos locales.");
  }
}

async function replaceCloudState(imported) {
  if (!currentUser) throw new Error("Inicia sesion para importar datos.");

  const mapped = remapStateForCloud(imported);
  const deleteJournalErrorTypes = await supabaseClient.from("journal_error_types").delete().eq("user_id", currentUser.id);
  const hasJournalErrorTypesTable = !deleteJournalErrorTypes.error;
  if (deleteJournalErrorTypes.error && !isMissingJournalErrorTypesTableError(deleteJournalErrorTypes.error)) {
    throwIfSupabaseError(deleteJournalErrorTypes);
  }
  const deleteJournalEntries = await supabaseClient.from("journal_entries").delete().eq("user_id", currentUser.id);
  const hasJournalTable = handleJournalTableResult(deleteJournalEntries, mapped.journalEntries.length > 0);
  const deleteTransactions = await supabaseClient.from("transactions").delete().eq("user_id", currentUser.id);
  throwIfSupabaseError(deleteTransactions);
  const deleteAccounts = await supabaseClient.from("accounts").delete().eq("user_id", currentUser.id);
  throwIfSupabaseError(deleteAccounts);
  const deleteFirms = await supabaseClient.from("firms").delete().eq("user_id", currentUser.id);
  throwIfSupabaseError(deleteFirms);

  if (mapped.firms.length) {
    const result = await supabaseClient.from("firms").insert(mapped.firms.map(firmToDb));
    throwIfSupabaseError(result);
  }
  if (mapped.accounts.length) {
    const result = await supabaseClient.from("accounts").insert(mapped.accounts.map(accountToDb));
    throwIfSupabaseError(result);
  }
  if (mapped.transactions.length) {
    const result = await supabaseClient.from("transactions").insert(mapped.transactions.map(transactionToDb));
    throwIfSupabaseError(result);
  }
  if (mapped.journalErrorTypes.length && hasJournalErrorTypesTable) {
    const result = await supabaseClient.from("journal_error_types").insert(mapped.journalErrorTypes.map(journalErrorTypeToDb));
    throwIfSupabaseError(result);
  }
  if (mapped.journalEntries.length && hasJournalTable) {
    const result = await supabaseClient.from("journal_entries").insert(mapped.journalEntries.map(journalEntryToDb));
    handleJournalTableResult(result, true);
  }

  await loadCloudState();
}

function remapStateForCloud(imported) {
  const firmIds = new Map();
  const accountIds = new Map();

  const firms = imported.firms
    .filter((firm) => firm?.name)
    .map((firm) => {
      const id = createId();
      firmIds.set(firm.id, id);
      return {
        id,
        name: String(firm.name).trim(),
        type: firm.type || "Futuros",
        notes: firm.notes || "",
        createdAt: firm.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    });

  const accounts = imported.accounts
    .filter((account) => account?.name && firmIds.has(account.firmId))
    .map((account) => {
      const id = createId();
      accountIds.set(account.id, id);
      return {
        id,
        firmId: firmIds.get(account.firmId),
        name: String(account.name).trim(),
        size: account.size || "",
        status: account.status || "active",
        purchasedAt: account.purchasedAt || "",
        notes: account.notes || "",
        createdAt: account.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    });

  const transactions = imported.transactions
    .filter((transaction) => transaction?.date && transaction?.kind && transaction?.category && Number(transaction.amount) > 0)
    .map((transaction) => {
      const accountId = accountIds.get(transaction.accountId) || "";
      const account = accounts.find((item) => item.id === accountId);
      const firmId = account?.firmId || firmIds.get(transaction.firmId) || "";
      return {
        id: createId(),
        date: transaction.date,
        kind: transaction.kind,
        category: transaction.category,
        amount: Math.abs(Number(transaction.amount)),
        currency: EURO,
        firmId,
        accountId,
        note: transaction.note || "",
        createdAt: transaction.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    })
    .filter((transaction) => transaction.firmId);

  const journalErrorTypes = normalizeJournalErrorTypes(imported.journalErrorTypes);
  const knownErrorIds = new Set(journalErrorTypes.map((type) => type.id));
  const journalEntries = (Array.isArray(imported.journalEntries) ? imported.journalEntries : [])
    .filter((entry) => entry?.date && entry?.title)
    .map((entry) => {
      const accountId = accountIds.get(entry.accountId) || "";
      const account = accounts.find((item) => item.id === accountId);
      const firmId = account?.firmId || firmIds.get(entry.firmId) || "";
      return {
        id: createId(),
        date: entry.date,
        firmId,
        accountId,
        title: String(entry.title).trim(),
        direction: normalizeJournalDirection(entry.direction || entry.tradeDirection || entry.trade_direction),
        sessionType: journalSessionLabels[entry.sessionType] ? entry.sessionType : "trading-day",
        result: journalResultLabels[entry.result] ? entry.result : "neutral",
        emotion: journalEmotionLabels[entry.emotion] ? entry.emotion : "focused",
        discipline: clamp(Math.round(Number(entry.discipline || 3)), 1, 5),
        pnl: Number(entry.pnl || 0),
        errors: sanitizeJournalErrors(entry.errors).filter((error) => knownErrorIds.has(error)),
        operationUrl: entry.operationUrl || "",
        notes: entry.notes || "",
        lesson: entry.lesson || "",
        createdAt: entry.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    })
    .filter((entry) => entry.firmId);

  return { firms, accounts, transactions, journalEntries, journalErrorTypes };
}

function maybeCreateLocalMigrationBackup() {
  if (localStorage.getItem(LOCAL_MIGRATION_BACKUP_KEY)) return;
  const raw = findLocalStateRaw([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  if (raw) {
    localStorage.setItem(LOCAL_MIGRATION_BACKUP_KEY, raw);
  }
}

function getLocalStateForMigration() {
  if (localStorage.getItem(LOCAL_MIGRATED_KEY)) return null;
  const raw = findLocalStateRaw([LOCAL_MIGRATION_BACKUP_KEY, STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  return raw ? JSON.parse(raw) : null;
}

function findLocalStateRaw(keys) {
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (hasStateData(parsed)) return raw;
    } catch {
      continue;
    }
  }
  return "";
}

function hasStateData(value) {
  const journalEntries = Array.isArray(value?.journalEntries) ? value.journalEntries : [];
  return Boolean(
    Array.isArray(value?.firms) &&
      Array.isArray(value?.accounts) &&
      Array.isArray(value?.transactions) &&
      (value.firms.length || value.accounts.length || value.transactions.length || journalEntries.length)
  );
}

function updateMigrationButton() {
  if (!els.migrateLocalButton) return;
  els.migrateLocalButton.hidden = !currentUser || !getLocalStateForMigration();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getFirm(id) {
  return state.firms.find((firm) => firm.id === id);
}

function getAccount(id) {
  return state.accounts.find((account) => account.id === id);
}

function getTransaction(id) {
  return state.transactions.find((transaction) => transaction.id === id);
}

function getJournalEntry(id) {
  return state.journalEntries.find((entry) => entry.id === id);
}

function resolveFirmId(transaction) {
  if (!transaction) return "";
  if (transaction.firmId) return transaction.firmId;
  const account = getAccount(transaction.accountId);
  return account?.firmId || "";
}

function actionButton(action, id, label, icon) {
  return `
    <button class="icon-button" type="button" data-action="${action}" data-id="${escapeHtml(id)}" aria-label="${label}">
      <i data-lucide="${icon}"></i>
    </button>
  `;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: EURO,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatSignedMoney(value) {
  const amount = Number(value || 0);
  if (amount > 0) return `+${formatMoney(amount)}`;
  if (amount < 0) return formatMoney(amount);
  return formatMoney(0);
}

function formatTradingMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatSignedTradingMoney(value) {
  const amount = Number(value || 0);
  if (amount > 0) return `+${formatTradingMoney(amount)}`;
  if (amount < 0) return `-${formatTradingMoney(Math.abs(amount))}`;
  return formatTradingMoney(0);
}

function formatAxisMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: EURO,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value || 0))}%`;
}

function formatRatio(value) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatSignedPercent(value) {
  const amount = Number(value || 0);
  const formatted = formatPercent(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

function sensitiveText(value, mask = DASHBOARD_PRIVACY_MASK) {
  return dashboardPrivacyHidden ? mask : String(value);
}

function sensitiveCount(value) {
  return dashboardPrivacyHidden ? "••" : String(value);
}

function sensitiveMoney(value) {
  return sensitiveText(formatMoney(value));
}

function sensitiveSignedMoney(value) {
  return sensitiveText(formatSignedMoney(value));
}

function sensitiveTradingMoney(value) {
  return sensitiveText(formatTradingMoney(value));
}

function sensitiveSignedTradingMoney(value) {
  return sensitiveText(formatSignedTradingMoney(value));
}

function sensitivePercent(value) {
  return sensitiveText(formatPercent(value));
}

function sensitiveSignedPercent(value) {
  return sensitiveText(formatSignedPercent(value));
}

function sensitiveRatio(value) {
  return sensitiveText(formatRatio(value));
}

function parseAccountSizeAmount(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const match = text.match(/(\d[\d.,]*)\s*([km])?/i);
  if (!match) return null;

  const numericText = match[1];
  const suffix = (match[2] || "").toLowerCase();
  const decimal = normalizeFlexibleNumber(numericText);
  if (!Number.isFinite(decimal) || decimal <= 0) return null;

  const multiplier = suffix === "m" ? 1000000 : suffix === "k" ? 1000 : 1;
  return decimal * multiplier;
}

function normalizeFlexibleNumber(value) {
  const text = String(value || "").replace(/[^\d.,-]/g, "");
  if (!text) return NaN;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(text.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma !== -1) {
    const parts = text.split(",");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? parts.join("") : text.replace(",", "."));
  }

  if (lastDot !== -1) {
    const parts = text.split(".");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? parts.join("") : text);
  }

  return Number(text);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(value) {
  const date = parseLocalDate(`${value}-01`);
  if (Number.isNaN(date.getTime())) return value;
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatShortDate(value) {
  if (!value) return "";
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getLastMonths(count, transactions = []) {
  const months = [];
  const lastTransactionDate = transactions
    .map((transaction) => transaction.date)
    .filter(Boolean)
    .sort()
    .at(-1);
  const date = lastTransactionDate ? parseLocalDate(lastTransactionDate) : new Date();
  date.setDate(1);
  for (let index = count - 1; index >= 0; index -= 1) {
    const item = new Date(date);
    item.setMonth(date.getMonth() - index);
    const key = `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(item).replace(".", "");
    months.push({ key, label });
  }
  return months;
}

function toMonthKey(dateString) {
  return String(dateString || "").slice(0, 7);
}

function shiftIsoDate(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return dateToIsoDate(date);
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || "")
    .split("-")
    .map((value) => Number(value));
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function dateToIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))).toString(16)
  );
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeJournalErrorTypes(value, options = {}) {
  const includeDefaults = options.includeDefaults !== false;
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = raw
    .map((type, index) => ({
      id: String(type?.id || createId()),
      label: String(type?.label || "").trim(),
      color: normalizeHexColor(type?.color) || "#3b82f6",
      position: Number.isFinite(Number(type?.position)) ? Number(type.position) : index,
      active: type?.active !== false,
      createdAt: type?.createdAt || nowIso(),
      updatedAt: type?.updatedAt || type?.createdAt || nowIso(),
    }))
    .filter((type) => {
      if (!type.label || seen.has(type.id)) return false;
      seen.add(type.id);
      return true;
    })
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "es"));

  if (!includeDefaults) return normalized;

  const existingIds = new Set(normalized.map((type) => type.id));
  const missingDefaults = cloneDefaultJournalErrorTypes()
    .filter((type) => !existingIds.has(type.id))
    .map((type) => ({
      ...type,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));

  return [...normalized, ...missingDefaults].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "es"));
}

function getJournalErrorTypes(options = {}) {
  const types = normalizeJournalErrorTypes(state.journalErrorTypes);
  return options.activeOnly ? types.filter((type) => type.active) : types;
}

function getJournalErrorType(id) {
  return getJournalErrorTypes({ activeOnly: false }).find((type) => type.id === id) || null;
}

function getNextJournalErrorColor(ignoreId = "") {
  const usedColors = new Set(
    getJournalErrorTypes({ activeOnly: false })
      .filter((type) => type.id !== ignoreId)
      .map((type) => normalizeHexColor(type.color).toLowerCase())
      .filter(Boolean)
  );

  const paletteColor = journalErrorColorPalette.find((color) => !usedColors.has(color.toLowerCase()));
  if (paletteColor) return paletteColor;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const hue = (usedColors.size * 137.508 + attempt * 29) % 360;
    const color = hslToHex(hue, 72, 52);
    if (!usedColors.has(color.toLowerCase())) return color;
  }

  return "#3b82f6";
}

function getJournalErrorLabel(id) {
  return getJournalErrorType(id)?.label || id;
}

function sanitizeJournalErrors(value) {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

function getSelectedJournalErrors() {
  return sanitizeJournalErrors(
    Array.from(document.querySelectorAll('input[name="journalErrors"]:checked')).map((input) => input.value)
  );
}

function setJournalErrorFields(errors) {
  const selected = new Set(sanitizeJournalErrors(errors));
  document.querySelectorAll('input[name="journalErrors"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function normalizeHexColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function hslToHex(hue, saturation, lightness) {
  const s = clamp(Number(saturation) / 100, 0, 1);
  const l = clamp(Number(lightness) / 100, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((Number(hue) / 60) % 2) - 1));
  const m = l - c / 2;
  const channels =
    hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];

  return `#${channels
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function pnlToneClass(value) {
  const amount = Number(value || 0);
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "neutral";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeHeight = Math.max(0, height);
  const safeY = height < 0 ? y + height : y;
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(safeHeight) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, safeY);
  ctx.lineTo(x + width - r, safeY);
  ctx.quadraticCurveTo(x + width, safeY, x + width, safeY + r);
  ctx.lineTo(x + width, safeY + safeHeight - r);
  ctx.quadraticCurveTo(x + width, safeY + safeHeight, x + width - r, safeY + safeHeight);
  ctx.lineTo(x + r, safeY + safeHeight);
  ctx.quadraticCurveTo(x, safeY + safeHeight, x, safeY + safeHeight - r);
  ctx.lineTo(x, safeY + r);
  ctx.quadraticCurveTo(x, safeY, x + r, safeY);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2600);
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}







