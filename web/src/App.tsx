import { useCallback, useMemo, useState } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { AccountsView } from "./components/AccountsView";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./components/AuthScreen";
import { DashboardView } from "./components/DashboardView";
import { FirmsView } from "./components/FirmsView";
import { JournalEntriesView } from "./components/JournalEntriesView";
import { MovementsView } from "./components/MovementsView";
import { PlansModal } from "./components/PlansModal";
import { SettingsView } from "./components/SettingsView";
import { useAuth } from "./hooks/useAuth";
import { useSubscription } from "./hooks/useSubscription";
import { useTheme } from "./hooks/useTheme";
import { useTrazzaData } from "./hooks/useTrazzaData";
import { useI18n, useT } from "./lib/i18n/context";
import { isSupabaseConfigured } from "./lib/supabase";
import { filterJournalByAccount, filterMovementsByAccount } from "./lib/metrics";
import type { NavigationView } from "./types";

export default function App() {
  const auth = useAuth();
  const themeState = useTheme();
  const t = useT();
  const [privacyHidden, setPrivacyHidden] = useState(false);
  const [activeView, setActiveView] = useState<NavigationView>("overview");
  const [createRequest, setCreateRequest] = useState<{
    id: number;
    target: "account" | "firm" | "journalEntry" | "movement";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const dataState = useTrazzaData(auth.user?.id, auth.status === "authenticated");
  const subscription = useSubscription(auth.user);
  const [plansOpen, setPlansOpen] = useState(false);
  const { accounts, firms, journalEntries, journalErrorTypes, movements } = dataState.data;
  const currency = auth.profile?.currency ?? "EUR";

  const { canMutateData } = subscription;

  /**
   * Paywall en un unico punto: en vez de repetir la comprobacion en cada vista, se
   * envuelven aqui las mutaciones. Si el acceso no esta activo se abre el selector de
   * planes en lugar de fallar en silencio. Todas devuelven Promise<boolean>, asi que la
   * firma se mantiene intacta para las vistas.
   */
  const guard = useCallback(
    <TArgs extends unknown[]>(action: (...args: TArgs) => Promise<boolean>) =>
      async (...args: TArgs): Promise<boolean> => {
        if (!canMutateData) {
          setPlansOpen(true);
          return false;
        }
        return action(...args);
      },
    [canMutateData],
  );

  const guarded = useMemo(
    () => ({
      deleteAccount: guard(dataState.deleteAccount),
      deleteFirm: guard(dataState.deleteFirm),
      deleteJournalEntry: guard(dataState.deleteJournalEntry),
      deleteMovement: guard(dataState.deleteMovement),
      saveAccount: guard(dataState.saveAccount),
      saveFirm: guard(dataState.saveFirm),
      saveJournalEntry: guard(dataState.saveJournalEntry),
      saveJournalErrorType: guard(dataState.saveJournalErrorType),
      saveMovement: guard(dataState.saveMovement),
      setJournalErrorTypeActive: guard(dataState.setJournalErrorTypeActive),
    }),
    [dataState, guard],
  );

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
    return <LoadingScreen label={t("app.checkingSession")} />;
  }

  if (auth.recoveryMode) {
    return (
      <ResetPasswordScreen
        busy={auth.busy}
        message={auth.message}
        theme={themeState.theme}
        onSubmit={auth.updatePassword}
        onThemeToggle={() => themeState.setTheme(themeState.theme === "dark" ? "light" : "dark")}
      />
    );
  }

  if (auth.status === "anonymous") {
    return (
      <AuthScreen
        busy={auth.busy}
        message={auth.message}
        theme={themeState.theme}
        onForgotPassword={auth.resetPassword}
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
          title={t("app.notice.unconfiguredTitle")}
          text={t("app.notice.unconfiguredText")}
        />
      )}
      {dataState.status === "loading" && (
        <StateNotice tone="info" title={t("app.notice.syncingTitle")} text={t("app.notice.syncingText")} />
      )}
      {dataState.status === "error" && (
        <StateNotice
          tone="error"
          title={t("app.notice.errorTitle")}
          text={`${dataState.error} ${t("app.notice.errorTextSuffix")}`}
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
          onDeleteFirm={guarded.deleteFirm}
          onNewFirmRequestHandled={() => setCreateRequest(null)}
          onSaveFirm={guarded.saveFirm}
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
          onDeleteAccount={guarded.deleteAccount}
          onNewAccountRequestHandled={() => setCreateRequest(null)}
          onSaveAccount={guarded.saveAccount}
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
          onDeleteMovement={guarded.deleteMovement}
          onNewMovementRequestHandled={() => setCreateRequest(null)}
          onSaveMovement={guarded.saveMovement}
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
          movements={visibleMovements}
          newEntryToken={createRequest?.target === "journalEntry" ? createRequest.id : 0}
          searchQuery={searchQuery}
          selectedAccountId={selectedAccountId}
          mutationError={dataState.mutationError}
          mutating={dataState.mutating}
          onDeleteEntry={guarded.deleteJournalEntry}
          onNewEntryRequestHandled={() => setCreateRequest(null)}
          onSaveErrorType={guarded.saveJournalErrorType}
          onSaveEntry={guarded.saveJournalEntry}
          onSetErrorTypeActive={guarded.setJournalErrorTypeActive}
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
          onDeleteAccount={auth.deleteAccount}
          onImportData={dataState.importData}
          onThemeChange={themeState.setTheme}
          onUpdateProfile={auth.updateProfile}
          subscription={subscription}
          onViewPlans={() => setPlansOpen(true)}
        />
      )}

      {plansOpen && (
        <PlansModal
          busy={subscription.busy}
          error={subscription.error}
          onClose={() => {
            setPlansOpen(false);
            subscription.clearError();
          }}
          onSelect={(interval) => void subscription.startCheckout(interval)}
        />
      )}
    </AppShell>
  );
}

