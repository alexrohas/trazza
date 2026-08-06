import { useCallback, useMemo, useState } from "react";

export type JournalWidgetId = "kpis" | "pnl" | "recent" | "session" | "emotion" | "errors" | "weekday" | "calendar";

type JournalDashboardLayoutState = {
  hidden: JournalWidgetId[];
  order: JournalWidgetId[];
};

const storageKey = "trazza:journal-dashboard-layout";

export const journalDashboardWidgetIds: JournalWidgetId[] = [
  "kpis",
  "pnl",
  "recent",
  "session",
  "emotion",
  "errors",
  "weekday",
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
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
