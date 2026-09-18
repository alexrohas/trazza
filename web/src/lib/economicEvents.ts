import { economicEvents } from "../data/economicEvents";
import type { EconomicEvent, EconomicEventType } from "../types";

/* Consultas sobre el calendario de eventos de alto impacto. El dato vive en
   data/economicEvents (fechas oficiales, instantes UTC); aqui solo se ordena, se agrupa por
   dia y se traduce a la hora local de quien mira, que es donde estan las trampas:
   - El dia al que pertenece un evento es el suyo en hora local, no en UTC ni en Nueva York:
     si alguien mira esto desde Tokio, el CPI de las 8:30 de Nueva York le cae de madrugada
     del dia siguiente, y ahi es donde tiene que salir marcado en su calendario.
   - La fecha local se compone a mano (getFullYear/getMonth/getDate) y no con toISOString,
     que devuelve el dia en UTC y adelantaria o atrasaria la marca segun la hora. */

export type EconomicEventOccurrence = {
  at: Date;
  /** Fecha local en formato ISO corto (YYYY-MM-DD), la que usa el resto de la app. */
  date: string;
  type: EconomicEventType;
};

export function getEconomicEventOccurrences(events: EconomicEvent[] = economicEvents): EconomicEventOccurrence[] {
  return events
    .map((event) => {
      const at = new Date(event.at);
      return { at, date: toLocalIsoDate(at), type: event.type };
    })
    .filter((occurrence) => !Number.isNaN(occurrence.at.getTime()))
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

/* Eventos que aun no han pasado, del primero al ultimo. `from` es "ahora" y se pasa desde
   fuera para que la vista pueda memorizarlo y no cambiar de resultado en cada render. */
export function getUpcomingEconomicEvents(from: Date, events: EconomicEvent[] = economicEvents) {
  return getEconomicEventOccurrences(events).filter((occurrence) => occurrence.at.getTime() >= from.getTime());
}

/* Hasta cuando llega el calendario cargado. La vista lo dice en voz alta cuando se acaba:
   sin esto, un calendario sin actualizar se lee como "no hay nada previsto". */
export function getEconomicEventsCoverageEnd(events: EconomicEvent[] = economicEvents) {
  const occurrences = getEconomicEventOccurrences(events);
  return occurrences.length ? occurrences[occurrences.length - 1].at : null;
}

/* Eventos entre dos fechas locales, las dos incluidas. Las fechas van en YYYY-MM-DD, que se
   comparan como texto sin convertir nada. */
export function getEconomicEventsInRange(fromDate: string, toDate: string, events: EconomicEvent[] = economicEvents) {
  return getEconomicEventOccurrences(events).filter((occurrence) => occurrence.date >= fromDate && occurrence.date <= toDate);
}

/* La primera cita despues de una fecha. La pantalla la ensena cuando el periodo elegido se
   queda vacio: un dia sin nada es lo normal, y sin esto la pagina se queda muerta. */
export function getNextEconomicEvent(afterDate: string, events: EconomicEvent[] = economicEvents) {
  return getEconomicEventOccurrences(events).find((occurrence) => occurrence.date > afterDate) || null;
}

/* La clave i18n del nombre del evento. Vive aqui y no en la vista porque la usan tanto la
   pantalla de eventos como el calendario y el aviso del dia del Journal. */
export function getEconomicEventLabelKey(type: EconomicEventType) {
  return `events.type.${type}` as const;
}

export function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
