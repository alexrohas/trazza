import {
  BarChart3,
  BookOpenText,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Eye,
  EyeOff,
  LayoutDashboard,
  Languages,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n, useT } from "../lib/i18n/context";
import type { DataMode, NavigationView, UserProfile } from "../types";
import { TopbarMenu, type TopbarMenuItem } from "./TopbarMenu";
import { Wordmark } from "./Wordmark";

type AppShellProps = {
  activeView: NavigationView;
  dataMode: DataMode;
  isSyncing?: boolean;
  privacyHidden: boolean;
  profile?: UserProfile | null;
  syncError?: string | null;
  theme: "dark" | "light";
  onPrimaryAction?: () => void;
  onRefresh?: () => void;
  onSignOut?: () => void;
  onThemeToggle: () => void;
  onPrivacyToggle: () => void;
  onViewChange: (view: NavigationView) => void;
  children: ReactNode;
};

function getFinanceItems(t: ReturnType<typeof useT>) {
  return [
    { id: "overview" as const, label: t("appShell.nav.panel"), icon: LayoutDashboard },
    { id: "firms" as const, label: t("appShell.nav.firms"), icon: Building2 },
    { id: "accounts" as const, label: t("appShell.nav.accounts"), icon: WalletCards },
    { id: "movements" as const, label: t("appShell.nav.movements"), icon: CircleDollarSign },
  ];
}

function getJournalItems(t: ReturnType<typeof useT>) {
  return [
    { id: "journalDashboard" as const, label: t("appShell.nav.journalDashboard"), icon: BarChart3 },
    { id: "journalEntries" as const, label: t("appShell.nav.journalEntries"), icon: BookOpenText },
    { id: "economicEvents" as const, label: t("appShell.nav.economicEvents"), icon: CalendarClock },
  ];
}

/* Vistas sin boton de accion principal: no hay nada que crear en ellas. Ajustes tiene su
   propio guardar dentro, y el calendario economico es solo de consulta. */
const viewsWithoutPrimaryAction = new Set<NavigationView>(["settings", "economicEvents"]);

function getViewTitles(t: ReturnType<typeof useT>): Record<NavigationView, { eyebrow: string; primary: string; title: string }> {
  return {
    overview: { eyebrow: t("appShell.view.overview.eyebrow"), primary: t("appShell.view.overview.primary"), title: t("appShell.view.overview.title") },
    firms: { eyebrow: t("appShell.view.firms.eyebrow"), primary: t("appShell.view.firms.primary"), title: t("appShell.view.firms.title") },
    accounts: { eyebrow: t("appShell.view.accounts.eyebrow"), primary: t("appShell.view.accounts.primary"), title: t("appShell.view.accounts.title") },
    movements: { eyebrow: t("appShell.view.movements.eyebrow"), primary: t("appShell.view.movements.primary"), title: t("appShell.view.movements.title") },
    journalDashboard: {
      eyebrow: t("appShell.view.journalDashboard.eyebrow"),
      primary: t("appShell.view.journalDashboard.primary"),
      title: t("appShell.view.journalDashboard.title"),
    },
    journalEntries: {
      eyebrow: t("appShell.view.journalEntries.eyebrow"),
      primary: t("appShell.view.journalEntries.primary"),
      title: t("appShell.view.journalEntries.title"),
    },
    economicEvents: {
      eyebrow: t("appShell.view.economicEvents.eyebrow"),
      primary: t("appShell.view.economicEvents.primary"),
      title: t("appShell.view.economicEvents.title"),
    },
    settings: { eyebrow: t("appShell.view.settings.eyebrow"), primary: t("appShell.view.settings.primary"), title: t("appShell.view.settings.title") },
  };
}

