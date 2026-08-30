import { useCallback, useMemo, useState } from "react";
import { safeLocalSet } from "../lib/storage";

export type JournalWidgetId = "kpis" | "pnl" | "discipline" | "recent" | "session" | "errors" | "weekday" | "calendar";

type JournalDashboardLayoutState = {
  hidden: JournalWidgetId[];
  order: JournalWidgetId[];
};

const storageKey = "trazza:journal-dashboard-layout";

/* El orden NO es arbitrario: la rejilla del cockpit es de 12 columnas y cada widget
   ocupa 12 (full), 8 (wide), 6 (half) o 4/3 (narrow/quarter), asi que el orden decide si
   las filas cierran o dejan hueco. Las tres filas que siguen a los KPIs son exactamente
   las del legado (DASHBOARD_WIDGETS en app.js), fila a fila:
   - Balance a la mitad y Winrate por dia / Winrate por sesion a un cuarto cada uno
     (half + quarter + quarter = 12).
   - Errores y Disciplina, mitad y mitad (half + half = 12) — la pareja que se pidio
     explicitamente igualar al legado.
   - Calendario y Ultimas operaciones, ancho y estrecho (wide(8) + narrow(4) = 12).
   Los ocho widgets suman 12+6+3+3+6+6+8+4 = 48 = 4 filas de 12 exactas.
   Si tocas esto, la cuenta que tiene que salir es 12 por fila. */
export const journalDashboardWidgetIds: JournalWidgetId[] = [
  "kpis",
  "pnl",
  "weekday",
  "session",
  "errors",
  "discipline",
  "calendar",
  "recent",
];

function isWidgetId(value: unknown): value is JournalWidgetId {
  return typeof value === "string" && journalDashboardWidgetIds.includes(value as JournalWidgetId);
}

function readStoredLayout(): JournalDashboardLayoutState {
  const fallback: JournalDashboardLayoutState = { hidden: [], order: [...journalDashboardWidgetIds] };
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<JournalDashboardLayoutState>;
    const storedOrder = Array.isArray(parsed.order) ? parsed.order.filter(isWidgetId) : [];
    const missingIds = journalDashboardWidgetIds.filter((id) => !storedOrder.includes(id));
    const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter(isWidgetId) : [];

    return { hidden, order: [...storedOrder, ...missingIds] };
  } catch {
    return fallback;
  }
}

export function useJournalDashboardLayout() {
  const [layout, setLayout] = useState<JournalDashboardLayoutState>(() => readStoredLayout());

  const persist = useCallback((next: JournalDashboardLayoutState) => {
    setLayout(next);
    safeLocalSet(storageKey, JSON.stringify(next));
  }, []);

  const moveWidget = useCallback(
    (fromId: JournalWidgetId, toId: JournalWidgetId) => {
      if (fromId === toId) return;
      const order = [...layout.order];
      const fromIndex = order.indexOf(fromId);
      const toIndex = order.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return;

      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, fromId);
      persist({ ...layout, order });
    },
    [layout, persist],
  );

  const toggleHidden = useCallback(
    (id: JournalWidgetId) => {
      const hidden = layout.hidden.includes(id) ? layout.hidden.filter((item) => item !== id) : [...layout.hidden, id];
      persist({ ...layout, hidden });
    },
    [layout, persist],
  );

  const resetLayout = useCallback(() => {
    persist({ hidden: [], order: [...journalDashboardWidgetIds] });
  }, [persist]);

  const isHidden = useCallback((id: JournalWidgetId) => layout.hidden.includes(id), [layout.hidden]);

  return useMemo(
    () => ({
      isHidden,
      moveWidget,
      order: layout.order,
      resetLayout,
      toggleHidden,
    }),
    [isHidden, layout.order, moveWidget, resetLayout, toggleHidden],
  );
}
