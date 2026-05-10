const LEGACY_STORAGE_KEYS = ["finix:v1", "prop-firm-tracker:v1"];
const LEGACY_THEME_STORAGE_KEYS = ["finix:theme", "prop-firm-tracker:theme"];
const STORAGE_KEY = "trazza:v1";
const THEME_STORAGE_KEY = "trazza:theme";
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

const defaultState = {
  firms: [],
  accounts: [],
  transactions: [],
};

let state = loadState();
let confirmHandler = null;
let currentSession = null;
let currentUser = null;
let cloudLoading = false;
let authMode = "login";
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const NET_CHART_MIN_VISIBLE_POINTS = 6;
const NET_CHART_PAN_STEP = 0.12;

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

const els = {};

applyTheme(getInitialTheme());

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  setCurrentDate();
  bindEvents();
  updateThemeToggle();
  refreshAll();
  await initializeCloud();
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
    "authGoogleButton",
    "authLoginButton",
    "authSwitchText",
    "authSignupButton",
    "authMessage",
    "appShell",
    "pageTitle",
    "syncStatus",
    "syncStatusText",
    "currentDateLabel",
    "metricNet",
    "metricNetHint",
    "metricExpenses",
    "metricIncome",
    "metricRoi",
    "metricRoiHint",
    "metricBreakEven",
    "metricActiveAccounts",
    "metricAccountHint",
    "dashboardFirmFilter",
    "dashboardAccountFilter",
    "dashboardPeriodFilter",
    "dashboardFromFilter",
    "dashboardToFilter",
    "dashboardResetFilters",
    "dashboardPeriodHint",
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
    "firmsEmpty",
    "accountsEmpty",
    "transactionsEmpty",
    "accountFirmFilter",
    "accountStatusFilter",
    "accountSearch",
    "transactionFirmFilter",
    "transactionKindFilter",
    "transactionFromFilter",
    "transactionToFilter",
    "transactionSearch",
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
    "confirmDialog",
    "confirmTitle",
    "confirmMessage",
    "confirmAcceptButton",
    "importFileInput",
    "migrateLocalButton",
    "toast",
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
  els.authGoogleButton.addEventListener("click", signInWithGoogle);
  els.authSignupButton.addEventListener("click", toggleAuthMode);
  els.logoutButton.addEventListener("click", signOut);

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setActiveSection(button.dataset.section));
  });

  document.getElementById("addFirmButton").addEventListener("click", () => openFirmDialog());
  document.getElementById("addFirmButtonInline").addEventListener("click", () => openFirmDialog());
  document.getElementById("addAccountButton").addEventListener("click", () => openAccountDialog());
  document.getElementById("addAccountButtonInline").addEventListener("click", () => openAccountDialog());
  document.getElementById("addTransactionButton").addEventListener("click", () => openTransactionDialog());
  document.getElementById("addTransactionButtonInline").addEventListener("click", () => openTransactionDialog());
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

  els.firmForm.addEventListener("submit", saveFirmFromForm);
  els.accountForm.addEventListener("submit", saveAccountFromForm);
  els.transactionForm.addEventListener("submit", saveTransactionFromForm);

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
      fillAccountSelect(els.transactionAccount, account.firmId, true, account.id);
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

  els.firmsTableBody.addEventListener("click", handleTableAction);
  els.accountsTableBody.addEventListener("click", handleTableAction);
  els.transactionsTableBody.addEventListener("click", handleTableAction);

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

  window.addEventListener("resize", debounce(() => {
    drawCharts(getDashboardSummary());
  }, 120));
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
  els.authGoogleButton.disabled = isBusy;
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
    : "Accede para sincronizar tus firms, cuentas y movimientos.";
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

async function signInWithGoogle() {
  if (!supabaseClient) return;
  if (window.location.protocol === "file:") {
    els.authMessage.textContent = "Google requiere abrir trazza desde Vercel o localhost.";
    return;
  }

  setAuthBusy(true, "Abriendo Google...");
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) {
    setAuthBusy(false);
    els.authMessage.textContent = error.message;
  }
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
    const [firmsResult, accountsResult, transactionsResult] = await Promise.all([
      supabaseClient.from("firms").select("*").order("name", { ascending: true }),
      supabaseClient.from("accounts").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("transactions").select("*").order("date", { ascending: true }),
    ]);

    [firmsResult, accountsResult, transactionsResult].forEach(throwIfSupabaseError);

    state = {
      firms: (firmsResult.data || []).map(fromDbFirm),
      accounts: (accountsResult.data || []).map(fromDbAccount),
      transactions: (transactionsResult.data || []).map(fromDbTransaction),
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

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  updateThemeToggle();
  drawCharts(getDashboardSummary());
}

function updateThemeToggle() {
  if (!els.themeToggleButton) return;
  const isDark = document.documentElement.dataset.theme === "dark";
  els.themeToggleButton.innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}"></i>`;
  els.themeToggleButton.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  els.themeToggleButton.title = isDark ? "Modo claro" : "Modo oscuro";
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