export function AppShell({
  activeView,
  children,
  dataMode,
  isSyncing = false,
  onPrimaryAction,
  onPrivacyToggle,
  onRefresh,
  onSignOut,
  onThemeToggle,
  onViewChange,
  privacyHidden,
  profile,
  syncError,
  theme,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  /* En movil el riel lateral no cabe al lado del contenido, y apilado encima se comia la
     primera pantalla entera (538px de menu antes del primer dato). Pasa a ser un cajon
     sobre el contenido. El estado vive aqui y no en CSS porque hacen falta tres cosas que
     el CSS no da: cerrarlo al elegir destino, cerrarlo con Escape y bloquear el scroll del
     fondo mientras esta abierto. Que se vea o no lo sigue decidiendo el @media. */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  /* Elegir destino cierra el cajon. En escritorio no cambia nada (mobileNavOpen ya es
     false), asi que la navegacion no necesita saber en que tamano esta. */
  const goToView = useCallback(
    (view: NavigationView) => {
      setMobileNavOpen(false);
      onViewChange(view);
    },
    [onViewChange],
  );
  const t = useT();
  const { language, setLanguage } = useI18n();
  const financeItems = useMemo(() => getFinanceItems(t), [t]);
  const journalItems = useMemo(() => getJournalItems(t), [t]);
  const viewTitles = useMemo(() => getViewTitles(t), [t]);
  const activeCopy = viewTitles[activeView] || viewTitles.overview;
  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
        day: "2-digit",
        month: "long",
        weekday: "long",
        year: "numeric",
      }).format(new Date()),
    [language],
  );
  const statusLabel = syncError
    ? t("appShell.status.syncError")
    : isSyncing
      ? t("appShell.status.syncing")
      : dataMode === "cloud"
        ? t("appShell.status.cloud")
        : t("appShell.status.demo");

  /* Escape cierra el cajon, y mientras esta abierto el fondo no se desplaza: sin esto, al
     arrastrar sobre la capa oscura se mueve la pagina de detras y al cerrar apareces en
     otro sitio. */
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  /* Al ensanchar por encima del punto donde el cajon existe hay que soltarlo a mano. Si no,
     el estado se queda en "abierto": el @media devuelve el riel a su sitio y el cajon no se
     ve, pero el efecto de arriba sigue vivo y deja el body sin scroll en escritorio. El 820
     es el mismo numero que el @media, y tiene que seguir siendolo. */
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 821px)");
    const sync = () => {
      if (wide.matches) setMobileNavOpen(false);
    };
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  /* Los controles de segundo nivel de la barra superior. Antes eran cuatro iconos sueltos
     junto al boton principal y el de privacidad (seis en total, que no cabian bien);
     ahora se pliegan en el menu de TopbarMenu. El tema se saca de aqui otra vez a
     peticion expresa (boton propio junto al de privacidad, ver mas abajo) porque se usa
     mucho mas a menudo que idioma/sincronizar/salir como para vivir a dos clics.
     idioma es el unico toggle que queda aqui y deja el menu abierto; sincronizar y
     salir lo cierran al pulsarlos. */
  const menuItems = useMemo<TopbarMenuItem[]>(() => {
    const items: TopbarMenuItem[] = [
      {
        id: "language",
        label: t("appShell.topbar.language"),
        icon: Languages,
        trailing: language.toUpperCase(),
        onSelect: () => setLanguage(language === "es" ? "en" : "es"),
        keepOpen: true,
      },
    ];
    if (onRefresh) {
      items.push({
        id: "sync",
        label: t("appShell.topbar.sync"),
        icon: RefreshCw,
        onSelect: onRefresh,
        disabled: isSyncing,
      });
    }
    if (onSignOut) {
      items.push({
        id: "signOut",
        label: t("appShell.topbar.signOut"),
        icon: LogOut,
        onSelect: onSignOut,
      });
    }
    return items;
  }, [t, language, setLanguage, onRefresh, onSignOut, isSyncing]);

  return (
    <div
      className="app-shell"
      data-mobile-nav={mobileNavOpen ? "open" : "closed"}
      data-privacy={privacyHidden ? "hidden" : "visible"}
      data-sidebar={collapsed ? "collapsed" : "expanded"}
      data-view={activeView}
    >
      <aside className="sidebar" id="app-nav">
        <div className="brand">
          <Wordmark />
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? t("appShell.sidebar.expand") : t("appShell.sidebar.collapse")}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={17} strokeWidth={2.2} /> : <PanelLeftClose size={17} strokeWidth={2.2} />}
          </button>
          {/* Solo en movil. Contraer el riel no significa nada cuando el riel es un cajon
              que ya esta encima del contenido, asi que el @media cambia uno por otro en
              vez de sumar un tercer control a .brand. */}
          <button aria-label={t("appShell.sidebar.close")} className="nav-close" onClick={closeMobileNav} type="button">
            <X size={19} strokeWidth={2.2} />
          </button>
        </div>

        {/* El interruptor grande de arriba (Finanzas/Journal) y esta lista repetian el
            mismo dato: al estar en Finanzas, el boton activo decia "Finanzas" y justo
            debajo la seccion volvia a decir "FINANZAS". Se funden en uno: sin
            interruptor, los dos grupos se ven siempre (antes cambiar de area escondia
            el otro grupo entero), y el encabezado de cada grupo ya no es redundante
            porque es la unica vez que aparece ese nombre. */}
        <nav className="nav-list" aria-label={t("appShell.sidebar.menuLabel")}>
          <div className="nav-group">
            <p>{t("appShell.nav.finance")}</p>
            {financeItems.map((item) => {
              const Icon = item.icon;
              return (
                <button className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => goToView(item.id)} type="button">
                  <Icon size={18} strokeWidth={2.15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Solo se ve en modo contraido (icono a icono, sin encabezado que separe los
              dos grupos): una linea fina entre Finanzas y Journal para que la
              agrupacion se note aunque no haya texto. */}
          <hr className="nav-divider" aria-hidden="true" />

          <div className="nav-group">
            <p>{t("appShell.nav.journal")}</p>
            {journalItems.map((item) => {
              const Icon = item.icon;
              return (
                <button className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => goToView(item.id)} type="button">
                  <Icon size={18} strokeWidth={2.15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <button className="user-card" onClick={() => goToView("settings")} type="button">
          <span>{(profile?.displayName || "T").charAt(0).toUpperCase()}</span>
          <span>
            <strong>{profile?.displayName || t("appShell.sidebar.defaultUser")}</strong>
            <small>{profile?.email || statusLabel}</small>
          </span>
          <Settings size={17} strokeWidth={2.2} />
        </button>
      </aside>

      {/* Fuera de <aside> y sin portal: ningun ancestro lleva transform (ni .app-shell ni
          .workspace animan), asi que un position:fixed aqui mide la ventana. Si algun dia
          se le pone una animacion de entrada al armazon, esto y el cajon tendrian que
          irse a un portal, igual que los modales. */}
      <button aria-hidden="true" className="nav-backdrop" onClick={closeMobileNav} tabIndex={-1} type="button" />

      <main className="workspace">
        <header className="topbar">
          {/* .topbar-lead es display:contents en escritorio: la hamburguesa esta oculta y
              el bloque de titulo participa en el flex de .topbar tal cual, sin que cambie
              nada de lo ya ajustado. En movil pasa a ser una fila propia para que el boton
              y el titulo compartan linea aunque .topbar se apile. */}
          <div className="topbar-lead">
            <button
              aria-controls="app-nav"
              aria-expanded={mobileNavOpen}
              aria-label={t("appShell.sidebar.open")}
              className="nav-trigger"
              onClick={() => setMobileNavOpen(true)}
              type="button"
            >
              <Menu size={19} strokeWidth={2.2} />
            </button>
            <div>
              <p className="eyebrow">{currentDate}</p>
              <h1>{activeCopy.title}</h1>
              {(isSyncing || syncError || dataMode === "demo") && (
                <div className={`sync-status ${syncError ? "error" : ""}`}>
                  <span />
                  <small>{statusLabel}</small>
                </div>
              )}
            </div>
          </div>

          <div className="topbar-actions">
            {/* Mantiene la etiqueta visible; solo iguala la altura (38) a la de los
                controles de al lado, sin ser mas alto como antes. */}
            {!viewsWithoutPrimaryAction.has(activeView) && (
              <button aria-label={activeCopy.primary} className="primary-action topbar-primary" onClick={onPrimaryAction} type="button">
                <Plus size={17} strokeWidth={2.3} />
                <span>{activeCopy.primary}</span>
              </button>
            )}
            <button className="theme-toggle" onClick={onPrivacyToggle} title={privacyHidden ? t("appShell.topbar.showData") : t("appShell.topbar.hideData")} type="button">
              {privacyHidden ? <EyeOff size={17} strokeWidth={2.2} /> : <Eye size={17} strokeWidth={2.2} />}
            </button>
            {/* Fuera del menu de desbordamiento, a peticion expresa: se usa mas a menudo
                que idioma/sincronizar/salir como para vivir a dos clics de distancia. */}
            <button className="theme-toggle" onClick={onThemeToggle} title={t("appShell.topbar.theme")} type="button">
              {theme === "dark" ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
            </button>
            <TopbarMenu items={menuItems} label={t("appShell.topbar.more")} />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
