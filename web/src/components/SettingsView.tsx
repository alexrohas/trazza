import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Moon, Save, Sun } from "lucide-react";
import {
  findLocalMigrationSource,
  hasImportData,
  markLocalMigrationComplete,
  parseTrazzaImport,
  summarizeImportData,
  type LocalMigrationSource,
} from "../lib/legacyImport";
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
  onImportData: (data: AppData) => Promise<boolean>;
  onThemeChange: (theme: "light" | "dark") => void;
  onUpdateProfile: (input: UserProfileInput) => Promise<boolean>;
};

export function SettingsView({
  busy,
  data,
  dataMode,
  message,
  mutationError,
  mutating,
  onImportData,
  onThemeChange,
  onUpdateProfile,
  profile,
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
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Perfil</h2>
            <p>Nombre visible, email y moneda preferida.</p>
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
            <span>Nombre</span>
            <input
              disabled={busy || !profile}
              minLength={2}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              type="text"
              value={draft.displayName}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              disabled={busy || !profile}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              type="email"
              value={draft.email}
            />
          </label>
          <label>
            <span>Moneda</span>
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
            Guardar perfil
          </button>
        </form>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Apariencia</h2>
            <p>Tema local de la nueva app React.</p>
          </div>
        </div>
        <div className="segmented-control">
          <button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")} type="button">
            <Sun size={16} strokeWidth={2.2} />
            Claro
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")} type="button">
            <Moon size={16} strokeWidth={2.2} />
            Oscuro
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Exportacion</h2>
            <p>Descarga una copia JSON del estado cargado.</p>
          </div>
        </div>
        <div className="export-summary">
          <span>{data.firms.length} empresas</span>
          <span>{data.accounts.length} cuentas</span>
          <span>{data.movements.length} movimientos</span>
          <span>{data.journalEntries.length} entradas</span>
          <span>{data.journalErrorTypes.length} tipos error</span>
        </div>
        <button className="primary-action" onClick={() => exportJson(data, dataMode)} type="button">
          <Download size={17} strokeWidth={2.2} />
          Exportar JSON
        </button>
      </section>

      <section className="panel settings-panel migration-panel">
        <div className="panel-heading">
          <div>
            <h2>Migracion</h2>
            <p>Sube datos antiguos o una copia JSON a Supabase.</p>
          </div>
        </div>
        <div className="migration-actions">
          <button className="primary-action" disabled={!canImport} onClick={() => importInputRef.current?.click()} type="button">
            <FileUp size={17} strokeWidth={2.2} />
            Importar JSON
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
            Subir localStorage
          </button>
        </div>
        <div className="migration-status">
          <span>{dataMode === "cloud" ? "Supabase conectado" : "Activa sesion cloud para importar."}</span>
          <span>
            {localMigrationSource
              ? `Datos locales detectados en ${localMigrationSource.key}: ${localMigrationSource.summary}.`
              : "No hay datos locales pendientes en este navegador."}
          </span>
          <span>La migracion sustituye empresas, cuentas, movimientos y journal de la cuenta actual.</span>
        </div>
        {migrationMessage && <p className={`mutation-message ${migrationMessage.type}`}>{migrationMessage.text}</p>}
        {mutationError && <p className="mutation-message error">{mutationError}</p>}
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
