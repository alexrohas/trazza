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
   las filas cierran o dejan hueco.
   La primera fila tras los KPIs copia la del legado tal cual, que es donde iban juntas
   Balance, Winrate por dia y Winrate por sesion: P&L a la mitad y las otras dos a un
   cuarto cada una (half + quarter + quarter = 12). Winrate por sesion sale de su pareja
   anterior con Disciplina, que pasa a "full" y ocupa su propia fila (mismo caso que P&L
   cuando se le fue "emotion" como pareja). Errores y Ultimas operaciones se quedan
   emparejadas como estaban: son las mejor emparejadas por sentido (errores con las
   operaciones donde se cometieron) y wide(8)+narrow(4) sigue sumando 12.
   Los ocho widgets suman 12+6+3+3+12+8+4+12 = 60 = 5 filas de 12 exactas (una menos que
   antes: P&L, Winrate por dia y Winrate por sesion comparten una sola fila en vez de dos).
   Si tocas esto, la cuenta que tiene que salir es 12 por fila. */
export const journalDashboardWidgetIds: JournalWidgetId[] = [
  "kpis",
  "pnl",
  "weekday",
  "session",
  "discipline",
  "errors",
  "recent",
  "calendar",
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
