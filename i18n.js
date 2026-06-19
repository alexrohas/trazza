(() => {
  const STORAGE_KEY = "trazza:language";
  const SUPPORTED_LANGUAGES = new Set(["es", "en"]);
  const ATTRIBUTE_NAMES = ["aria-label", "alt", "placeholder", "title"];
  const ORIGINAL_TEXT_KEY = "__trazzaI18nOriginalText";

  const translations = new Map(
    Object.entries({
      "Trazza — Waitlist": "Trazza — Waitlist",
      "Trazza — Journal y finanzas de trading": "Trazza — Trading journal and finance",
      "Trazza es un journal de trading y finanzas hecho por traders, para traders.":
        "Trazza is a trading journal and finance workspace built by traders, for traders.",
      "Trazza une journal de trading, finanzas, reglas de cuentas y métricas reales en un workspace visual para traders.":
        "Trazza brings together trading journal, finance, account rules and real metrics in a visual workspace for traders.",
      "Trazza es un journal de trading y prop firm tracker hecho por traders, para traders.":
        "Trazza is a trading journal and finance workspace built by traders, for traders.",
      "Navegación principal": "Main navigation",
      "Producto": "Product",
      "Ya tengo acceso": "I already have access",
      "Para usuarios con acceso privado": "For private access users",
      "Tu journal y finanzas de trading": "Your trading journal and finance",
      "Journal y finanzas de trading": "Trading journal and finance",
      "en un solo lugar.": "in one place.",
      "Registra operaciones, controla cuentas, gastos, payouts, reglas y disciplina con un dashboard pensado para traders que quieren ver su resultado real.":
        "Log trades, manage accounts, expenses, payouts, rules and discipline with a dashboard built for traders who want to see their real result.",
      "Registra operaciones, controla cuentas, gastos, payouts y disciplina con un dashboard pensado para traders que quieren ver su resultado real.":
        "Log trades, manage accounts, expenses, payouts and discipline with a dashboard built for traders who want to see their real result.",
      "Ver cómo funciona": "See how it works",
      "Resumen del producto": "Product summary",
      "Entradas con P&L, errores y capturas.": "Entries with P&L, mistakes and screenshots.",
      "Fees, compras, resets y payouts en contexto.": "Fees, purchases, resets and payouts in context.",
      "Reglas": "Rules",
      "Target, drawdown y disciplina por cuenta.": "Target, drawdown and discipline per account.",
      "Dashboard real de Trazza": "Real Trazza dashboard",
      "Dashboard de journal de Trazza": "Trazza journal dashboard",
      "Dashboard de journal de Trazza en modo claro": "Trazza journal dashboard in light mode",
      "Resultado visible": "Visible result",
      "Calendario, balance y métricas trabajando juntos.": "Calendar, balance and metrics working together.",
      "Convierte cada sesión en información útil.": "Turn every session into useful information.",
      "Trazza no es solo una lista de trades. Une captura, activo, dirección, disciplina, estado mental, errores y P&L para que puedas revisar patrones sin perderte en hojas sueltas.":
        "Trazza is not just a list of trades. It connects screenshot, asset, direction, discipline, mental state, mistakes and P&L so you can review patterns without getting lost in loose spreadsheets.",
      "Guarda operaciones con captura, notas y errores para revisar rápido qué hiciste bien y qué se repite.":
        "Save trades with screenshot, notes and mistakes so you can quickly review what you did well and what keeps repeating.",
      "Ve días verdes, días rojos, totales semanales y evolución mensual sin reconstruir nada a mano.":
        "See green days, red days, weekly totals and monthly evolution without rebuilding anything by hand.",
      "Métricas de verdad": "Real metrics",
      "Winrate, profit factor, errores, disciplina y balance conectados con tus entradas reales.":
        "Winrate, profit factor, mistakes, discipline and balance connected to your real entries.",
      "Del trade aislado a una lectura completa de tu rendimiento.": "From isolated trade to complete performance reading.",
      "La vista de dashboard resume tu evolución, mientras las pantallas de detalle te dejan bajar hasta cada operación cuando necesitas revisar contexto.":
        "The dashboard view summarizes your evolution, while detail screens let you drill into each trade when you need context.",
      "Dashboard con balance, errores, disciplina y winrate": "Dashboard with balance, mistakes, discipline and winrate",
      "Dashboard para revisar de un vistazo": "Dashboard for at-a-glance review",
      "Balance, winrate, profit factor, disciplina y errores se actualizan con cada entrada.":
        "Balance, winrate, profit factor, discipline and mistakes update with every entry.",
      "Galería de operaciones con capturas": "Trade gallery with screenshots",
      "Entradas con contexto": "Entries with context",
      "Filtra por cuenta, periodo, activo, dirección o notas.": "Filter by account, period, asset, direction or notes.",
      "Calendario de resultados por día": "Daily results calendar",
      "Calendario operativo": "Trading calendar",
      "Detecta semanas buenas, sesiones flojas y rachas de pérdida.": "Spot good weeks, weak sessions and losing streaks.",
      "También mide el dinero que sale de la cuenta.": "Also measure the money leaving the account.",
      "Una cuenta puede parecer rentable hasta que sumas compras, resets, activaciones, comisiones y payouts. Trazza te ayuda a ver el neto real.":
        "An account can look profitable until you add purchases, resets, activations, commissions and payouts. Trazza helps you see the real net result.",
      "Métricas principales": "Main metrics",
      "Resultado real después de gastos y retiros.": "Real result after expenses and withdrawals.",
      "Rentabilidad sobre lo que has invertido.": "Return on what you have invested.",
      "Cuánto necesitas recuperar para estar plano.": "How much you need to recover to break even.",
      "Drawdown": "Drawdown",
      "Reglas de cuenta visibles en el journal.": "Account rules visible in the journal.",
      "Control financiero para prop firms y cuentas personales": "Financial control for prop firms and personal accounts",
      "Registra empresas, cuentas, movimientos y estados para no mezclar rendimiento operativo con dinero gastado.":
        "Track firms, accounts, movements and statuses so you do not mix trading performance with money spent.",
      "Compras de challenge, resets, activaciones y mensualidades.": "Challenge purchases, resets, activations and subscriptions.",
      "Payouts, refunds, comisiones y gastos generales.": "Payouts, refunds, commissions and general expenses.",
      "Filtros por empresa, cuenta, periodo y tipo de movimiento.": "Filters by firm, account, period and movement type.",
      "Panel financiero de Trazza": "Trazza finance dashboard",
      "Empieza a registrar tu trading con más claridad.": "Start tracking your trading with more clarity.",
      "Crea tu cuenta gratis y usa Trazza como centro de control para tus operaciones, finanzas y revisión diaria.":
        "Create your free account and use Trazza as the control center for your trades, finances and daily review.",
      "Trazza waitlist": "Trazza waitlist",
      "Hecho por traders,": "Built by traders,",
      "para traders.": "for traders.",
      "Un journal de trading y finanzas simple, visual y pensado para usarlo de verdad.":
        "A simple, visual trading journal and finance workspace built for real daily use.",
      "Un journal de trading y prop firm tracker simple, visual y pensado para usarlo de verdad.":
        "A simple, visual trading journal and finance workspace built for real daily use.",
      "Correo electrónico": "Email address",
      "Unirme a la waitlist": "Join the waitlist",
      "Acepto la polÃ­tica de privacidad y autorizo a Trazza a escribirme para avisarme del lanzamiento y acceso a la app.":
        "I accept the privacy policy and authorize Trazza to contact me about the launch and app access.",
      "Acepto la política de privacidad y autorizo a Trazza a escribirme para avisarme del lanzamiento y acceso a la app.":
        "I accept the privacy policy and authorize Trazza to contact me about the launch and app access.",
      "Acepta la política de privacidad para unirte a la waitlist.": "Accept the privacy policy to join the waitlist.",
      "Acepto la": "I accept the",
      "polÃ­tica de privacidad": "privacy policy",
      "política de privacidad": "privacy policy",
      "y autorizo a Trazza a escribirme para avisarme del lanzamiento y acceso a la app.":
        "and authorize Trazza to contact me about the launch and app access.",
      "Aviso legal": "Legal notice",
      "Privacidad": "Privacy",
      "Cookies": "Cookies",
      "Términos": "Terms",
      "Terminos": "Terms",
      "Enlaces legales": "Legal links",
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
      "Tema": "Theme",

      "Workspace de trading": "Trading workspace",
      "Tu centro de control de trading": "Your trading control center",
      "Journal, finanzas y métricas sincronizadas en un solo panel.":
        "Journal, finance and metrics synced in one dashboard.",
      "Journal, prop firms y métricas sincronizadas en un solo panel.":
        "Journal, finance and metrics synced in one dashboard.",
      "Dashboard del journal": "Journal dashboard",
      "Dashboard real de Trazza": "Real Trazza dashboard",
      "Dashboard real de Trazza en modo claro": "Real Trazza dashboard in light mode",
      "Winrate": "Winrate",
      "Profit factor": "Profit factor",
      "Vista previa de Trazza": "Trazza preview",
      "Al entrar aceptas los términos y la política de privacidad. Trazza es una herramienta de registro y análisis, no asesoramiento financiero.":
        "By signing in you accept the terms and privacy policy. Trazza is a logging and analytics tool, not financial advice.",
      "Al entrar o crear una cuenta aceptas los términos y la política de privacidad. Trazza es una herramienta de registro y análisis, no asesoramiento financiero.":
        "By signing in or creating an account, you accept the terms and privacy policy. Trazza is a logging and analytics tool, not financial advice.",
      "Al entrar aceptas los": "By signing in you accept the",
      "Al entrar o crear una cuenta aceptas los": "By signing in or creating an account, you accept the",
      "Al continuar aceptas los": "By continuing you accept the",
      "tÃ©rminos": "terms",
      "términos": "terms",
      "y la": "and the",
      ". Trazza es una herramienta de registro y anÃ¡lisis, no asesoramiento financiero.":
        ". Trazza is a logging and analytics tool, not financial advice.",
      ". Trazza es una herramienta de registro y análisis, no asesoramiento financiero.":
        ". Trazza is a logging and analytics tool, not financial advice.",
      "¿Quieres empezar con Trazza?": "Want to start with Trazza?",
      "Accede para sincronizar tus finanzas, cuentas, movimientos y journal.":
        "Sign in to sync your finance data, accounts, movements and journal.",
      "Accede para sincronizar tus firms, cuentas, movimientos y journal.":
        "Sign in to sync your finance data, accounts, movements and journal.",
      "Nombre y apellidos": "Full name",
      "Password": "Password",
      "Contraseña": "Password",
      "Minimo 6 caracteres": "Minimum 6 characters",
      "Entrar": "Sign in",
      "Iniciar sesiÃ³n": "Sign in",
      "Iniciar sesión": "Sign in",
      "Crear cuenta": "Create account",
      "Crear cuenta gratis": "Create free account",
      "Crea tu cuenta gratis": "Create your free account",
      "Empieza gratis y guarda tus cuentas, movimientos y journal en la nube.":
        "Start for free and save your accounts, movements and journal in the cloud.",
      "No tienes cuenta?": "Do not have an account?",
      "¿No tienes cuenta?": "Do not have an account?",
      "Acceso privado por invitación": "Private invitation access",
      "Solicitar acceso": "Request access",
      "Ya tienes cuenta?": "Already have an account?",
      "¿Ya tienes cuenta?": "Already have an account?",
      "El registro está cerrado. Únete a la waitlist en la página principal.":
        "Registration is closed. Join the waitlist on the main page.",
      "El registro está cerrado. Pide acceso por invitación.":
        "Registration is closed. Request invitation access.",
      "Crea tu acceso para guardar tus datos en la nube.": "Create your access to save your data in the cloud.",
      "Comprobando sesion...": "Checking session...",
      "Entrando...": "Signing in...",
      "Creando cuenta...": "Creating account...",
      "Cuenta creada. Revisa tu email para confirmar el acceso.":
        "Account created. Check your email to confirm access.",
      "Cuenta creada. Entrando...": "Account created. Signing in...",
      "No se pudo iniciar la app. Recarga la pagina.": "The app could not start. Reload the page.",
      "No se pudo cargar Supabase. Revisa tu conexion.": "Supabase could not be loaded. Check your connection.",
      "Introduce tu nombre para crear el acceso.": "Enter your name to create access.",
      "La contraseña debe tener al menos 6 caracteres.": "Password must be at least 6 characters.",
      "Email o contraseña incorrectos.": "Email or password is incorrect.",
      "Confirma tu email antes de entrar.": "Confirm your email before signing in.",
      "Confirma tu email antes de entrar. Revisa tu bandeja de entrada.":
        "Confirm your email before signing in. Check your inbox.",
      "Ya existe una cuenta con este email. Entra con tu contraseña.":
        "An account already exists with this email. Sign in with your password.",
      "El registro no está habilitado en Supabase.": "Signups are not enabled in Supabase.",
      "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.":
        "Too many attempts in a row. Wait a few minutes and try again.",
      "No se pudo comprobar la sesión. Vuelve a entrar.": "The session could not be verified. Sign in again.",
      "No se pudo completar el acceso.": "The access request could not be completed.",

      "Areas principales": "Main areas",
      "Menu del area activa": "Active area menu",
      "Contraer menu": "Collapse menu",
      "Expandir menu": "Expand menu",
      "Finanzas": "Finance",
      "Prop Firm Tracker": "Finance",
      "Journal": "Journal",
      "Panel": "Dashboard",
      "Dashboard": "Dashboard",
      "Journal - Entradas": "Journal - Entries",
      "Journal - Dashboard": "Journal - Dashboard",
      "Empresas": "Firms",
      "Firms": "Firms",
      "Cuentas": "Accounts",
      "Movimientos": "Movements",
      "Entradas": "Entries",
      "Usuario": "User",
      "Usuario Trazza": "Trazza user",
      "Abrir perfil": "Open profile",
      "Perfil y datos": "Profile and data",
      "Datos guardados": "Saved data",
      "ID de usuario": "User ID",
      "Alta": "Joined",
      "Nombre visible": "Display name",
      "Tu nombre": "Your name",
      "Divisa": "Currency",
      "EUR (€)": "EUR (€)",
      "USD ($)": "USD ($)",
      "Guardar cambios": "Save changes",
      "Sin email": "No email",
      "Introduce un email valido.": "Enter a valid email.",
      "Perfil actualizado.": "Profile updated.",
      "Perfil actualizado. Revisa tu email si Supabase requiere confirmacion.":
        "Profile updated. Check your email if Supabase requires confirmation.",
      "No se pudo actualizar el perfil.": "Could not update the profile.",
      "Backup JSON": "JSON backup",
      "Migración de datos": "Data migration",
      "Usa el JSON para mover todos tus datos a otra cuenta. El CSV solo exporta movimientos para consulta.":
        "Use the JSON file to move all your data to another account. The CSV only exports movements for reference.",
      "Descargar JSON": "Download JSON",
      "Exportar CSV": "Export CSV",
      "Importar JSON": "Import JSON",
      "CSV movimientos": "Movements CSV",
      "Subir datos locales": "Upload local data",
      "Importar copia": "Import backup",
      "La importación JSON sustituirá los datos actuales de esta cuenta. Descarga una copia antes si quieres conservarlos.":
        "The JSON import will replace the current data in this account. Download a backup first if you want to keep it.",
      "JSON exportado.": "JSON exported.",
      "Datos importados.": "Data imported.",
      "No se pudieron importar los datos.": "The data could not be imported.",
      "El archivo no es valido.": "The file is not valid.",
      "Sincronizando datos...": "Syncing data...",
      "Datos sincronizados.": "Data synced.",
      "Sin conexión con Supabase. Usando datos locales.": "No Supabase connection. Using local data.",
      "No se pudo sincronizar con Supabase.": "Could not sync with Supabase.",
      "Nuevo": "New",
      "Nueva": "New",
      "Salir": "Log out",
      "Cerrar sesión": "Log out",
      "Cerrar sesiÃ³n": "Log out",
      "Ocultar datos del dashboard": "Hide dashboard data",
      "Mostrar datos del dashboard": "Show dashboard data",
      "Ocultar datos": "Hide data",
      "Mostrar datos": "Show data",
      "Cambiar a modo oscuro": "Switch to dark mode",
      "Cambiar a modo claro": "Switch to light mode",
      "Cambiar tema": "Change theme",
      "Modo oscuro": "Dark mode",
      "Modo claro": "Light mode",

      "Empresa": "Firm",
      "Empresa / origen": "Firm / source",
      "Firm": "Firm",
      "Firm / origen": "Firm / source",
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
      "Payout solicitado": "Requested payout",
      "Profit split": "Profit split",
      "Recibes en Finanzas": "You receive in Finances",
      "Se descuenta de la cuenta": "Deducted from the account",
      "Payouts": "Payouts",
      "bruto": "gross",
      "El payout solicitado debe ser mayor que 0.": "The requested payout must be greater than 0.",
      "El profit split debe estar entre 1% y 100%.": "The profit split must be between 1% and 100%.",
      "Ejecuta supabase-payouts.sql en Supabase para guardar payouts con profit split.":
        "Run supabase-payouts.sql in Supabase to save payouts with profit split.",
      "Acciones": "Actions",
      "Nombre": "Name",
      "Notas": "Notes",
      "Nueva empresa": "New firm",
      "Editar empresa": "Edit firm",
      "Nueva firm": "New firm",
      "Editar firm": "Edit firm",
      "Nueva cuenta": "New account",
      "Editar cuenta": "Edit account",
      "Nuevo movimiento": "New movement",
      "Editar movimiento": "Edit movement",
      "Nueva entrada": "New entry",
      "Editar entrada": "Edit entry",
      "¿Cómo quieres crear la entrada?": "How do you want to create the entry?",
      "Elige si quieres rellenarla a mano o traer datos desde un CSV compatible.":
        "Choose whether to fill it manually or bring data from a compatible CSV.",
      "Información sobre el proceso": "Process information",
      "Manual: rellenas todos los campos a mano. CSV: Trazza intenta rellenar fecha, activo, dirección, P&L y cuenta automáticamente. Notas, errores y captura quedan vacíos; disciplina se deja en 3 por defecto.":
        "Manual: you fill every field yourself. CSV: Trazza tries to fill date, asset, direction, P&L and account automatically. Notes, mistakes and screenshot stay empty; discipline is set to 3 by default.",
      "Manual": "Manual",
      "Rellenar formulario a mano.": "Fill the form manually.",
      "Importar CSV": "Import CSV",
      "Rellenar desde Tradovate Performance.": "Fill from Tradovate Performance.",
      "Importar CSV de Tradovate": "Import Tradovate CSV",
      "Selecciona la cuenta de Trazza y sube el CSV exportado desde Performance.":
        "Select the Trazza account and upload the CSV exported from Performance.",
      "Archivo CSV": "CSV file",
      "Notas, errores y capturas quedan vacíos; disciplina se deja en 3 por defecto. Podrás completarlo después desde cada entrada.":
        "Notes, mistakes and screenshots stay empty; discipline is set to 3 by default. You can complete it later from each entry.",
      "Analizar CSV": "Analyze CSV",
      "Volver": "Back",
      "Vista previa de importación": "Import preview",
      "Revisa las operaciones detectadas antes de crearlas en el journal.":
        "Review the detected trades before creating them in the journal.",
      "Crear entradas": "Create entries",
      "Crear entrada": "Create entry",
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
      "Otro / gasto general": "Other / general expense",
      "Gasto general": "General expense",
      "Retiro / ingreso": "Withdrawal / income",
      "Nombre, tamaño...": "Name, size...",
      "Nombre, tamaÃ±o...": "Name, size...",
      "Objetivo, drawdown, payout rules...": "Goal, drawdown, payout rules...",
      "Detalle del pago o retiro": "Payment or withdrawal details",

      "Trading overview": "Trading overview",
      "Balance total": "Total balance",
      "Net P&L": "Net P&L",
      "Beneficio": "Return",
      "Opcional": "Optional",
      "Target fase": "Phase target",
      "Drawdown máx.": "Max drawdown",
      "Drawdown max.": "Max drawdown",
      "Drawdown máx. EOD": "Max EOD drawdown",
      "Drawdown max. EOD": "Max EOD drawdown",
      "Drawdown diario": "Daily drawdown",
      "Sin target configurado.": "No target configured.",
      "Sin drawdown máximo.": "No max drawdown.",
      "Sin limite diario.": "No daily limit.",
      "Sin límite diario.": "No daily limit.",
      "Sin target": "No target",
      "DD máx.": "Max DD",
      "DD max.": "Max DD",
      "EOD máx.": "Max EOD",
      "EOD max.": "Max EOD",
      "DD diario": "Daily DD",
      "Sin DD máx.": "No max DD",
      "Sin DD max.": "No max DD",
      "Sin DD diario": "No daily DD",
      "Target conseguido": "Target reached",
      "Quedan": "Remaining",
      "Añade target de fase en la cuenta.": "Add a phase target to the account.",
      "Anade target de fase en la cuenta.": "Add a phase target to the account.",
      "Sin drawdown máximo configurado.": "No max drawdown configured.",
      "Sin drawdown maximo configurado.": "No max drawdown configured.",
      "Esta cuenta no tiene límite diario.": "This account has no daily limit.",
      "Esta cuenta no tiene limite diario.": "This account has no daily limit.",
      "Límite superado": "Limit exceeded",
      "Limite superado": "Limit exceeded",
      "Límite actual": "Current limit",
      "Limite actual": "Current limit",
      "Balance": "Balance",
      "Resultado acumulado del journal.": "Accumulated journal result.",
      "Resultado acumulado del journal. Muestra la evolución del P&L total a lo largo del tiempo.":
        "Accumulated journal result. Shows total P&L evolution over time.",
      "Grafico interactivo de P&L total del journal": "Interactive total journal P&L chart",
      "Gráfico interactivo de P&L total del journal": "Interactive total journal P&L chart",
      "Sin P&L": "No P&L",
      "Winrate": "Winrate",
      "Aciertos, empate y pérdidas": "Wins, breakeven and losses",
      "Profit factor": "Profit factor",
      "Relacion entre ganancias y perdidas": "Profit and loss ratio",
      "Relación entre ganancias y pérdidas": "Profit and loss ratio",
      "Ratio entre ganancias totales y pérdidas totales. Un valor >1 significa que ganas más de lo que pierdes.":
        "Ratio between total profits and total losses. A value above 1 means you win more than you lose.",
      "Sin perdidas registradas": "No losses registered",
      "Sin pérdidas registradas": "No losses registered",
      "Ganancias / perdidas": "Profits / losses",
      "Ganancias / pérdidas": "Profits / losses",
      "Avg win / loss": "Avg win / loss",
      "Avg win": "Avg win",
      "Avg loss": "Avg loss",
      "Promedio de ganancia y perdida": "Average win and loss",
      "Promedio de ganancia y pérdida": "Average win and loss",
      "Promedio de ganancia en trades ganadores vs. promedio de pérdida en trades perdedores.":
        "Average win on winning trades vs. average loss on losing trades.",
      "Promedio por trade cerrado": "Average per closed trade",
      "Winrate por dia": "Winrate by day",
      "Winrate por día": "Winrate by day",
      "Winrate por dÃ­a": "Winrate by day",
      "Winrate medio por día de la semana. Útil para detectar en qué días operas mejor.":
        "Average winrate by weekday. Useful for spotting which days you trade best.",
      "Media por dia de la semana.": "Average by weekday.",
      "Media por dÃ­a de la semana.": "Average by weekday.",
      "Winrate por sesion": "Winrate by session",
      "Winrate por sesión": "Winrate by session",
      "Winrate por sesiÃ³n": "Winrate by session",
      "Winrate desglosado por sesión de mercado: Asia, Londres, Nueva York y otras.":
        "Winrate split by market session: Asia, London, New York and others.",
      "Londres, Nueva York y otras sesiones.": "London, New York and other sessions.",
      "Sin sesiones registradas.": "No sessions registered.",
      "Ultimos trades": "Latest trades",
      "Últimos trades": "Latest trades",
      "Resumen rapido de las entradas mas recientes.": "Quick summary of the most recent entries.",
      "Resumen rápido de las entradas más recientes del journal.": "Quick summary of the most recent journal entries.",
      "Sin trades recientes.": "No recent trades.",
      "Sin trades cerrados": "No closed trades",
      "trade cerrado": "closed trade",
      "trades cerrados": "closed trades",
      "Errores": "Mistakes",
      "errores": "mistakes",
      "error": "mistake",
      "Distribucion de errores registrados.": "Registered mistake distribution.",
      "Distribución de errores registrados.": "Registered mistake distribution.",
      "Distribución de errores registrados en tus operaciones. Identifica qué errores cometes con más frecuencia.":
        "Distribution of mistakes registered in your trades. Identify which mistakes happen most often.",
      "Disciplina": "Discipline",
      "Evolucion de disciplina en el tiempo.": "Discipline evolution over time.",
      "Evolución de disciplina en el tiempo.": "Discipline evolution over time.",
      "Evolución de tu nota de disciplina en el tiempo. Una tendencia ascendente indica mejora en el seguimiento de tu plan.":
        "Evolution of your discipline score over time. An upward trend shows better plan execution.",
      "Mayo de 2026": "May 2026",
      "Month total": "Month total",
      "Hoy": "Today",
      "Semana": "Week",
      "SEMANA": "WEEK",
      "Mes anterior": "Previous month",
      "Mes siguiente": "Next month",
      "Quitar dia": "Clear day",
      "Quitar día": "Clear day",
      "Buscar": "Search",
      "Activo, dirección, notas...": "Asset, direction, notes...",
      "Activo, direccion, notas...": "Asset, direction, notes...",
      "Operaciones, decisiones y notas": "Trades, decisions and notes",
      "P&L, disciplina, errores y calendario": "P&L, discipline, mistakes and calendar",
      "Inicio": "Start",
      "Fin": "End",
      "Sin fecha": "No date",
      "Dia seleccionado": "Selected day",
      "Día seleccionado": "Selected day",
      "P&L total": "Total P&L",
      "P&L dia": "Daily P&L",
      "P&L día": "Daily P&L",
      "Neto dia": "Daily net",
      "Neto día": "Daily net",
      "Veces": "Times",
      "Peso": "Weight",
      "Entradas": "Entries",
      "Personalizar panel": "Customize dashboard",
      "KPIs (Winrate, Profit Factor…)": "KPIs (Winrate, Profit Factor…)",
      "Balance / P&L": "Balance / P&L",
      "Calendario P&L": "P&L calendar",
      "Ocultar": "Hide",
      "Mostrar": "Show",

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
      "Sesión": "Session",
      "SesiÃ³n": "Session",
      "Sesion": "Session",
      "Sin sesión": "No session",
      "Sin sesiÃ³n": "No session",
      "Sin sesion": "No session",
      "Londres": "London",
      "Nueva York": "New York",
      "Londres + NY": "London + NY",
      "Otra": "Other",
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
      "Sin cuenta": "No account",
      "Sin empresa": "No firm",
      "Sin firm": "No firm",
      "Movimientos sin cuenta concreta": "Movements without a specific account",
      "Crea una empresa primero": "Create a firm first",
      "Crea una firm primero": "Create a firm first",
      "Crea una cuenta primero": "Create an account first",
      "No hay empresas registradas.": "No firms registered.",
      "No hay firms registradas.": "No firms registered.",
      "No hay cuentas registradas.": "No accounts registered.",
      "No hay movimientos registrados.": "No movements registered.",
      "No hay entradas registradas.": "No entries registered.",
      "No hay errores configurados.": "No mistakes configured.",
      "Primero crea una empresa": "Create a firm first",
      "Primero crea una firm": "Create a firm first",
      "Todavia no hay empresas": "No firms yet",
      "Todavía no hay empresas": "No firms yet",
      "Todavia no hay firms": "No firms yet",
      "Todavía no hay firms": "No firms yet",
      "Todavia no hay cuentas": "No accounts yet",
      "Todavía no hay cuentas": "No accounts yet",
      "Todavia no hay movimientos": "No movements yet",
      "Todavía no hay movimientos": "No movements yet",
      "Todavia no hay entradas": "No entries yet",
      "Todavía no hay entradas": "No entries yet",
      "Registra compras, resets, fees o payouts para alimentar el dashboard.":
        "Register purchases, resets, fees or payouts to feed the dashboard.",
      "Registra operaciones, decisiones y notas sin mezclarlo con los movimientos economicos.":
        "Log trades, decisions and notes without mixing them with financial movements.",
      "Crea una empresa antes de añadir cuentas.": "Create a firm before adding accounts.",
      "Crea una empresa antes de añadir entradas al journal.": "Create a firm before adding journal entries.",
      "Crea tu primera empresa para empezar a organizar cuentas, compras y payouts.":
        "Create your first firm to start organizing accounts, purchases and payouts.",
      "Las cuentas necesitan una empresa asociada para que el dashboard pueda agrupar los resultados.":
        "Accounts need an associated firm so the dashboard can group results.",
      "Prueba con otra empresa, otro estado o limpia la busqueda.":
        "Try another firm, another status or clear the search.",
      "Prueba con otra firm, otro estado o limpia la busqueda.":
        "Try another firm, another status or clear the search.",
      "Ajusta la empresa, el tipo, las fechas o la busqueda para ver mas resultados.":
        "Adjust the firm, type, dates or search to see more results.",
      "El journal se organiza por empresa para que puedas revisar cada etapa con contexto.":
        "The journal is organized by firm so you can review each stage with context.",
      "Ajusta la cuenta, el periodo o la busqueda para ver mas resultados.":
        "Adjust the account, period or search to see more results.",
      "Sin entradas con P&L registrado.": "No entries with registered P&L.",
      "Sin entradas con disciplina.": "No entries with discipline.",
      "Sin errores registrados.": "No mistakes registered.",
      "Añade errores desde el dashboard para marcarlos aqui.": "Add mistakes from the dashboard to select them here.",
      "Añade errores desde el dashboard para marcarlos aquí.": "Add mistakes from the dashboard to select them here.",
      "Empresa guardada.": "Firm saved.",
      "Empresa eliminada.": "Firm deleted.",
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
      "No se pudo guardar la empresa.": "The firm could not be saved.",
      "No se pudo guardar la firm.": "The firm could not be saved.",
      "No se pudo guardar la cuenta.": "The account could not be saved.",
      "No se pudo guardar el movimiento.": "The movement could not be saved.",
      "No se pudo guardar la entrada.": "The entry could not be saved.",
      "No se pudo guardar el error.": "The mistake could not be saved.",
      "No se pudo eliminar la empresa.": "The firm could not be deleted.",
      "No se pudo eliminar la firm.": "The firm could not be deleted.",
      "No se pudo eliminar la cuenta.": "The account could not be deleted.",
      "No se pudo eliminar el movimiento.": "The movement could not be deleted.",
      "No se pudo eliminar la entrada.": "The entry could not be deleted.",
      "Confirmar": "Confirm",
      "Confirmar acción": "Confirm action",
      "Esta acción no se puede deshacer.": "This action cannot be undone.",
      "Eliminar empresa": "Delete firm",
      "Eliminar esta empresa?": "Delete this firm?",
      "Eliminar firm": "Delete firm",
      "Eliminar cuenta": "Delete account",
      "Eliminar movimiento": "Delete movement",
      "Eliminar entrada": "Delete entry",
      "Eliminar esta entrada de journal?": "Delete this journal entry?",
      "No puedes eliminar una empresa con cuentas, movimientos o entradas de journal.":
        "You cannot delete a firm with accounts, movements or journal entries.",
      "No puedes eliminar una firm con cuentas, movimientos o entradas de journal.":
        "You cannot delete a firm with accounts, movements or journal entries.",
      "No puedes eliminar una cuenta con movimientos o entradas de journal.":
        "You cannot delete an account with movements or journal entries.",
      "Selecciona una empresa valida.": "Select a valid firm.",
      "Selecciona una firm valida.": "Select a valid firm.",
      "Pon un nombre para la empresa.": "Enter a firm name.",
      "El nombre de la empresa es demasiado corto.": "The firm name is too short.",
      "Selecciona un tipo de empresa valido.": "Select a valid firm type.",
      "Ya existe una empresa con ese nombre.": "A firm with that name already exists.",
      "Ya hay una cuenta con ese nombre en esta empresa.": "There is already an account with that name in this firm.",
      "Selecciona una cuenta valida.": "Select a valid account.",
      "Selecciona una sesion valida.": "Select a valid session.",
      "Selecciona una sesiÃ³n valida.": "Select a valid session.",
      "Selecciona una gravedad valida.": "Select a valid severity.",
      "Selecciona un archivo CSV.": "Select a CSV file.",
      "Crea una cuenta antes de importar un CSV.": "Create an account before importing a CSV.",
      "Crea una cuenta antes de importar CSV": "Create an account before importing CSV",
      "Importar entradas desde un CSV de Tradovate Performance": "Import entries from a Tradovate Performance CSV",
      "El CSV no contiene operaciones.": "The CSV does not contain trades.",
      "El CSV no parece ser un Performance CSV de Tradovate.": "The CSV does not look like a Tradovate Performance CSV.",
      "No se detectaron operaciones en el CSV.": "No trades were detected in the CSV.",
      "El CSV contiene fechas invalidas o futuras.": "The CSV contains invalid or future dates.",
      "No se pudo leer el CSV.": "The CSV could not be read.",
      "CSV detectado: 1 entrada rellenada. Revisa y guarda.":
        "CSV detected: 1 entry filled. Review and save.",
      "No hay entradas para importar.": "There are no entries to import.",
      "No se pudieron importar las entradas.": "The entries could not be imported.",
      "Entrada importada.": "Entry imported.",
      "La cuenta seleccionada no pertenece a esa empresa.": "The selected account does not belong to that firm.",
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
      "Pega o arrastra una imagen valida.": "Paste or drag a valid image.",
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
    [/^(\d+) entradas importadas\.$/i, "$1 entries imported."],
    [/^Crear (\d+) entradas$/i, "Create $1 entries"],
    [/^(\d+) operaciones detectadas$/i, "$1 trades detected"],
    [/^(\d+) filas agrupadas en (\d+) operaciones$/i, "$1 rows grouped into $2 trades"],
    [/^(\d+) filas agrupadas$/i, "$1 grouped rows"],
    [/^1 fila$/i, "1 row"],
    [/^(\d+) contratos$/i, "$1 contracts"],
    [/^1 contrato$/i, "1 contract"],
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
    [/^Sin empresas con esos filtros$/i, "No firms with those filters"],
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
    if (!node[ORIGINAL_TEXT_KEY]) {
      node[ORIGINAL_TEXT_KEY] = node.nodeValue;
    } else {
      const current = normalize(node.nodeValue);
      const original = normalize(node[ORIGINAL_TEXT_KEY]);
      const translated = normalize(translateText(node[ORIGINAL_TEXT_KEY]));
      if (current && current !== original && current !== translated) {
        node[ORIGINAL_TEXT_KEY] = node.nodeValue;
      }
    }
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
    } else {
      const current = normalize(element.getAttribute(attribute));
      const original = normalize(element.getAttribute(originalAttribute));
      const translated = normalize(translateText(element.getAttribute(originalAttribute)));
      if (current && current !== original && current !== translated) {
        element.setAttribute(originalAttribute, element.getAttribute(attribute));
      }
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

    if (root === document.body || root === document.documentElement) {
      updateDocumentMeta(lang);
      updateToggles(lang);
    }

    walkText(root, lang);
    walkAttributes(root, lang);
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
