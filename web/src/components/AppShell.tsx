import {
  BarChart3,
  BookOpenText,
  Building2,
  CircleDollarSign,
  Eye,
  EyeOff,
  LayoutDashboard,
  Languages,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  WalletCards,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useI18n, useT } from "../lib/i18n/context";
import type { DataMode, NavigationView, UserProfile } from "../types";
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
  ];
}

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

  return (
    <div className="app-shell" data-privacy={privacyHidden ? "hidden" : "visible"} data-sidebar={collapsed ? "collapsed" : "expanded"} data-view={activeView}>
      <aside className="sidebar">
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
                <button className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => onViewChange(item.id)} type="button">
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
                <button className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => onViewChange(item.id)} type="button">
                  <Icon size={18} strokeWidth={2.15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <button className="user-card" onClick={() => onViewChange("settings")} type="button">
          <span>{(profile?.displayName || "T").charAt(0).toUpperCase()}</span>
          <span>
            <strong>{profile?.displayName || t("appShell.sidebar.defaultUser")}</strong>
            <small>{profile?.email || statusLabel}</small>
          </span>
          <Settings size={17} strokeWidth={2.2} />
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
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

          <div className="topbar-actions">
            {/* En movil el <span> de este boton y el de Salir se ocultan y queda solo el
                icono, asi que el nombre tiene que vivir tambien en un aria-label. */}
            {activeView !== "settings" && (
              <button aria-label={activeCopy.primary} className="primary-action topbar-primary" onClick={onPrimaryAction} type="button">
                <Plus size={17} strokeWidth={2.3} />
                <span>{activeCopy.primary}</span>
              </button>
            )}
            <button className="theme-toggle" onClick={onPrivacyToggle} title={privacyHidden ? t("appShell.topbar.showData") : t("appShell.topbar.hideData")} type="button">
              {privacyHidden ? <EyeOff size={17} strokeWidth={2.2} /> : <Eye size={17} strokeWidth={2.2} />}
            </button>
            <button className="theme-toggle" onClick={onThemeToggle} title={t("appShell.topbar.theme")} type="button">
              {theme === "dark" ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
            </button>
            <button
              className="theme-toggle language-toggle"
              onClick={() => setLanguage(language === "es" ? "en" : "es")}
              title={t("appShell.topbar.language")}
              type="button"
            >
              <Languages size={17} strokeWidth={2.2} />
              <span>{language.toUpperCase()}</span>
            </button>
            {onRefresh && (
              <button className="theme-toggle" disabled={isSyncing} onClick={onRefresh} title={t("appShell.topbar.sync")} type="button">
                <RefreshCw size={17} strokeWidth={2.2} />
              </button>
            )}
            {onSignOut && (
              <button aria-label={t("appShell.topbar.signOut")} className="secondary-action topbar-exit" onClick={onSignOut} type="button">
                <LogOut size={16} strokeWidth={2.2} />
                <span>{t("appShell.topbar.signOut")}</span>
              </button>
            )}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
