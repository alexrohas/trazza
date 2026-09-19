import { useCallback, useMemo, useState } from "react";
import { safeLocalGet, safeLocalSet } from "../lib/storage";

/* Los campos del formulario de trade que el usuario puede quitar y volver a poner, en el
   orden en que se pintan. La lista es cerrada a proposito: no hay campos propios, asi que
   el modelo de datos y los graficos del journal no cambian.

   Fecha, Activo y P&L no estan aqui porque no se pueden quitar: sin la fecha el trade no
   tiene sitio en el calendario, el activo es el titulo de la fila (title not null, con
   check de longitud) y el P&L es lo que suman todas las metricas. Si esa regla cambia,
   tambien cambia el texto de journal.entryFields.subtitle, que los nombra. */
export const journalEntryFieldIds = [
  "firm",
  "account",
  "emotion",
  "direction",
  "discipline",
  "session",
  "strategy",
  "media",
  "errors",
  "notes",
] as const;

export type JournalEntryFieldId = (typeof journalEntryFieldIds)[number];

const storageKey = "trazza:journal-entry-form-hidden";

function isFieldId(value: unknown): value is JournalEntryFieldId {
  return typeof value === "string" && journalEntryFieldIds.includes(value as JournalEntryFieldId);
}

function readStoredHidden(): JournalEntryFieldId[] {
  const raw = safeLocalGet(storageKey);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    /* Solo se aceptan ids conocidos: un campo que ya no existe, o uno obligatorio que alguien
       escribio a mano en el almacenamiento, se ignora y el formulario nunca se queda sin ellos. */
    return Array.isArray(parsed) ? parsed.filter(isFieldId) : [];
  } catch {
    return [];
  }
}

export function useJournalEntryFormFields() {
  const [hidden, setHidden] = useState<JournalEntryFieldId[]>(() => readStoredHidden());

  const persist = useCallback((next: JournalEntryFieldId[]) => {
    setHidden(next);
    safeLocalSet(storageKey, JSON.stringify(next));
  }, []);

  const isVisible = useCallback((id: JournalEntryFieldId) => !hidden.includes(id), [hidden]);

  const toggle = useCallback(
    (id: JournalEntryFieldId) => {
      persist(hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id]);
    },
    [hidden, persist],
  );

  const reset = useCallback(() => persist([]), [persist]);

  return useMemo(() => ({ hiddenCount: hidden.length, isVisible, reset, toggle }), [hidden.length, isVisible, reset, toggle]);
}
