(() => {
  const STORAGE_KEY = "trazza:language";
  const SUPPORTED_LANGUAGES = new Set(["es", "en"]);
  const ATTRIBUTE_NAMES = ["aria-label", "alt", "placeholder", "title"];
  const ORIGINAL_TEXT_KEY = "__trazzaI18nOriginalText";

  const translations = new Map(
    Object.entries({
      "Trazza — Waitlist": "Trazza — Waitlist",
      "Trazza es un journal de trading y prop firm tracker hecho por traders, para traders.":
        "Trazza is a trading journal and prop firm tracker built by traders, for traders.",
      "Ya tengo acceso": "I already have access",
      "Para usuarios con acceso privado": "For private access users",
      "Trazza waitlist": "Trazza waitlist",
      "Hecho por traders,": "Built by traders,",
      "para traders.": "for traders.",
      "Un journal de trading y prop firm tracker simple, visual y pensado para usarlo de verdad.":
        "A simple, visual trading journal and prop firm tracker built for real daily use.",
      "Correo electrónico": "Email address",
      "Unirme a la waitlist": "Join the waitlist",
      "Algunos traders ya la están probando en acceso privado. Déjanos tu correo y te avisaremos cuando abramos más plazas. Sin spam.":
        "Some traders are already testing it with private access. Leave your email and we will let you know when more spots open. No spam.",
      "Journal visual": "Visual journal",
      "Calendario P&L": "P&L calendar",
      "Vistas de la aplicación Trazza": "Trazza app views",
      "Dashboard del journal de Trazza": "Trazza journal dashboard",
      "Galería de entradas del journal": "Journal entries gallery",
      "Calendario de P&L del journal": "Journal P&L calendar",
      "© 2026 Trazza. Construyendo una herramienta seria para traders consistentes.":
        "© 2026 Trazza. Building a serious tool for consistent traders.",
      "Introduce un correo válido.": "Enter a valid email address.",
      "Guardando...": "Saving...",
      "Ya tenemos tu correo. Te avisaremos cuando abramos más plazas.":
        "We already have your email. We will let you know when more spots open.",
      "Listo. Te avisaremos cuando abramos más plazas.": "Done. We will let you know when more spots open.",
      "No hemos podido guardar tu correo ahora mismo. Inténtalo de nuevo en unos minutos.":
        "We could not save your email right now. Try again in a few minutes.",
      "No se pudo guardar el correo.": "The email could not be saved.",

      "Accede para sincronizar tus firms, cuentas, movimientos y journal.":
        "Sign in to sync your firms, accounts, movements and journal.",
      "Nombre y apellidos": "Full name",
      "Password": "Password",
      "Minimo 6 caracteres": "Minimum 6 characters",
      "Entrar": "Sign in",
      "Crear cuenta": "Create account",
      "No tienes cuenta?": "Do not have an account?",
      "Ya tienes cuenta?": "Already have an account?",
      "El registro está cerrado. Únete a la waitlist en la página principal.":
        "Registration is closed. Join the waitlist on the main page.",
      "Crea tu acceso para guardar tus datos en la nube.": "Create your access to save your data in the cloud.",
      "Entrando...": "Signing in...",
      "Creando cuenta...": "Creating account...",
      "Cuenta creada. Revisa tu email para confirmar el acceso.":
        "Account created. Check your email to confirm access.",
      "Cuenta creada. Entrando...": "Account created. Signing in...",

      "Areas principales": "Main areas",
      "Menu del area activa": "Active area menu",
      "Prop Firm Tracker": "Prop Firm Tracker",
      "Journal": "Journal",
      "Panel": "Dashboard",
      "Dashboard": "Dashboard",
      "Journal - Entradas": "Journal - Entries",
      "Journal - Dashboard": "Journal - Dashboard",
      "Firms": "Firms",
      "Cuentas": "Accounts",
      "Movimientos": "Movements",
      "Entradas": "Entries",
      "Backup JSON": "JSON backup",
      "Exportar CSV": "Export CSV",
      "Importar JSON": "Import JSON",
      "Subir datos locales": "Upload local data",
      "Sincronizando datos...": "Syncing data...",
      "Datos sincronizados.": "Data synced.",
      "Sin conexión con Supabase. Usando datos locales.": "No Supabase connection. Using local data.",
      "No se pudo sincronizar con Supabase.": "Could not sync with Supabase.",
      "Nuevo": "New",
      "Nueva": "New",
      "Salir": "Log out",
      "Ocultar datos del dashboard": "Hide dashboard data",
      "Mostrar datos del dashboard": "Show dashboard data",
      "Ocultar datos": "Hide data",
      "Mostrar datos": "Show data",
      "Cambiar a modo oscuro": "Switch to dark mode",
      "Cambiar a modo claro": "Switch to light mode",
      "Cambiar tema": "Change theme",
      "Modo oscuro": "Dark mode",
      "Modo claro": "Light mode",

      "Firm": "Firm",
      "Cuenta": "Account",
      "Periodo": "Period",
      "Todo": "All",
      "Todas": "All",
      "Todos": "All",
      "Mes actual": "Current month",
      "Ultimos 30 dias": "Last 30 days",
      "Últimos 30 días": "Last 30 days",
      "Ultimos 90 dias": "Last 90 days",
      "Últimos 90 días": "Last 90 days",
      "Este año": "This year",
      "Personalizado": "Custom",
      "Desde": "From",
      "Hasta": "To",
      "Limpiar": "Clear",
      "Neto total": "Net total",
      "Gasto total": "Total spend",
      "Retiros": "Withdrawals",
      "ROI": "ROI",
      "Break-even": "Break-even",
      "Activas": "Active",
      "Evolucion del capital": "Capital evolution",
      "Evolución del capital": "Capital evolution",
      "Leyenda del grafico": "Chart legend",
      "Leyenda del gráfico": "Chart legend",
      "Capital": "Capital",
      "Payouts": "Payouts",
      "Gastos": "Expenses",
      "Resumen del periodo": "Period summary",
      "Todo el historial": "Full history",
      "Gasto": "Expense",
      "Neto": "Net",
      "Sin datos": "No data",
      "Gastos por categoria": "Expenses by category",
      "Gastos por categoría": "Expenses by category",
      "Resultado por cuenta": "Result by account",
      "Ultimos movimientos": "Latest movements",
      "Últimos movimientos": "Latest movements",

      "Tipo": "Type",
      "Gastado": "Spent",
      "Retirado": "Withdrawn",
      "Estado": "Status",
      "Tamaño": "Size",
      "Compra": "Purchase",
      "Fecha": "Date",
      "Categoria": "Category",
      "Categoría": "Category",
      "Nota": "Note",
      "Importe": "Amount",
      "Acciones": "Actions",
      "Nombre": "Name",
      "Notas": "Notes",
      "Nueva firm": "New firm",
      "Editar firm": "Edit firm",
      "Nueva cuenta": "New account",
      "Editar cuenta": "Edit account",
      "Nuevo movimiento": "New movement",
      "Editar movimiento": "Edit movement",
      "Nueva entrada": "New entry",
      "Editar entrada": "Edit entry",
      "Guardar": "Save",
      "Cancelar": "Cancel",
      "Eliminar": "Delete",
      "Editar": "Edit",
      "Activa": "Active",
      "Pasada": "Passed",
      "Fondeada": "Funded",
      "Fallada": "Failed",
      "Cerrada": "Closed",
      "Compra challenge": "Challenge purchase",
      "Reset": "Reset",
      "Activacion": "Activation",
      "Activación": "Activation",
      "Mensualidad": "Subscription",
      "Plataforma": "Platform",
      "Comision": "Commission",
      "Comisión": "Commission",
      "Payout": "Payout",
      "Refund": "Refund",
      "Otro": "Other",
      "Retiro / ingreso": "Withdrawal / income",
      "Nombre, tamaño...": "Name, size...",
      "Nombre, tamaÃ±o...": "Name, size...",
      "Objetivo, drawdown, payout rules...": "Goal, drawdown, payout rules...",
      "Detalle del pago o retiro": "Payment or withdrawal details",

      "Trading overview": "Trading overview",
      "Balance total": "Total balance",
      "Net P&L": "Net P&L",
      "Beneficio": "Return",
      "Balance": "Balance",
      "Resultado acumulado del journal.": "Accumulated journal result.",
      "Grafico interactivo de P&L total del journal": "Interactive total journal P&L chart",
      "Gráfico interactivo de P&L total del journal": "Interactive total journal P&L chart",
      "Sin P&L": "No P&L",
      "Winrate": "Winrate",
      "Aciertos, empate y pérdidas": "Wins, breakeven and losses",
      "Profit factor": "Profit factor",
      "Avg win / loss": "Avg win / loss",
      "Avg win": "Avg win",
      "Avg loss": "Avg loss",
      "Promedio por trade cerrado": "Average per closed trade",
      "Errores": "Mistakes",
      "errores": "mistakes",
      "error": "mistake",
      "Distribucion de errores registrados.": "Registered mistake distribution.",
      "Distribución de errores registrados.": "Registered mistake distribution.",
      "Disciplina": "Discipline",
      "Evolucion de disciplina en el tiempo.": "Discipline evolution over time.",
      "Evolución de disciplina en el tiempo.": "Discipline evolution over time.",
      "Mayo de 2026": "May 2026",
      "Month total": "Month total",
      "Hoy": "Today",
      "Semana": "Week",
      "SEMANA": "WEEK",
      "Buscar": "Search",
      "Activo, dirección, notas...": "Asset, direction, notes...",
      "Activo, direccion, notas...": "Asset, direction, notes...",
      "Operaciones, decisiones y notas": "Trades, decisions and notes",
      "P&L, disciplina, errores y calendario": "P&L, discipline, mistakes and calendar",
      "Inicio": "Start",
      "Fin": "End",
      "Sin fecha": "No date",
      "P&L total": "Total P&L",
      "P&L dia": "Daily P&L",
      "P&L día": "Daily P&L",
      "Veces": "Times",
      "Peso": "Weight",
      "Entradas": "Entries",

      "Estado mental": "Mental state",
      "Calmado": "Calm",
      "Enfocado": "Focused",
      "Ansioso": "Anxious",
      "Impaciente": "Impatient",
      "Revenge": "Revenge",
      "Cansado": "Tired",
      "Activo": "Asset",
      "Ej. MNQ, NQ, ES, MES...": "E.g. MNQ, NQ, ES, MES...",
      "Dirección": "Direction",
      "Direccion": "Direction",
      "Selecciona": "Select",
      "Long": "Long",
      "Short": "Short",
      "5 - Excelente": "5 - Excellent",
      "4 - Buena": "4 - Good",
      "3 - Normal": "3 - Normal",
      "2 - Floja": "2 - Weak",
      "1 - Mala": "1 - Bad",
      "Captura de la operación": "Trade screenshot",
      "Captura de la operacion": "Trade screenshot",
      "Quitar": "Remove",
      "Pega una imagen, arrástrala aquí o haz clic para subirla.": "Paste an image, drag it here or click to upload.",
      "Pega una imagen, arrÃ¡strala aquÃ­ o haz clic para subirla.": "Paste an image, drag it here or click to upload.",
      "Errores cometidos": "Mistakes made",
      "Marca solo los errores de esta entrada.": "Select only the mistakes for this entry.",
      "Configurar": "Configure",
      "Qué pasó, qué setups tomaste, cómo gestionaste el riesgo...":
        "What happened, which setups you took, how you managed risk...",
      "Detalle de entrada": "Entry details",
      "Entrada": "Entry",
      "Sin dirección": "No direction",
      "Sin direccion": "No direction",
      "Sin errores": "No mistakes",
      "Sin captura": "No screenshot",
      "Ampliar captura": "Zoom screenshot",
      "Ver operacion": "View trade",
      "Ver operación": "View trade",
      "Captura de la operacion": "Trade screenshot",
      "Captura ampliada de": "Zoomed screenshot of",
      "Sin notas.": "No notes.",
      "Errores del journal": "Journal mistakes",
      "Gestiona tu lista base de errores para reutilizarla en cada entrada.":
        "Manage your base list of mistakes and reuse it in each entry.",
      "Nuevo error": "New mistake",
      "Editar error": "Edit mistake",
      "Entrar tarde": "Late entry",
      "Gravedad": "Severity",
      "Grave": "Severe",
      "Moderado": "Moderate",
      "Leve": "Minor",
      "Ej. Entrar tarde": "E.g. Late entry",

      "Sin cuenta concreta": "No specific account",
      "Crea una firm primero": "Create a firm first",
      "Crea una cuenta primero": "Create an account first",
      "No hay firms registradas.": "No firms registered.",
      "No hay cuentas registradas.": "No accounts registered.",
      "No hay movimientos registrados.": "No movements registered.",
      "No hay entradas registradas.": "No entries registered.",
      "No hay errores configurados.": "No mistakes configured.",
      "Sin entradas con P&L registrado.": "No entries with registered P&L.",
      "Sin entradas con disciplina.": "No entries with discipline.",
      "Sin errores registrados.": "No mistakes registered.",
      "Añade errores desde el dashboard para marcarlos aqui.": "Add mistakes from the dashboard to select them here.",
      "Añade errores desde el dashboard para marcarlos aquí.": "Add mistakes from the dashboard to select them here.",
      "Firm guardada.": "Firm saved.",
      "Firm eliminada.": "Firm deleted.",
      "Cuenta guardada.": "Account saved.",
      "Cuenta eliminada.": "Account deleted.",
      "Movimiento guardado.": "Movement saved.",
      "Movimiento eliminado.": "Movement deleted.",
      "Entrada guardada.": "Entry saved.",
      "Entrada eliminada.": "Entry deleted.",
      "Error guardado.": "Mistake saved.",
      "Error ocultado.": "Mistake hidden.",
      "Error restaurado.": "Mistake restored.",
      "No se pudo guardar la firm.": "The firm could not be saved.",
      "No se pudo guardar la cuenta.": "The account could not be saved.",
      "No se pudo guardar el movimiento.": "The movement could not be saved.",
      "No se pudo guardar la entrada.": "The entry could not be saved.",
      "No se pudo guardar el error.": "The mistake could not be saved.",
      "No se pudo eliminar la firm.": "The firm could not be deleted.",
      "No se pudo eliminar la cuenta.": "The account could not be deleted.",
      "No se pudo eliminar el movimiento.": "The movement could not be deleted.",
      "No se pudo eliminar la entrada.": "The entry could not be deleted.",
      "Confirmar": "Confirm",
      "Confirmar acción": "Confirm action",
      "Esta acción no se puede deshacer.": "This action cannot be undone.",
      "Eliminar firm": "Delete firm",
      "Eliminar cuenta": "Delete account",
      "Eliminar movimiento": "Delete movement",
      "Eliminar entrada": "Delete entry",
      "Eliminar esta entrada de journal?": "Delete this journal entry?",
      "No puedes eliminar una firm con cuentas, movimientos o entradas de journal.":
        "You cannot delete a firm with accounts, movements or journal entries.",
      "No puedes eliminar una cuenta con movimientos o entradas de journal.":
        "You cannot delete an account with movements or journal entries.",
      "Selecciona una firm valida.": "Select a valid firm.",
      "Selecciona una cuenta valida.": "Select a valid account.",
      "La cuenta seleccionada no pertenece a esa firm.": "The selected account does not belong to that firm.",
      "La fecha no es valida.": "The date is not valid.",
      "La fecha de la entrada no es valida.": "The entry date is not valid.",
      "La fecha de la entrada no puede ser futura.": "The entry date cannot be in the future.",
      "Pon un activo para la entrada.": "Enter an asset for the entry.",
      "Selecciona si la operacion fue long o short.": "Select whether the trade was long or short.",
      "Selecciona si la operación fue long o short.": "Select whether the trade was long or short.",
      "Selecciona un estado mental valido.": "Select a valid mental state.",
      "La disciplina debe estar entre 1 y 5.": "Discipline must be between 1 and 5.",
      "El P&L debe ser un numero valido.": "P&L must be a valid number.",
      "El P&L debe ser un número valido.": "P&L must be a valid number.",
      "Pega una imagen valida para la operacion.": "Paste a valid image for the trade.",
      "Hay un error de journal no valido.": "There is an invalid journal mistake.",
    })
  );

  const rules = [
    [/^Dia seleccionado: (.+)$/i, "Selected day: $1"],
    [/^Día seleccionado: (.+)$/i, "Selected day: $1"],
    [/^Base (.+)$/i, "Base $1"],
    [/^(\d+) errores registrados en el filtro actual\.$/i, "$1 mistakes registered in the current filter."],
    [/^(\d+) error registrado en el filtro actual\.$/i, "$1 mistake registered in the current filter."],
    [/^(\d+) errores$/i, "$1 mistakes"],
    [/^(\d+) error$/i, "$1 mistake"],
    [/^(\d+) entradas$/i, "$1 entries"],
    [/^(\d+) entrada$/i, "$1 entry"],
    [/^(\d+) trades cerrados$/i, "$1 closed trades"],
    [/^(\d+) trade cerrado$/i, "$1 closed trade"],
    [/^(\d+) movimientos$/i, "$1 movements"],
    [/^(\d+) movimiento$/i, "$1 movement"],
    [/^(\d+) cuentas$/i, "$1 accounts"],
    [/^(\d+) cuenta$/i, "$1 account"],
    [/^Media (.+) - (.+) desde el inicio\.$/i, "Average $1 - $2 since the start."],
    [/^(.+) este mes - (.+) dias positivos - (.+) entradas$/i, "$1 this month - $2 positive days - $3 entries"],
    [/^(.+) este mes - (.+) días positivos - (.+) entradas$/i, "$1 this month - $2 positive days - $3 entries"],
    [/^(.+) total - Max (.+) - Min (.+)$/i, "$1 total - Max $2 - Min $3"],
    [/^Sin entradas con esos filtros$/i, "No entries with those filters"],
    [/^Sin movimientos con esos filtros$/i, "No movements with those filters"],
    [/^Sin cuentas con esos filtros$/i, "No accounts with those filters"],
    [/^Sin firms con esos filtros$/i, "No firms with those filters"],
    [/^Eliminar (.+)\?$/i, "Delete $1?"],
  ];

  let applying = false;
  let observer = null;

  function initialLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.has(stored)) return stored;
    return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
  }

  function getLanguage() {
    const lang = localStorage.getItem(STORAGE_KEY) || initialLanguage();
    return SUPPORTED_LANGUAGES.has(lang) ? lang : "es";
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function translateText(value) {
    const text = normalize(value);
    if (!text) return value;
    if (translations.has(text)) return translations.get(text);
    for (const [pattern, replacement] of rules) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return value;
  }

  function shouldSkip(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(element?.closest?.("script, style, template, [data-no-i18n]"));
  }

  function translateTextNode(node, lang) {
    if (!node.nodeValue || !normalize(node.nodeValue) || shouldSkip(node)) return;
    if (!node[ORIGINAL_TEXT_KEY]) node[ORIGINAL_TEXT_KEY] = node.nodeValue;
    const original = node[ORIGINAL_TEXT_KEY];
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    const next = lang === "en" ? `${leading}${translateText(original)}${trailing}` : original;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttribute(element, attribute, lang) {
    if (!element.hasAttribute(attribute) || shouldSkip(element)) return;
    const originalAttribute = `data-i18n-original-${attribute}`;
    if (!element.hasAttribute(originalAttribute)) {
      element.setAttribute(originalAttribute, element.getAttribute(attribute));
    }
    const original = element.getAttribute(originalAttribute);
    const next = lang === "en" ? translateText(original) : original;
    if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
  }

  function walkText(root, lang) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      translateTextNode(node, lang);
      node = walker.nextNode();
    }
  }

  function walkAttributes(root, lang) {
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll("*")] : root.querySelectorAll("*");
    elements.forEach((element) => ATTRIBUTE_NAMES.forEach((attribute) => translateAttribute(element, attribute, lang)));
  }

  function updateDocumentMeta(lang) {
    if (!document.documentElement.dataset.i18nOriginalTitle) {
      document.documentElement.dataset.i18nOriginalTitle = document.title;
    }
    const originalTitle = document.documentElement.dataset.i18nOriginalTitle;
    document.title = lang === "en" ? translateText(originalTitle) : originalTitle;

    const description = document.querySelector('meta[name="description"]');
    if (description) translateAttribute(description, "content", lang);
    document.documentElement.lang = lang;
    document.documentElement.dataset.language = lang;
  }

  function updateToggles(lang) {
    document.querySelectorAll("[data-language-toggle]").forEach((button) => {
      const next = lang === "en" ? "ES" : "EN";
      button.textContent = next;
      button.setAttribute("aria-label", lang === "en" ? "Cambiar a español" : "Switch to English");
      button.title = lang === "en" ? "Español" : "English";
    });
  }

  function apply(root = document.body) {
    if (!root || applying) return;
    applying = true;
    const lang = getLanguage();
    updateDocumentMeta(lang);
    walkText(root, lang);
    walkAttributes(root, lang);
    updateToggles(lang);
    applying = false;
  }

  function observe() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      if (applying || getLanguage() !== "en") return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target, "en");
        } else {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, "en");
            if (node.nodeType === Node.ELEMENT_NODE) apply(node);
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.has(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    apply();
    window.dispatchEvent(new CustomEvent("trazza:language-change", { detail: { language: lang } }));
  }

  function toggleLanguage() {
    setLanguage(getLanguage() === "en" ? "es" : "en");
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-language-toggle]");
    if (!button) return;
    toggleLanguage();
  });

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    observe();
  });

  window.TrazzaI18n = {
    apply,
    getLanguage,
    setLanguage,
    t: (value) => (getLanguage() === "en" ? translateText(value) : value),
    toggleLanguage,
  };
})();
