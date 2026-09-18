import { useCallback, useMemo, useState } from "react";
import { safeLocalSet } from "../lib/storage";
import type { EconomicEventType } from "../types";

/* Que citas del calendario sigue cada uno. Se guardan en el navegador como el resto de
   preferencias locales (tema, idioma, orden del cockpit): no es un dato de la cuenta, es
   como quiere ver esta pantalla quien la esta mirando.

   Se guardan las APAGADAS y no las encendidas, igual que el orden del cockpit guarda los
   widgets ocultos: asi, si algun dia se anade un evento nuevo al calendario, aparece
   encendido a todo el mundo en vez de quedarse invisible para quien ya tenia preferencias.

   El orden de esta lista manda en el modal de "Personalizar", y esta puesto por lo que
   mueve al mercado, no alfabetico. */
export const economicEventTypes: EconomicEventType[] = [
  "fomc",
  "cpi",
  "nfp",
  "pce",
  "retailSales",
  "ismManufacturing",
  "ismServices",
];

const storageKey = "trazza:economic-events";

function isEventType(value: unknown): value is EconomicEventType {
  return typeof value === "string" && economicEventTypes.includes(value as EconomicEventType);
}

function readHiddenTypes(): EconomicEventType[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { hidden?: unknown };
    return Array.isArray(parsed.hidden) ? parsed.hidden.filter(isEventType) : [];
  } catch {
    return [];
  }
}

export function useEconomicEventPrefs() {
  const [hidden, setHidden] = useState<EconomicEventType[]>(() => readHiddenTypes());

  const persist = useCallback((next: EconomicEventType[]) => {
    setHidden(next);
    safeLocalSet(storageKey, JSON.stringify({ hidden: next }));
  }, []);

  const toggle = useCallback(
    (type: EconomicEventType) => {
      persist(hidden.includes(type) ? hidden.filter((item) => item !== type) : [...hidden, type]);
    },
    [hidden, persist],
  );

  const reset = useCallback(() => persist([]), [persist]);

  const isEnabled = useCallback((type: EconomicEventType) => !hidden.includes(type), [hidden]);

  const enabledTypes = useMemo(() => economicEventTypes.filter((type) => !hidden.includes(type)), [hidden]);

  return useMemo(() => ({ enabledTypes, isEnabled, reset, toggle }), [enabledTypes, isEnabled, reset, toggle]);
}
