import { useMemo, useState } from "react";
import { AccountsView } from "./components/AccountsView";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./components/AuthScreen";
import { DashboardView } from "./components/DashboardView";
import { FirmsView } from "./components/FirmsView";
import { JournalEntriesView } from "./components/JournalEntriesView";
import { MovementsView } from "./components/MovementsView";
import { SettingsView } from "./components/SettingsView";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useTrazzaData } from "./hooks/useTrazzaData";
import { isSupabaseConfigured } from "./lib/supabase";
import { filterJournalByAccount, filterMovementsByAccount } from "./lib/metrics";
import type { NavigationView } from "./types";

export default function App() {
  const auth = useAuth();
  const themeState = useTheme();
  const [privacyHidden, setPrivacyHidden] = useState(false);
  const [activeView, setActiveView] = useState<NavigationView>("overview");
  const [createRequest, setCreateRequest] = useState<{
    id: number;
    target: "account" | "firm" | "journalEntry" | "movement";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const dataState = useTrazzaData(auth.user?.id, auth.status === "authenticated");
  const { accounts, firms, journalEntries, journalErrorTypes, movements } = dataState.data;
  const currency = auth.profile?.currency ?? "EUR";

  const visibleAccounts = useMemo(
    () => (selectedAccountId === "all" ? accounts : accounts.filter((account) => account.id === selectedAccountId)),
    [accounts, selectedAccountId],
  );
  const visibleMovements = useMemo(
    () => filterMovementsByAccount(movements, selectedAccountId),
    [movements, selectedAccountId],
  );
  const visibleJournalEntries = useMemo(
    () => filterJournalByAccount(journalEntries, selectedAccountId),
    [journalEntries, selectedAccountId],
  );

  if (auth.status === "checking") {
    return <LoadingScreen label="Comprobando sesion..." />;
  }

  if (auth.status === "anonymous") {
    return (
      <AuthScreen
        busy={auth.busy}
        message={auth.message}
        theme={themeState.theme}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onThemeToggle={() => themeState.setTheme(themeState.theme === "dark" ? "light" : "dark")}
      />
    );
  }

  return (
    <AppShell
      activeView={activeView}
      dataMode={dataState.mode}
      isSyncing={dataState.status === "loading"}
      privacyHidden={privacyHidden}
      profile={auth.profile}
      syncError={dataState.error}
      theme={themeState.theme}
      onPrimaryAction={() => {
        if (activeView === "firms") {
          setActiveView("firms");
          setCreateRequest((current) => ({ id: (current?.id || 0) + 1, target: "firm" }));
        } else if (activeView === "accounts") {
          setActiveView("accounts");
          setCreateRequest((current) => ({ id: (current?.id || 0) + 1, target: "account" }));
        } else if (activeView === "journalDashboard" || activeView === "journalEntries") {
          setActiveView("journalEntries");
          setCreateRequest((current) => ({ id: (current?.id || 0) + 1, target: "journalEntry" }));
        } else {
          setActiveView("movements");
          setCreateRequest((current) => ({ id: (current?.id || 0) + 1, target: "movement" }));
        }
      }}
      onPrivacyToggle={() => setPrivacyHidden((value) => !value)}
      onRefresh={() => void dataState.reload()}
      onSignOut={auth.status === "authenticated" ? () => void auth.signOut() : undefined}
      onThemeToggle={() => themeState.setTheme(themeState.theme === "dark" ? "light" : "dark")}
      onViewChange={setActiveView}
    >
      {auth.status === "unconfigured" && (
        <StateNotice
          tone="info"
          title="Supabase no esta configurado en React"
          text="La app nueva esta usando datos demo. Configura web/.env.local para activar login y datos reales."
        />
      )}
      {dataState.status === "loading" && (
        <StateNotice tone="info" title="Sincronizando" text="Cargando datos reales de Supabase." />
      )}
      {dataState.status === "error" && (
        <StateNotice
          tone="error"
          title="No se pudieron cargar los datos reales"
          text={`${dataState.error} Mientras tanto se muestran datos demo para mantener la interfaz navegable.`}
        />
      )}

      {activeView === "overview" && (
        <DashboardView
          accounts={accounts}
          currency={currency}
          firms={firms}
          journalEntries={journalEntries}
          movements={movements}
        />
      )}
      {activeView === "firms" && (
        <FirmsView
          accounts={accounts}
          dataMode={dataState.mode}
          firms={firms}
          newFirmToken={createRequest?.target === "firm" ? createRequest.id : 0}
          searchQuery={searchQuery}
          mutationError={dataState.mutationError}
          mutating={dataState.mutating}
          onDeleteFirm={dataState.deleteFirm}
          onNewFirmRequestHandled={() => setCreateRequest(null)}
          onSaveFirm={dataState.saveFirm}
        />
      )}
      {activeView === "accounts" && (
        <AccountsView
          accounts={visibleAccounts}
          currency={currency}
          dataMode={dataState.mode}
          firms={firms}
          journalEntries={journalEntries}
          movements={movements}
          newAccountToken={createRequest?.target === "account" ? createRequest.id : 0}
          searchQuery={searchQuery}
          mutationError={dataState.mutationError}
          mutating={dataState.mutating}
          onDeleteAccount={dataState.deleteAccount}
          onNewAccountRequestHandled={() => setCreateRequest(null)}
          onSaveAccount={dataState.saveAccount}
        />
      )}
      {activeView === "movements" && (
        <MovementsView
          accounts={accounts}
          currency={currency}
          dataMode={dataState.mode}
          firms={firms}
          movements={visibleMovements}
          newMovementToken={createRequest?.target === "movement" ? createRequest.id : 0}
          searchQuery={searchQuery}
          mutationError={dataState.mutationError}
          mutating={dataState.mutating}
          onDeleteMovement={dataState.deleteMovement}
          onNewMovementRequestHandled={() => setCreateRequest(null)}
          onSaveMovement={dataState.saveMovement}
        />
      )}
      {(activeView === "journalDashboard" || activeView === "journalEntries") && (
        <JournalEntriesView
          key={activeView}
          accounts={accounts}
          currency={currency}
          dataMode={dataState.mode}
          entries={visibleJournalEntries}
          firms={firms}
          initialMode={activeView === "journalEntries" ? "entries" : "cockpit"}
          journalErrorTypes={journalErrorTypes}
          newEntryToken={createRequest?.target === "journalEntry" ? createRequest.id : 0}
          searchQuery={searchQuery}
          selectedAccountId={selectedAccountId}
          mutationError={dataState.mutationError}
          mutating={dataState.mutating}
          onDeleteEntry={dataState.deleteJournalEntry}
          onNewEntryRequestHandled={() => setCreateRequest(null)}
          onSaveErrorType={dataState.saveJournalErrorType}
          onSaveEntry={dataState.saveJournalEntry}
          onSetErrorTypeActive={dataState.setJournalErrorTypeActive}
        />
      )}
      {activeView === "settings" && (
        <SettingsView
          busy={auth.busy}
          data={dataState.data}
          dataMode={dataState.mode}
          message={auth.message}
          mutationError={dataState.mutationError}
          mutating={dataState.mutating}
          profile={auth.profile}
          theme={themeState.theme}
          onImportData={dataState.importData}
          onThemeChange={themeState.setTheme}
          onUpdateProfile={auth.updateProfile}
        />
      )}
    </AppShell>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="loading-screen">
      <img src="/trazza.png" alt="Trazza" />
      <strong>{label}</strong>
    </main>
  );
}

function StateNotice({ text, title, tone }: { text: string; title: string; tone: "info" | "error" }) {
  return (
    <section className={`state-notice ${tone}`}>
      <strong>{title}</strong>
      <span>{text}</span>
      {!isSupabaseConfigured && <code>web/.env.local</code>}
    </section>
  );
}
