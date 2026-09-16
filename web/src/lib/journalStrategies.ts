import { normalizeTextKey } from "./journalErrors";
import type { JournalStrategy } from "../types";

/* Mismo parseo que normalizeJournalErrorTypes (journalErrors.ts), sin color ni severidad:
   solo hace falta para leer un backup JSON propio que ya incluya estrategias (esta
   funcion nunca ve el JSON del legado, que no tiene el concepto). */
export function normalizeJournalStrategies(value: unknown): JournalStrategy[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();

  return source
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item, index) => {
      const label = String(item.label ?? item.name ?? "").trim();
      const id = String(item.id ?? normalizeTextKey(label)).trim();
      return {
        active: item.active === undefined ? true : Boolean(item.active),
        id,
        label,
        position: Number.isFinite(Number(item.position)) ? Number(item.position) : (index + 1) * 10,
      };
    })
    .filter((strategy) => {
      if (!strategy.id || strategy.label.length < 2 || seen.has(strategy.id)) return false;
      seen.add(strategy.id);
      return true;
    })
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label, "es"));
}

export function getJournalStrategyLabel(strategies: JournalStrategy[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  return strategies.find((strategy) => strategy.id === id)?.label;
}
