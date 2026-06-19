import {
  BarChart3,
  BookOpenText,
  Building2,
  CircleDollarSign,
  Eye,
  EyeOff,
  Landmark,
  LayoutDashboard,
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
import type { DataMode, NavigationView, UserProfile } from "../types";

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

const financeItems = [
  { id: "overview" as const, label: "Panel", icon: LayoutDashboard },
  { id: "firms" as const, label: "Empresas", icon: Building2 },
  { id: "accounts" as const, label: "Cuentas", icon: WalletCards },
  { id: "movements" as const, label: "Movimientos", icon: CircleDollarSign },
];

const journalItems = [
  { id: "journalDashboard" as const, label: "Dashboard", icon: BarChart3 },
  { id: "journalEntries" as const, label: "Entradas", icon: BookOpenText },
];

const viewTitles: Record<NavigationView, { eyebrow: string; primary: string; title: string }> = {
  overview: { eyebrow: "Finanzas", primary: "Nuevo movimiento", title: "Panel" },
  firms: { eyebrow: "Finanzas", primary: "Nueva empresa", title: "Empresas" },
  accounts: { eyebrow: "Finanzas", primary: "Nueva cuenta", title: "Cuentas" },
  movements: { eyebrow: "Finanzas", primary: "Nuevo movimiento", title: "Movimientos" },
  journalDashboard: { eyebrow: "Journal", primary: "Nueva entrada", title: "Journal - Dashboard" },
  journalEntries: { eyebrow: "Journal", primary: "Nueva entrada", title: "Journal - Entradas" },
  settings: { eyebrow: "Trazza", primary: "Guardar", title: "Ajustes" },
};

const financeViews = new Set<NavigationView>(["overview", "firms", "accounts", "movements"]);
const journalViews = new Set<NavigationView>(["journalDashboard", "journalEntries"]);

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
  const activeCopy = viewTitles[activeView] || viewTitles.overview;
  const activePillar = journalViews.has(activeView) ? "journal" : "finance";
  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "long",
        weekday: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );
  const statusLabel = syncError
    ? "No se pudo sincronizar"
    : isSyncing
      ? "Sincronizando datos..."
      : dataMode === "cloud"
        ? "Datos reales activos"
        : "Modo demo";

  return (
    <div className="app-shell" data-privacy={privacyHidden ? "hidden" : "visible"} data-sidebar={collapsed ? "collapsed" : "expanded"} data-view={activeView}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo-crop">
            <img src="/trazza.png" alt="Trazza" />
          </span>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expandir menu" : "Contraer menu"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={17} strokeWidth={2.2} /> : <PanelLeftClose size={17} strokeWidth={2.2} />}
          </button>
        </div>

        <div className="pillar-switch" aria-label="Areas principales">
          <button className={activePillar === "finance" ? "active" : ""} onClick={() => onViewChange("overview")} type="button">
            <Landmark size={18} strokeWidth={2.2} />
            <span>Finanzas</span>
          </button>
          <button className={activePillar === "journal" ? "active" : ""} onClick={() => onViewChange("journalDashboard")} type="button">
            <BookOpenText size={18} strokeWidth={2.2} />
            <span>Journal</span>
          </button>
        </div>

        <nav className="nav-list" aria-label="Menu del area activa">
          <div className={`nav-group ${financeViews.has(activeView) ? "active" : ""}`}>
            <p>Finanzas</p>
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

          <div className={`nav-group ${journalViews.has(activeView) ? "active" : ""}`}>
            <p>Journal</p>
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
            <strong>{profile?.displayName || "Usuario Trazza"}</strong>
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
            {activeView !== "settings" && (
              <button className="primary-action topbar-primary" onClick={onPrimaryAction} type="button">
                <Plus size={17} strokeWidth={2.3} />
                <span>{activeCopy.primary}</span>
              </button>
            )}
            <button className="theme-toggle" onClick={onPrivacyToggle} title={privacyHidden ? "Mostrar datos" : "Ocultar datos"} type="button">
              {privacyHidden ? <EyeOff size={17} strokeWidth={2.2} /> : <Eye size={17} strokeWidth={2.2} />}
            </button>
            <button className="theme-toggle" onClick={onThemeToggle} title="Cambiar tema" type="button">
              {theme === "dark" ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
            </button>
            {onRefresh && (
              <button className="theme-toggle" disabled={isSyncing} onClick={onRefresh} title="Sincronizar" type="button">
                <RefreshCw size={17} strokeWidth={2.2} />
              </button>
            )}
            {onSignOut && (
              <button className="secondary-action topbar-exit" onClick={onSignOut} type="button">
                <LogOut size={16} strokeWidth={2.2} />
                <span>Salir</span>
              </button>
            )}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
