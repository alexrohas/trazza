import { useCallback, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseClient } from "../lib/supabase";

/**
 * Qué pasos de los tutoriales ha visto cada usuario, y si los ha apagado todos.
 *
 * **Se recuerda paso a paso, no pantalla a pantalla**, y es lo que hace que los tutoriales
 * sirvan a una cuenta que empieza vacía: quien entra en Cuentas sin cuentas ve dos pasos,
 * y el día que crea la primera le sale solo el que le faltaba, "Cada cuenta", señalándola.
 * Con "pantalla vista" ese paso no llegaba a salir nunca. De paso, un paso nuevo que se
 * añada más adelante le sale solo a quien ya había visto el resto (ver lib/tours.ts).
 *
 * Vive en los metadatos de Supabase Auth, donde la app ya guarda el nombre y la divisa
 * (ver useAuth): se recuerda en la cuenta y no en el navegador —quien lo ve en el
 * ordenador no lo vuelve a ver en el móvil— y no hace falta ninguna tabla ni migración. Sin
 * sesión (el servidor demo) va a localStorage.
 *
 * Los pasos se guardan como una lista de claves ("accounts.card"), sin fechas: los
 * metadatos viajan dentro del token de sesión en cada petición, y aquí cada byte cuenta.
 * Se escribe solo esta clave, no el objeto de metadatos entero: Supabase fusiona las claves
 * de primer nivel, y mandar el objeto viejo completo podría pisar un cambio de perfil hecho
 * entre medias.
 */

const METADATA_KEY = "trazza_tours";
const STORAGE_KEY = "trazza:tours";

export type TourState = {
  /** Claves de los pasos ya vistos o saltados: `${pantalla}.${paso}` (ver stepKey). */
  steps: string[];
  /** "No mostrar más tutoriales": ya no salta ninguno solo. El del menú "⋯" sí. */
  disabled: boolean;
};

const EMPTY: TourState = { steps: [], disabled: false };

function parseTourState(value: unknown): TourState {
  if (!value || typeof value !== "object") return EMPTY;
  const raw = value as { steps?: unknown; disabled?: unknown };
  /* La primera versión guardaba pantallas vistas (`seen`), nunca llegó a producción y se
     ignora: con ella volverían a faltar los pasos que dependen de tener datos. */
  const steps = Array.isArray(raw.steps) ? raw.steps.filter((key): key is string => typeof key === "string") : [];
  return { steps, disabled: raw.disabled === true };
}

function readLocal(): TourState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parseTourState(JSON.parse(stored)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeLocal(state: TourState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Sin almacenamiento (modo privado, bloqueado): el tutorial volverá a salir, nada más. */
  }
}

export function useTourState(user: User | null) {
  const userId = user?.id ?? "local";
  const stored = useMemo(() => (user ? parseTourState(user.user_metadata?.[METADATA_KEY]) : readLocal()), [user]);
  /* Lo último que se escribió manda sobre los metadatos hasta que Supabase devuelva el
     usuario actualizado (y también si la escritura falla): sin esto, el tutorial recién
     cerrado volvería a saltar en el rato que tarda la respuesta. Va atado al usuario para
     que al cambiar de cuenta no se herede el estado de la anterior. */
  const [written, setWritten] = useState<{ userId: string; state: TourState } | null>(null);
  const state = written && written.userId === userId ? written.state : stored;
  const stateRef = useRef(state);
  stateRef.current = state;

  const save = useCallback(
    (next: TourState) => {
      stateRef.current = next;
      setWritten({ userId, state: next });
      if (user && supabaseClient) {
        void supabaseClient.auth.updateUser({ data: { [METADATA_KEY]: next } }).catch(() => undefined);
      } else {
        writeLocal(next);
      }
    },
    [user, userId],
  );

  const markSeen = useCallback(
    (keys: string[]) => {
      const current = stateRef.current;
      const fresh = keys.filter((key) => !current.steps.includes(key));
      if (fresh.length) save({ ...current, steps: [...current.steps, ...fresh] });
    },
    [save],
  );

  const disableAll = useCallback(() => save({ ...stateRef.current, disabled: true }), [save]);

  /* "Volver a ver los tutoriales" en Ajustes: todo como el primer día. */
  const resetAll = useCallback(() => save(EMPTY), [save]);

  return { state, markSeen, disableAll, resetAll };
}
