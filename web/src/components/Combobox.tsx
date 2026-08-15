import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type ComboboxProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  suggestions: string[];
  value: string;
};

/**
 * Campo de texto con sugerencias: se puede elegir de la lista o escribir cualquier cosa.
 *
 * Ni un desplegable cerrado ni texto libre a secas servian aqui. Cerrado impediria dar de
 * alta una firma que no estuviera en la lista, y en un sector donde salen y desaparecen
 * empresas constantemente eso deja tirado al usuario. Libre a secas invita a la errata,
 * que es justo lo que rompe el emparejamiento del logo.
 *
 * Reutiliza el panel y las opciones del Select para que ambos se lean igual.
 */
export function Combobox({ disabled, onChange, placeholder, required, suggestions, value }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  /* Posicion en px del viewport: el panel se porta a document.body por el mismo motivo
     que en Select (ver ese componente) — sin esto, un modal corto recortaba la lista de
     sugerencias en vez de dejarla salir por encima. */
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  /* Se filtra por coincidencia en cualquier parte, no solo al principio: quien escribe
     "futures" espera encontrar "Alpha Futures". */
  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) return suggestions;
    return suggestions.filter((item) => item.toLowerCase().includes(needle));
  }, [suggestions, value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      setPanelPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleScroll = () => setIsOpen(false);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen]);

  const choose = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setHighlightedIndex((current) => Math.min(matches.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(0, current - 1));
      return;
    }
    /* Enter solo captura si hay una sugerencia resaltada y el panel esta abierto. Si no,
       se deja pasar para que el formulario se envie como en cualquier otro campo. */
    if (event.key === "Enter" && isOpen && matches[highlightedIndex]) {
      event.preventDefault();
      choose(matches[highlightedIndex]);
    }
  };

  return (
    <div className="custom-select combobox" ref={rootRef}>
      <input
        autoComplete="off"
        className="combobox-input"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        type="text"
        value={value}
      />
      <button
        aria-expanded={isOpen}
        aria-label="Ver sugerencias"
        className="combobox-toggle"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        tabIndex={-1}
        type="button"
      >
        <ChevronDown size={15} strokeWidth={2.2} />
      </button>

      {isOpen && matches.length > 0 && panelPosition && createPortal(
        <ul
          className="custom-select-panel"
          role="listbox"
          style={{ position: "fixed", top: panelPosition.top, left: panelPosition.left, width: panelPosition.width }}
        >
          {matches.map((name, index) => (
            <li
              aria-selected={name === value}
              className={`custom-select-option ${name === value ? "is-selected" : ""} ${
                index === highlightedIndex ? "is-highlighted" : ""
              }`}
              key={name}
              onClick={(event) => {
                // Mismo motivo que en Select: sin esto, el label que envuelve el
                // input reenvia un click/foco fantasma en cuanto se cierra el panel.
                event.preventDefault();
                choose(name);
              }}
              onPointerEnter={() => setHighlightedIndex(index)}
              role="option"
            >
              <span>{name}</span>
              {name === value && <Check size={14} strokeWidth={2.4} />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
