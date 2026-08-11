import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
};

/**
 * Sustituye al <select> nativo: la lista de opciones la dibuja el sistema operativo y no
 * se puede maquetar (ni bordes redondeados, ni tema oscuro). Mismo motivo que llevo a
 * construir InfoHint en vez de usar el atributo title del navegador.
 *
 * El disparador se estiliza por contexto en styles.css (igual que hacia el <select> que
 * sustituye), no aqui: los distintos formularios/filtros ya tenian alturas y fondos
 * ligeramente distintos entre si, y no es parte de este cambio unificarlos.
 */
export function Select({ disabled, id, onChange, options, placeholder, value }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(options.length - 1, current + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option) {
          onChange(option.value);
          setIsOpen(false);
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [highlightedIndex, isOpen, onChange, options]);

  const openPanel = () => {
    if (disabled) return;
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      setOpenUpward(roomBelow < 240 && rect.top > roomBelow);
    }
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  return (
    <div className="custom-select" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="custom-select-trigger"
        disabled={disabled}
        id={id}
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
        type="button"
      >
        <span className={selected ? undefined : "is-placeholder"}>{selected?.label ?? placeholder ?? ""}</span>
        <ChevronDown className="custom-select-chevron" size={15} strokeWidth={2.2} />
      </button>
      {isOpen && (
        <ul className={`custom-select-panel ${openUpward ? "is-upward" : ""}`} role="listbox">
          {options.map((option, index) => (
            <li
              aria-selected={option.value === value}
              className={`custom-select-option ${option.value === value ? "is-selected" : ""} ${
                index === highlightedIndex ? "is-highlighted" : ""
              }`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              onPointerEnter={() => setHighlightedIndex(index)}
              role="option"
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} strokeWidth={2.4} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