function ResetPasswordScreen({
  busy,
  message,
  theme,
  onSubmit,
  onThemeToggle,
}: {
  busy: boolean;
  message?: { type: "info" | "success" | "error"; text: string } | null;
  theme: "dark" | "light";
  onSubmit: (password: string) => Promise<boolean>;
  onThemeToggle: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const t = useT();
  const { language, setLanguage } = useI18n();

  return (
    <main className="auth-screen">
      <div className="auth-top-actions">
        <button
          className="auth-theme-toggle"
          onClick={() => setLanguage(language === "es" ? "en" : "es")}
          title={t("appShell.topbar.language")}
          type="button"
        >
          <Languages size={17} strokeWidth={2.2} />
          <span>{language.toUpperCase()}</span>
        </button>
        <button className="auth-theme-toggle" onClick={onThemeToggle} title={t("appShell.topbar.theme")} type="button">
          {theme === "dark" ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
        </button>
      </div>

      <section className="auth-layout">
        <div className="auth-copy">
          <img className="auth-logo" src="/trazza.png" alt="Trazza" />
          <p className="auth-kicker">{t("auth.kicker")}</p>
          <h1>{t("auth.reset.title")}</h1>
          <p>{t("auth.reset.subtitle")}</p>
        </div>

        <section className="auth-card" aria-label={t("auth.reset.newPassword")}>
          <div className="auth-heading">
            <span>{t("auth.reset.badge")}</span>
            <h2>{t("auth.reset.heading")}</h2>
            <p>{t("auth.reset.copy")}</p>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              if (password !== confirmPassword) {
                setValidationError(t("auth.reset.mismatch"));
                return;
              }
              setValidationError(null);
              void onSubmit(password);
            }}
          >
            <label>
              <span>{t("auth.reset.newPassword")}</span>
              <div className="auth-field">
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("auth.field.passwordPlaceholder")}
                  required
                  type="password"
                  value={password}
                />
              </div>
            </label>
            <label>
              <span>{t("auth.reset.confirmPassword")}</span>
              <div className="auth-field">
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t("auth.reset.confirmPlaceholder")}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </div>
            </label>

            {validationError && <p className="auth-message error">{validationError}</p>}
            {message && <p className={`auth-message ${message.type}`}>{message.text}</p>}

            <button className="primary-action" disabled={busy} type="submit">
              {busy ? t("auth.reset.saving") : t("auth.reset.save")}
            </button>
          </form>
        </section>
      </section>
    </main>
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
