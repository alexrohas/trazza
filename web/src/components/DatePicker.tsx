import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n, useT } from "../lib/i18n/context";

type DatePickerProps = {
  /** En los campos obligatorios se oculta "Limpiar": el <input type="date"> nativo
   *  apoyaba su required en la validacion del navegador, que aqui ya no existe, y no
   *  poder vaciar el campo mantiene el invariante sin necesidad de validar a mano. */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

/**
 * Sustituye a <input type="date">. El calendario nativo lo dibuja el navegador fuera
 * del arbol del documento (no existe ningun nodo en el DOM al que aplicarle estilos),
 * asi que no hay forma de que encaje con la estetica de la app. Mismo motivo que
 * llevo a construir Select e InfoHint.
 *
 * El valor sigue siendo "YYYY-MM-DD", igual que el input nativo, para que quien lo use
 * no tenga que cambiar nada de su estado.
 */
export function DatePicker({ clearable = true, disabled, id, onChange, placeholder, value }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const { language } = useI18n();
  const locale = language === "en" ? "en-US" : "es-ES";

  const selected = useMemo(() => parseValue(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected ?? new Date()));

  // Al abrir con una fecha ya elegida, el calendario debe aparecer en SU mes, no en el
  // que se dejo la ultima vez.
  useEffect(() => {
    if (isOpen) setVisibleMonth(startOfMonth(selected ?? new Date()));
  }, [isOpen, selected]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const weekdays = useMemo(() => {
    // Semana de lunes a domingo, como el calendario del Journal. Se derivan del locale
    // en vez de guardarse como claves de i18n, que habria que mantener por duplicado.
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, index + 1)));
  }, [locale]);

  const days = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(visibleMonth),
    [locale, visibleMonth],
  );

  const openPanel = () => {
    if (disabled) return;
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      setOpenUpward(roomBelow < 330 && rect.top > roomBelow);
    }
    setIsOpen(true);
  };

  const today = startOfDay(new Date());

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="custom-select-trigger date-picker-trigger"
        disabled={disabled}
        id={id}
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
        type="button"
      >
        <span className={selected ? undefined : "is-placeholder"}>
          {selected ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(selected) : placeholder ?? ""}
        </span>
        <CalendarDays className="custom-select-chevron" size={15} strokeWidth={2.2} />
      </button>

      {isOpen && (
        <div className={`date-picker-panel ${openUpward ? "is-upward" : ""}`} role="dialog">
          <div className="date-picker-head">
            <button
              aria-label={t("datePicker.previousMonth")}
              className="date-picker-nav"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              type="button"
            >
              <ChevronLeft size={15} strokeWidth={2.4} />
            </button>
            <strong>{monthLabel}</strong>
            <button
              aria-label={t("datePicker.nextMonth")}
              className="date-picker-nav"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              type="button"
            >
              <ChevronRight size={15} strokeWidth={2.4} />
            </button>
          </div>

          <div className="date-picker-weekdays" aria-hidden="true">
            {weekdays.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {days.map((day) => {
              const outside = day.getMonth() !== visibleMonth.getMonth();
              const isSelected = selected !== undefined && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <button
                  aria-selected={isSelected}
                  className={`date-picker-day ${outside ? "is-outside" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  key={day.toISOString()}
                  onClick={() => {
                    onChange(toValue(day));
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className={`date-picker-actions ${clearable ? "" : "is-single"}`}>
            {clearable && (
              <button
                className="date-picker-action"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                type="button"
              >
                {t("datePicker.clear")}
              </button>
            )}
            <button
              className="date-picker-action"
              onClick={() => {
                onChange(toValue(today));
                setIsOpen(false);
              }}
              type="button"
            >
              {t("datePicker.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "YYYY-MM-DD" a fecha local. Sin esto, new Date("2026-08-10") se interpreta como UTC
 *  y en husos negativos cae en el dia anterior. */
function parseValue(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toValue(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Rejilla fija de 6 semanas: si se ajustara al mes, el panel cambiaria de alto al
 *  navegar entre meses y daria un salto feo. */
function buildMonthGrid(month: Date) {
  const first = startOfMonth(month);
  // getDay() da 0 para domingo; se rota para que la semana empiece en lunes.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
