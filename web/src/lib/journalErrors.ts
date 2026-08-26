import type { JournalErrorSeverity, JournalErrorType } from "../types";

export type JournalErrorDefinition = JournalErrorType & {
  severity: JournalErrorSeverity;
};

export const defaultJournalErrorTypes: JournalErrorDefinition[] = [
  { id: "late-entry", label: "Entrada tarde", severity: "moderate", color: "#f59e0b", position: 10, active: true },
  { id: "fomo", label: "FOMO", severity: "moderate", color: "#d97706", position: 20, active: true },
  { id: "revenge", label: "Revenge trade", severity: "severe", color: "#dc2626", position: 30, active: true },
  { id: "oversize", label: "Riesgo excesivo", severity: "severe", color: "#b91c1c", position: 40, active: true },
  { id: "no-stop", label: "Sin stop claro", severity: "severe", color: "#991b1b", position: 50, active: true },
  { id: "early-exit", label: "Salida temprana", severity: "minor", color: "#0e8f8d", position: 60, active: true },
  { id: "news", label: "Noticia / volatilidad", severity: "moderate", color: "#7c3aed", position: 70, active: true },
  { id: "plan", label: "Fuera del plan", severity: "moderate", color: "#ea580c", position: 80, active: true },
];

export function mergeJournalErrorTypes(types: JournalErrorType[]): JournalErrorDefinition[] {
  const byId = new Map<string, JournalErrorDefinition>();

  defaultJournalErrorTypes.forEach((type) => {
    byId.set(type.id, type);
  });

  types.forEach((type, index) => {
    if (!type.id || !type.label.trim()) return;
    const existing = byId.get(type.id);
    byId.set(type.id, {
      active: type.active,
      color: normalizeHexColor(type.color) || existing?.color || "#64748b",
      id: type.id,
      label: type.label.trim(),
      position: Number.isFinite(type.position) ? type.position : existing?.position ?? 1000 + index,
      severity: inferJournalErrorSeverity(type, existing?.severity),
    });
  });

  return Array.from(byId.values()).sort((left, right) => left.position - right.position || left.label.localeCompare(right.label, "es"));
}

export function getJournalErrorDefinition(types: JournalErrorType[], id: string): JournalErrorDefinition {
  return (
    mergeJournalErrorTypes(types).find((type) => type.id === id) || {
      active: true,
      color: "#64748b",
      id,
      label: id,
      position: 9999,
      severity: "moderate",
    }
  );
}

export function normalizeErrorId(types: JournalErrorType[], value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const effectiveTypes = mergeJournalErrorTypes(types);
  const exact = effectiveTypes.find((type) => type.id === raw);
  if (exact) return exact.id;

  const normalized = normalizeTextKey(raw);
  const matched = effectiveTypes.find(
    (type) => normalizeTextKey(type.id) === normalized || normalizeTextKey(type.label) === normalized,
  );
  return matched?.id || normalized;
}

export function sanitizeErrorIds(types: JournalErrorType[], value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  return [...new Set(source.map((item) => normalizeErrorId(types, item)).filter(Boolean))];
}

export function normalizeJournalErrorTypes(value: unknown): JournalErrorType[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();

  return source
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item, index) => {
      const label = String(item.label ?? item.name ?? "").trim();
      const id = String(item.id ?? normalizeTextKey(label)).trim();
      return {
        active: item.active === undefined ? true : Boolean(item.active),
        color: normalizeHexColor(String(item.color ?? "")) || defaultJournalErrorTypes[index % defaultJournalErrorTypes.length]?.color || "#64748b",
        id,
        label,
        position: Number.isFinite(Number(item.position)) ? Number(item.position) : (index + 1) * 10,
      };
    })
    .filter((type) => {
      if (!type.id || type.label.length < 2 || seen.has(type.id)) return false;
      seen.add(type.id);
      return true;
    })
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label, "es"));
}

export function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : "";
}

export function normalizeTextKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function severityRank(severity: JournalErrorSeverity) {
  if (severity === "severe") return 3;
  if (severity === "moderate") return 2;
  return 1;
}

/* Paletas del legado (app.js, journalErrorSeverityPalettes). La severidad no se guarda
   en Supabase —journal_error_types no tiene esa columna— asi que las dos apps la deducen,
   y el legado lo hace ante todo por el color: al crear un tipo se le asigna un color de
   la paleta de su severidad, asi que el color ES el dato guardado. Sin esto React
   deducia por etiqueta y no coincidia con lo que el legado enseña de los mismos datos. */
const journalErrorSeverityPalettes: Record<JournalErrorSeverity, string[]> = {
  minor: ["#888780", "#71717a", "#5f5e5a", "#64748b", "#78716c", "#a1a1aa"],
  moderate: ["#ef9f27", "#e8593c", "#ba7517", "#d85a30", "#854f0b", "#c47a1c"],
  severe: ["#e24b4a", "#d64646", "#c9343e", "#b8292f", "#d4537e", "#a32d2d"],
};

const journalErrorSeverityOrder: JournalErrorSeverity[] = ["severe", "moderate", "minor"];

function inferJournalErrorSeverity(type: JournalErrorType, fallback: JournalErrorSeverity = "moderate"): JournalErrorSeverity {
  /* Mismo orden que inferJournalErrorSeverity en app.js: primero el color, y solo si no
     cae en ninguna paleta se mira la etiqueta. */
  const color = normalizeHexColor(type.color).toLowerCase();
  if (color) {
    const porColor = journalErrorSeverityOrder.find((severity) =>
      journalErrorSeverityPalettes[severity].some((item) => item.toLowerCase() === color),
    );
    if (porColor) return porColor;
  }

  /* Reglas de etiqueta del legado, con el matiz que a React le faltaba: "riesgo" solo es
     grave si NO lleva "poco". Sin esa exclusion "Poco riesgo" salia Grave cuando el
     legado lo enseña como Leve, que es lo contrario. */
  const label = normalizeTextKey(type.label);
  if (label.includes("riesgo") && !label.includes("poco")) return "severe";
  if (label.includes("sl") || label.includes("stop")) return "severe";
  if (label.includes("poco")) return "minor";

  const defaultMatch = defaultJournalErrorTypes.find((item) => item.id === type.id);
  if (defaultMatch) return defaultMatch.severity;

  return fallback;
}
