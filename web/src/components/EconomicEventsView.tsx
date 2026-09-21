import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { InfoHint } from "./InfoHint";
import { Modal } from "./Modal";
import { useI18n, useT } from "../lib/i18n/context";
import type { Language } from "../lib/i18n/context";
import { economicEventTypes, useEconomicEventPrefs } from "../hooks/useEconomicEventPrefs";
import {
  getEconomicEventLabelKey,
  getEconomicEventsCoverageEnd,
  getEconomicEventsInRange,
  getNextEconomicEvent,
  toLocalIsoDate,
} from "../lib/economicEvents";

/* Periodo que se esta mirando. El dia es el modo normal —es lo que se consulta antes de
   sentarse a operar— y las flechas se mueven en la unidad elegida: un dia, una semana, un
   mes, o el mismo numero de dias si el intervalo es a medida. */
type RangeMode = "day" | "week" | "month" | "custom";

/* Pantalla de eventos de alto impacto: el dia elegido, con flechas para ir pasando, y unos
   ajustes para cambiar el periodo (atajos o fechas a medida) y elegir que citas se siguen.
   Sin previsiones ni dato publicado: solo que hay evento y a que hora local. */
export function EconomicEventsView() {
  const t = useT();
  const { language } = useI18n();
  const prefs = useEconomicEventPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* "Hoy" se congela al entrar: si se leyera en cada render, la pantalla podria cambiar de
     contenido a mitad de una interaccion. */
  const today = useMemo(() => toLocalIsoDate(new Date()), []);
  const [mode, setMode] = useState<RangeMode>("day");
  const [anchor, setAnchor] = useState(today);
  const [customRange, setCustomRange] = useState({ from: today, to: addDays(today, 6) });

  const range = useMemo(() => getRange(mode, anchor, customRange), [anchor, customRange, mode]);
  const events = useMemo(
    () => getEconomicEventsInRange(range.from, range.to).filter((event) => prefs.isEnabled(event.type)),
    [prefs, range.from, range.to],
  );
  const nextEvent = useMemo(() => {
    if (events.length) return null;
    let candidate = getNextEconomicEvent(range.to);
    while (candidate && !prefs.isEnabled(candidate.type)) candidate = getNextEconomicEvent(candidate.date);
    return candidate;
  }, [events.length, prefs, range.to]);
  const isSingleDay = range.from === range.to;
  const coverageEnd = useMemo(() => getEconomicEventsCoverageEnd(), []);
  /* Que atajo esta puesto se decide comparando el periodo, no guardando cual se pulso: asi
     tambien se enciende solo al llegar a esa semana o a ese mes con las flechas. */
  const activePreset =
    mode === "day" && anchor === today
      ? "today"
      : mode === "week" && startOfWeek(anchor) === startOfWeek(today)
        ? "week"
        : mode === "month" && addMonths(anchor, 0) === addMonths(today, 0)
          ? "month"
          : mode === "month" && addMonths(anchor, 0) === addMonths(today, 1)
            ? "nextMonth"
            : "";

  const shift = (direction: 1 | -1) => {
    if (mode === "custom") {
      const span = daysBetween(customRange.from, customRange.to) + 1;
      setCustomRange({ from: addDays(customRange.from, span * direction), to: addDays(customRange.to, span * direction) });
      return;
    }
    if (mode === "week") setAnchor(addDays(anchor, 7 * direction));
    else if (mode === "month") setAnchor(addMonths(anchor, direction));
    else setAnchor(addDays(anchor, direction));
  };

  const applyPreset = (preset: RangeMode, nextAnchor: string) => {
    setMode(preset);
    setAnchor(nextAnchor);
  };

  return (
    <div className="view-stack">
      <section className="panel economic-events-panel">
        <div className="panel-heading">
          {/* Las flechas y la fecha hacen de titulo: es lo que se mira y lo que se toca. */}
          <div className="economic-events-nav">
            <button aria-label={t("events.range.previous")} className="icon-control compact-icon" onClick={() => shift(-1)} type="button">
              <ChevronLeft size={17} strokeWidth={2.2} />
            </button>
            {/* El hueco entre las flechas no depende de la fecha que toca: debajo de ella,
                invisible, va la mas ancha posible con la insignia de hoy, y la celda se
                queda con ese ancho. Si no, pasar de "lunes" a "miércoles" movia la flecha. */}
            <h2>
              <span aria-hidden="true" className="economic-events-title-sizer">
                <em>{t("events.today")}</em>
                <WidestLongDate language={language} />
              </span>
              <span>
                {isSingleDay && range.from === today && <em>{t("events.today")}</em>}
                <span className="economic-events-title-date">{formatRangeLabel(range, mode, language, "long")}</span>
                <span className="economic-events-title-date is-tight">{formatRangeLabel(range, mode, language, "short")}</span>
              </span>
            </h2>
            <button aria-label={t("events.range.next")} className="icon-control compact-icon" onClick={() => shift(1)} type="button">
              <ChevronRight size={17} strokeWidth={2.2} />
            </button>
            <InfoHint text={t("events.upcoming.hint")} />
          </div>
          {/* La pista sale dos veces y el @media elige: junto a la fecha en escritorio y
              junto a "Ajustes" en el movil, donde la fila de la fecha necesita su ancho. */}
          <div className="economic-events-actions">
            <button className="secondary-action" onClick={() => setSettingsOpen(true)} type="button">
              <SlidersHorizontal size={16} strokeWidth={2.2} />
              {t("events.settings.open")}
            </button>
            <InfoHint text={t("events.upcoming.hint")} />
          </div>
        </div>

        {events.length ? (
          <ul className={`economic-events-list ${isSingleDay ? "is-today" : ""}`}>
            {events.map((event) => (
              <li className={`economic-event-row ${event.date === today ? "is-near" : ""}`} key={event.at.toISOString()}>
                {isSingleDay ? (
                  <span className="economic-event-time is-lead">{formatTime(event.at, language)}</span>
                ) : (
                  <span className="economic-event-date">
                    <strong>{event.at.getDate()}</strong>
                    <small>{formatWeekday(event.at, language)}</small>
                  </span>
                )}
                <span className="economic-event-name">
                  {/* El cuadrado rojo es la "carpeta roja": aqui todo es de alto impacto, asi
                      que hace de sello y no de leyenda. */}
                  <i aria-hidden="true" />
                  {t(getEconomicEventLabelKey(event.type))}
                </span>
                {!isSingleDay && <span className="economic-event-time">{formatTime(event.at, language)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="economic-events-none">
            <p>{prefs.enabledTypes.length ? t("events.range.none") : t("events.today.noneSelected")}</p>
            {/* Un dia suelto casi nunca tiene cita, asi que la pantalla dice cual es la
                siguiente en vez de quedarse en blanco. */}
            {nextEvent && (
              <p className="economic-events-next-hint">
                <i aria-hidden="true" />
                <strong>{t("events.next.label")}</strong>
                {formatShortDate(nextEvent.at, language)} · {t(getEconomicEventLabelKey(nextEvent.type))}
                <small>{formatTime(nextEvent.at, language)}</small>
              </p>
            )}
          </div>
        )}

        {/* Hasta donde llega el calendario cargado, dicho en voz alta: uno sin actualizar se
            leeria como "no hay nada previsto", que es peor que no tenerlo. */}
        {coverageEnd && (
          <p className="economic-events-coverage">
            {t("events.coveragePrefix")} {formatDate(coverageEnd, language)}. {t("events.coverageNote")}
          </p>
        )}
      </section>

      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)} subtitle={t("events.settings.subtitle")} title={t("events.settings.title")}>
          <div className="economic-events-settings">
            <div className="economic-events-setting">
              <h3>{t("events.range.title")}</h3>
              <div className="economic-events-presets">
                <button className={activePreset === "today" ? "active" : ""} onClick={() => applyPreset("day", today)} type="button">
                  {t("events.range.today")}
                </button>
                <button className={activePreset === "week" ? "active" : ""} onClick={() => applyPreset("week", today)} type="button">
                  {t("events.range.week")}
                </button>
                <button className={activePreset === "month" ? "active" : ""} onClick={() => applyPreset("month", today)} type="button">
                  {t("events.range.month")}
                </button>
                <button
                  className={activePreset === "nextMonth" ? "active" : ""}
                  onClick={() => applyPreset("month", addMonths(today, 1))}
                  type="button"
                >
                  {t("events.range.nextMonth")}
                </button>
              </div>
              {/* Fechas a medida: elegir una ya cambia el periodo, sin boton de aplicar. La
                  pantalla de detras se actualiza mientras, que es lo que se quiere ver. */}
              <div className="economic-events-custom">
                <label>
                  <span>{t("events.range.from")}</span>
                  <DatePicker
                    clearable={false}
                    onChange={(value) => {
                      setMode("custom");
                      setCustomRange((current) => ({ from: value, to: current.to < value ? value : current.to }));
                    }}
                    value={customRange.from}
                  />
                </label>
                <label>
                  <span>{t("events.range.to")}</span>
                  <DatePicker
                    clearable={false}
                    onChange={(value) => {
                      setMode("custom");
                      setCustomRange((current) => ({ from: current.from > value ? value : current.from, to: value }));
                    }}
                    value={customRange.to}
                  />
                </label>
              </div>
            </div>

            <div className="economic-events-setting">
              <h3>{t("events.customize.title")}</h3>
              <div className="economic-events-picker">
                {economicEventTypes.map((type) => (
                  <label className={`economic-events-picker-row ${prefs.isEnabled(type) ? "" : "is-off"}`} key={type}>
                    <i aria-hidden="true" />
                    <span>{t(getEconomicEventLabelKey(type))}</span>
                    <input checked={prefs.isEnabled(type)} onChange={() => prefs.toggle(type)} type="checkbox" />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="form-action-row">
            <button className="ghost-action" onClick={prefs.reset} type="button">
              {t("events.customize.reset")}
            </button>
            <button className="primary-action" onClick={() => setSettingsOpen(false)} type="button">
              <Check size={17} strokeWidth={2.2} />
              {t("events.customize.done")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* La fecha larga mas ancha que puede salir en este idioma, solo para reservar su hueco. De
   un dia a otro cambian de ancho el nombre del dia, la cifra y el mes (DM Sans no trae
   cifras tabulares: "11" mide 12px y "20", 20), asi que cada una de esas partes apila todas
   sus opciones en una sola celda y la celda se queda con la mas ancha. Sale exacta sin medir
   nada y sin saber cual gana, que no es obvio: el dia mas ancho del año puede no existir en
   el calendario de ese año. */
function WidestLongDate({ language }: { language: Language }) {
  const parts = useMemo(() => getLongDateOptions(language), [language]);
  return (
    <span>
      {parts.map((options, index) =>
        options.length === 1 ? (
          <span key={index}>{options[0]}</span>
        ) : (
          <span className="economic-events-title-stack" key={index}>
            {options.map((option) => (
              <span key={option}>{option}</span>
            ))}
          </span>
        ),
      )}
    </span>
  );
}

/* Las partes de la fecha larga en el orden del idioma ("miércoles" ", " "30" " de "
   "septiembre"), cada una con todas las opciones que puede tomar: un año bisiesto entero
   pasa por los siete dias, las 31 cifras y los doce meses. Lo de entre medias va tal cual. */
function getLongDateOptions(language: Language) {
  const format = new Intl.DateTimeFormat(toLocale(language), longDateFormat);
  const options = new Map<string, Set<string>>();
  for (let day = 0; day < 366; day += 1) {
    for (const part of format.formatToParts(new Date(2024, 0, 1 + day))) {
      if (part.type !== "literal") options.set(part.type, (options.get(part.type) ?? new Set<string>()).add(part.value));
    }
  }
  return format.formatToParts(new Date(2024, 0, 1)).map((part, index) => {
    const values = part.type === "literal" ? [part.value] : [...(options.get(part.type) ?? [])];
    // La primera parte sube a mayuscula, igual que en el titulo (ver capitalize).
    return index === 0 ? values.map((value) => capitalize(value, language)) : values;
  });
}

/* --- Periodo ------------------------------------------------------------------------- */

function getRange(mode: RangeMode, anchor: string, custom: { from: string; to: string }) {
  if (mode === "custom") return custom;
  if (mode === "week") {
    const start = startOfWeek(anchor);
    return { from: start, to: addDays(start, 6) };
  }
  if (mode === "month") {
    const [year, month] = anchor.split("-").map(Number);
    return { from: toLocalIsoDate(new Date(year, month - 1, 1)), to: toLocalIsoDate(new Date(year, month, 0)) };
  }
  return { from: anchor, to: anchor };
}

function toDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso: string, days: number) {
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function addMonths(iso: string, months: number) {
  const date = toDate(iso);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return toLocalIsoDate(date);
}

/* La semana empieza en lunes, como el calendario del Journal. */
function startOfWeek(iso: string) {
  const date = toDate(iso);
  const weekday = (date.getDay() + 6) % 7;
  return addDays(iso, -weekday);
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((toDate(toIso).getTime() - toDate(fromIso).getTime()) / 86400000);
}

/* --- Formatos ------------------------------------------------------------------------ */

function toLocale(language: Language) {
  return language === "en" ? "en-US" : "es-ES";
}

/* Cada titulo sale en dos tamaños y el @media elige: en el movil la fecha larga no cabe
   entre las flechas y va la corta ("Mié, 30 sept"). Los periodos ya son cortos y salen
   iguales en los dos. */
function formatRangeLabel(range: { from: string; to: string }, mode: RangeMode, language: Language, size: "long" | "short") {
  if (range.from === range.to) {
    const date = toDate(range.from);
    return capitalize(size === "long" ? formatLongDate(date, language) : formatShortDay(date, language), language);
  }
  if (mode === "month") {
    return capitalize(new Intl.DateTimeFormat(toLocale(language), { month: "long", year: "numeric" }).format(toDate(range.from)), language);
  }
  return `${formatShortDate(toDate(range.from), language)} – ${formatShortDate(toDate(range.to), language)}`;
}

/* Lo comparten el titulo y su reserva de hueco (WidestLongDate): si cambia uno, el otro con el. */
const longDateFormat: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", weekday: "long" };

function formatLongDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(toLocale(language), longDateFormat).format(date);
}

function formatShortDay(date: Date, language: Language) {
  return new Intl.DateTimeFormat(toLocale(language), { day: "numeric", month: "short", weekday: "short" })
    .format(date)
    .replace(/\./g, "");
}

/* En espanol el dia y el mes van en minuscula, y en un titulo solo sube la primera letra. Va
   en el texto y no con ::first-letter, que no entra en un flex ni en una rejilla: con esa
   regla el titulo seguia saliendo "martes, 22 de septiembre". */
function capitalize(text: string, language: Language) {
  return text.charAt(0).toLocaleUpperCase(toLocale(language)) + text.slice(1);
}

function formatShortDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(toLocale(language), { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function formatDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(toLocale(language), { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function formatWeekday(date: Date, language: Language) {
  return new Intl.DateTimeFormat(toLocale(language), { weekday: "short" }).format(date).replace(".", "");
}

function formatTime(date: Date, language: Language) {
  return new Intl.DateTimeFormat(toLocale(language), { hour: "2-digit", minute: "2-digit" }).format(date);
}