function refreshAll() {
  fillFirmSelects();
  updateDashboardDateInputs();
  fillAccountSelect(els.transactionAccount, els.transactionFirm.value, true);
  renderDashboard();
  renderFirmsTable();
  renderAccountsTable();
  renderTransactionsTable();
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
  };
}

function setActiveSection(section) {
  const titles = {
    overview: "Panel",
    firms: "Firms",
    accounts: "Cuentas",
    transactions: "Movimientos",
  };

  document.querySelectorAll(".section-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${section}Section`);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });
  els.pageTitle.textContent = titles[section] || "Panel";
  drawCharts(getDashboardSummary());
}

function handleEmptyStateAction(event) {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  const button = target?.closest("[data-empty-action]");
  if (!button) return;

  const actions = {
    "add-firm": () => openFirmDialog(),
    "add-account": () => openAccountDialog(),
    "add-transaction": () => openTransactionDialog(),
    "reset-account-filters": resetAccountFilters,
    "reset-transaction-filters": resetTransactionFilters,
  };

  actions[button.dataset.emptyAction]?.();
}

function resetAccountFilters() {
  els.accountFirmFilter.value = "all";
  els.accountStatusFilter.value = "all";
  els.accountSearch.value = "";
  renderAccountsTable();
}

function resetTransactionFilters() {
  els.transactionFirmFilter.value = "all";
  els.transactionKindFilter.value = "all";
  els.transactionFromFilter.value = "";
  els.transactionToFilter.value = "";
  els.transactionSearch.value = "";
  renderTransactionsTable();
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
  fillDashboardAccountFilter();
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

function fillAccountSelect(select, firmId, includeEmpty, selectedId = "") {
  const accounts = state.accounts
    .filter((account) => !firmId || account.firmId === firmId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const empty = includeEmpty ? `<option value="">Sin cuenta concreta</option>` : "";
  select.innerHTML = `${empty}${accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("")}`;
  select.value = selectedId || "";
}

function fillTransactionCategories(kind, selected = "") {
  const categories = kind === "income" ? incomeCategories : expenseCategories;
  els.transactionCategory.innerHTML = categories
    .map((category) => `<option value="${category}">${categoryLabels[category]}</option>`)
    .join("");
  if (categories.includes(selected)) {
    els.transactionCategory.value = selected;
  }
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
  if (period === "custom") {
    return {
      from: els.dashboardFromFilter?.value || "",
      to: els.dashboardToFilter?.value || "",
    };
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
    year: "Este ano",
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

  els.metricNet.textContent = formatMoney(summary.net);
  els.metricExpenses.textContent = formatMoney(summary.expenses);
  els.metricIncome.textContent = formatMoney(summary.income);
  els.metricRoi.textContent = formatPercent(summary.roi);
  els.metricBreakEven.textContent = formatMoney(summary.breakEven);
  els.metricActiveAccounts.textContent = String(summary.activeAccounts);
  els.metricAccountHint.textContent = `${summary.accountCount} ${summary.accountCount === 1 ? "cuenta" : "cuentas"} en el filtro`;
  els.metricRoiHint.textContent = isDashboardFiltered(summary.filters) ? "Base: gasto filtrado" : "Base: gasto total";
  els.dashboardPeriodHint.textContent = getDashboardPeriodLabel(summary.filters);
  els.metricNetHint.textContent =
    summary.transactions.length === 0
      ? "Sin movimientos en el filtro"
      : summary.net >= 0
        ? "Retiros por encima de gastos"
        : "Gastos por encima de retiros";

  document.querySelector(".metric-net").classList.toggle("positive", summary.net > 0);
  document.querySelector(".metric-net").classList.toggle("negative", summary.net < 0);

  els.monthExpenses.textContent = formatMoney(summary.expenses);
  els.monthIncome.textContent = formatMoney(summary.income);
  els.monthNet.textContent = formatMoney(summary.net);
  els.monthNet.className = summary.net >= 0 ? "amount positive" : "amount negative";

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
          <td data-label="Tamano">${escapeHtml(account.size || "-")}</td>
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
      "Anade la primera cuenta para seguir su estado, coste y retiradas.",
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
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(size.width - pad.right, zeroY);
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
  const size = chartSize(canvas);
  const horizontalPadding = 12;
  const rowGap = 21;
  const titleHeight = 28;
  ctx.font = "600 12px Inter, sans-serif";
  const titleWidth = ctx.measureText(title).width;
  ctx.font = "12px Inter, sans-serif";
  const rowWidth = Math.max(
    titleWidth,
    ...rows.map((row) => ctx.measureText(row.label).width + ctx.measureText(row.value).width + 48)
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
  ctx.font = "600 12px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, left + horizontalPadding, top + 17);

  rows.forEach((row, index) => {
    const rowY = top + titleHeight + 10 + index * rowGap;
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(left + horizontalPadding + 3, rowY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.muted;
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(row.label, left + horizontalPadding + 14, rowY);

    ctx.fillStyle = palette.labelText;
    ctx.font = "600 12px Inter, sans-serif";
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
    const x = xFor(tick.index);
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
  ctx.font = "12px Inter, sans-serif";
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
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.label, center, size.height - 10);
  });
}

function setupCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  canvas.chartWidth = width;
  canvas.chartHeight = height;
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function chartSize(canvas) {
  return {
    height: canvas.chartHeight || canvas.getBoundingClientRect().height || canvas.height,
    width: canvas.chartWidth || canvas.getBoundingClientRect().width || canvas.width,
  };
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

function drawGrid(ctx, canvas, min, max) {
  const palette = chartPalette();
  const pad = chartPadding(canvas);
  const size = chartSize(canvas);
  const lines = 4;
  const top = pad.top;
  const bottom = size.height - pad.bottom;
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= lines; i += 1) {
    const y = top + (i / lines) * (bottom - top);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(size.width - pad.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = palette.muted;
  ctx.font = "11.5px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(formatAxisMoney(max), pad.left - 8, top);
  ctx.fillText(formatAxisMoney(min), pad.left - 8, bottom);
  ctx.textBaseline = "alphabetic";
}

function drawChartLabel(ctx, canvas, label, x, y, align = "left") {
  const palette = chartPalette();
  const size = chartSize(canvas);
  ctx.font = "12px Inter, sans-serif";
  const width = ctx.measureText(label).width + 14;
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
  ctx.fillText(label, left + width / 2, top + height / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function openFirmDialog(firm = null) {
  els.firmForm.reset();
  els.firmId.value = firm?.id || "";
  els.firmName.value = firm?.name || "";
  els.firmType.value = firm?.type || "Futuros";
  els.firmNotes.value = firm?.notes || "";
  els.firmDialogTitle.textContent = firm ? "Editar firm" : "Nueva firm";
  showDialog(els.firmDialog);
}

function openAccountDialog(account = null) {
  if (!state.firms.length) {
    openFirmDialog();
    toast("Crea una firm antes de anadir cuentas.");
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
  showDialog(els.accountDialog);
}

function openTransactionDialog(transaction = null) {
  if (!state.firms.length) {
    openFirmDialog();
    toast("Crea una firm antes de anadir movimientos.");
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
  showDialog(els.transactionDialog);
}

async function saveFirmFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");

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

  if (!firm.name) return;

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
  }
}

async function saveAccountFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");

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

  if (!account.firmId || !account.name) return;

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
    } else {
      state.accounts.push(savedAccount);
    }

    persist();
    closeDialog("accountDialog");
    refreshAll();
    toast("Cuenta guardada.");
  } catch (error) {
    toast(error.message || "No se pudo guardar la cuenta.");
  }
}

async function saveTransactionFromForm(event) {
  event.preventDefault();
  if (!currentUser) return toast("Inicia sesion para guardar.");

  const id = els.transactionId.value || createId();
  const existing = state.transactions.find((tx) => tx.id === id);
  const amount = Math.abs(Number(els.transactionAmount.value));
  const account = getAccount(els.transactionAccount.value);
  const transaction = {
    id,
    date: els.transactionDate.value,
    kind: els.transactionKind.value,
    category: els.transactionCategory.value,
    amount,
    currency: EURO,
    firmId: account?.firmId || els.transactionFirm.value,
    accountId: account?.id || "",
    note: els.transactionNote.value.trim(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (!transaction.date || !transaction.kind || !transaction.category || !transaction.amount || !transaction.firmId) return;

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
  }
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "edit-firm") openFirmDialog(getFirm(id));
  if (action === "edit-account") openAccountDialog(getAccount(id));
  if (action === "edit-transaction") openTransactionDialog(getTransaction(id));
  if (action === "delete-firm") requestDeleteFirm(id);
  if (action === "delete-account") requestDeleteAccount(id);
  if (action === "delete-transaction") requestDeleteTransaction(id);
}

function requestDeleteFirm(id) {
  const firm = getFirm(id);
  const hasAccounts = state.accounts.some((account) => account.firmId === id);
  const hasTransactions = state.transactions.some((tx) => resolveFirmId(tx) === id);

  if (hasAccounts || hasTransactions) {
    toast("No puedes eliminar una firm con cuentas o movimientos.");
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

  if (hasTransactions) {
    toast("No puedes eliminar una cuenta con movimientos.");
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

  return { firms, accounts, transactions };
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
  return Boolean(
    Array.isArray(value?.firms) &&
      Array.isArray(value?.accounts) &&
      Array.isArray(value?.transactions) &&
      (value.firms.length || value.accounts.length || value.transactions.length)
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
