import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Languages, Moon, Save, Sun, Trash2 } from "lucide-react";
import {
  findLocalMigrationSource,
  hasImportData,
  markLocalMigrationComplete,
  parseTrazzaImport,
  summarizeImportData,
  type LocalMigrationSource,
} from "../lib/legacyImport";
import { useI18n, useT } from "../lib/i18n/context";
import { SubscriptionPanel } from "./SubscriptionPanel";
import type { useSubscription } from "../hooks/useSubscription";
import type { AppData, Currency, DataMode, UserProfile, UserProfileInput } from "../types";

type SettingsViewProps = {
  data: AppData;
  dataMode: DataMode;
  busy: boolean;
  message?: { type: "info" | "success" | "error"; text: string } | null;
  mutationError?: string | null;
  mutating: boolean;
  profile: UserProfile | null;
  theme: "light" | "dark";
  onDeleteAccount: () => Promise<boolean>;
  onImportData: (data: AppData) => Promise<boolean>;
  onThemeChange: (theme: "light" | "dark") => void;
  onUpdateProfile: (input: UserProfileInput) => Promise<boolean>;
  onViewPlans: () => void;
  subscription: ReturnType<typeof useSubscription>;
};

export function SettingsView({
  busy,
  data,
  dataMode,
  message,
  mutationError,
  mutating,
  onDeleteAccount,
  onImportData,
  onThemeChange,
  onUpdateProfile,
  onViewPlans,
  profile,
  subscription,
  theme,
}: SettingsViewProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<UserProfileInput>({
    currency: profile?.currency ?? "EUR",
    displayName: profile?.displayName ?? "",
    email: profile?.email ?? "",
  });
  const [migrationMessage, setMigrationMessage] = useState<{ text: string; type: "error" | "info" | "success" } | null>(null);
  const [localMigrationSource, setLocalMigrationSource] = useState<LocalMigrationSource | null>(null);
  const t = useT();
  const { language, setLanguage } = useI18n();

  useEffect(() => {
    setDraft({
      currency: profile?.currency ?? "EUR",
      displayName: profile?.displayName ?? "",
      email: profile?.email ?? "",
    });
  }, [profile]);

  useEffect(() => {
    setLocalMigrationSource(findLocalMigrationSource());
  }, []);

  const canImport = dataMode === "cloud" && !busy && !mutating;

  const importParsedData = async (nextData: AppData, source?: LocalMigrationSource | null) => {
    if (!hasImportData(nextData)) {
      setMigrationMessage({ type: "error", text: "No se encontraron datos para importar." });
      return;
    }

    const currentHasData = hasImportData(data);
    const summary = summarizeImportData(nextData);
    if (
      currentHasData &&
      !window.confirm(`La migracion sustituira los datos actuales de Supabase por: ${summary}. Antes se descargara una copia JSON de seguridad.`)
    ) {
      return;
    }

    if (currentHasData) {
      exportJson(data, dataMode, `trazza-backup-before-migration-${new Date().toISOString().slice(0, 10)}.json`);
    }
    setMigrationMessage({ type: "info", text: `Importando ${summary}...` });
    const imported = await onImportData(nextData);
    if (!imported) return;

    if (source) {
      markLocalMigrationComplete(source);
      setLocalMigrationSource(null);
    }
    setMigrationMessage({ type: "success", text: `Migracion completada: ${summary}.` });
  };

  return (
    <div className="settings-grid">
      <SubscriptionPanel onViewPlans={onViewPlans} subscription={subscription} />

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("settings.profile.title")}</h2>
            <p>{t("settings.profile.subtitle")}</p>
          </div>
        </div>
        <form
          className="settings-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onUpdateProfile(draft);
          }}
        >
          <label>
            <span>{t("settings.profile.name")}</span>
            <input
              disabled={busy || !profile}
              minLength={2}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              type="text"
              value={draft.displayName}
            />
          </label>
          <label>
            <span>{t("settings.profile.email")}</span>
            <input
              disabled={busy || !profile}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              type="email"
              value={draft.email}
            />
          </label>
          <label>
            <span>{t("settings.profile.currency")}</span>
            <select
              disabled={busy || !profile}
              onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value as Currency }))}
              value={draft.currency}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          {message && <p className={`mutation-message ${message.type}`}>{message.text}</p>}
          <button className="primary-action" disabled={busy || !profile} type="submit">
            <Save size={17} strokeWidth={2.2} />
            {t("settings.profile.save")}
          </button>
        </form>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("settings.appearance.title")}</h2>
            <p>{t("settings.appearance.subtitle")}</p>
          </div>
        </div>
        <div className="segmented-control">
          <button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")} type="button">
            <Sun size={16} strokeWidth={2.2} />
            {t("settings.appearance.light")}
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")} type="button">
            <Moon size={16} strokeWidth={2.2} />
            {t("settings.appearance.dark")}
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("settings.language.title")}</h2>
            <p>{t("settings.language.subtitle")}</p>
          </div>
        </div>
        <div className="segmented-control">
          <button className={language === "es" ? "active" : ""} onClick={() => setLanguage("es")} type="button">
            <Languages size={16} strokeWidth={2.2} />
            {t("settings.language.es")}
          </button>
          <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} type="button">
            <Languages size={16} strokeWidth={2.2} />
            {t("settings.language.en")}
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("settings.export.title")}</h2>
            <p>{t("settings.export.subtitle")}</p>
          </div>
        </div>
        <div className="export-summary">
          <span>{data.firms.length} {t("settings.export.firms")}</span>
          <span>{data.accounts.length} {t("settings.export.accounts")}</span>
          <span>{data.movements.length} {t("settings.export.movements")}</span>
          <span>{data.journalEntries.length} {t("settings.export.entries")}</span>
          <span>{data.journalErrorTypes.length} {t("settings.export.errorTypes")}</span>
        </div>
        <button className="primary-action" onClick={() => exportJson(data, dataMode)} type="button">
          <Download size={17} strokeWidth={2.2} />
          {t("settings.export.button")}
        </button>
      </section>

      <section className="panel settings-panel migration-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("settings.migration.title")}</h2>
            <p>{t("settings.migration.subtitle")}</p>
          </div>
        </div>
        <div className="migration-actions">
          <button className="primary-action" disabled={!canImport} onClick={() => importInputRef.current?.click()} type="button">
            <FileUp size={17} strokeWidth={2.2} />
            {t("settings.migration.importJson")}
          </button>
          <input
            accept=".json,application/json"
            hidden
            ref={importInputRef}
            type="file"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const parsed = parseTrazzaImport(await file.text());
                await importParsedData(parsed);
              } catch (error) {
                const text = error instanceof Error ? error.message : "El archivo no es valido.";
                setMigrationMessage({ type: "error", text });
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button
            className="secondary-action"
            disabled={!canImport || !localMigrationSource}
            onClick={async () => {
              if (!localMigrationSource) return;
              await importParsedData(parseTrazzaImport(localMigrationSource.raw), localMigrationSource);
            }}
            type="button"
          >
            {t("settings.migration.uploadLocal")}
          </button>
        </div>
        <div className="migration-status">
          <span>{dataMode === "cloud" ? t("settings.migration.cloudConnected") : t("settings.migration.cloudDisconnected")}</span>
          <span>
            {localMigrationSource
              ? `Datos locales detectados en ${localMigrationSource.key}: ${localMigrationSource.summary}.`
              : t("settings.migration.noLocalData")}
          </span>
          <span>{t("settings.migration.replaceNotice")}</span>
        </div>
        {migrationMessage && <p className={`mutation-message ${migrationMessage.type}`}>{migrationMessage.text}</p>}
        {mutationError && <p className="mutation-message error">{mutationError}</p>}
      </section>

      <section className="panel settings-panel danger-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("settings.danger.title")}</h2>
            <p>{t("settings.danger.description")}</p>
          </div>
        </div>
        <button
          className="danger-action"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(t("settings.danger.confirm"))) return;
            void onDeleteAccount();
          }}
          type="button"
        >
          <Trash2 size={15} strokeWidth={2.2} />
          {t("settings.danger.button")}
        </button>
      </section>
    </div>
  );
}

function exportJson(data: AppData, dataMode: DataMode, filename?: string) {
  const payload = {
    app: "trazza-react",
    data,
    exportedAt: new Date().toISOString(),
    mode: dataMode,
    version: 1,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `trazza-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
