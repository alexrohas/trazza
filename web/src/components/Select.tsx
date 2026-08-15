import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  label: string;
  value: string;
  /* Para la opcion que no es un valor real sino una acción ("+ Crear cuenta nueva"):
     la distingue visualmente del resto de la lista sin que el componente tenga que
     saber nada del caso de uso concreto. */
  accent?: boolean;
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
  /* Posicion en px del viewport, no relativa al padre: el panel se porta a
     document.body (ver render mas abajo) para que ningun ancestro con overflow:hidden
     y altura maxima (como .modal-card) pueda recortarlo — mismo motivo que Modal.tsx
     ya usa portal. */
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen) return undefined;

    /* El panel esta portado a document.body (ver render), asi que ya no es
       descendiente de rootRef: sin comprobar tambien panelRef, un pointerdown en
       cualquier opcion contaba como "fuera" y cerraba el panel antes de que el click
       llegara a completarse — la opcion nunca se seleccionaba. */
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
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
    /* Igual que en el click-fuera: la posicion se calcula una vez al abrir. Si el
       usuario hace scroll fuera del panel (del modal o de la pagina) con el panel
       abierto, se cierra en vez de perseguir al disparador. El scroll DENTRO del panel
       (max-height 260px, con overflow propio si hay muchas opciones) se ignora: es
       navegacion normal de la lista, no debe cerrarla — cerraba antes de que el click
       en una opcion llegara a completarse. */
    const handleScroll = (event: Event) => {
      if (panelRef.current && panelRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [highlightedIndex, isOpen, onChange, options]);

  const openPanel = () => {
    if (disabled) return;
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      const openUpward = roomBelow < 240 && rect.top > roomBelow;
      setPanelPosition({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUpward,
      });
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
      {isOpen && panelPosition && createPortal(
        <ul
          className={`custom-select-panel ${panelPosition.openUpward ? "is-upward" : ""}`}
          ref={panelRef}
          role="listbox"
          style={{
            position: "fixed",
            left: panelPosition.left,
            width: panelPosition.width,
            ...(panelPosition.openUpward
              ? { bottom: window.innerHeight - panelPosition.top }
              : { top: panelPosition.top }),
          }}
        >
          {options.map((option, index) => (
            <li
              aria-selected={option.value === value}
              className={`custom-select-option ${option.value === value ? "is-selected" : ""} ${
                index === highlightedIndex ? "is-highlighted" : ""
              } ${option.accent ? "is-accent" : ""}`}
              key={option.value}
              onClick={(event) => {
                /* El <li> no es un control de formulario, asi que un click aqui, al
                   estar este panel dentro del <label> que envuelve el disparador, hace
                   que el navegador reenvie un click extra a ese boton (asi funciona un
                   label con cualquier descendiente no interactivo). Sin este
                   preventDefault, ese click fantasma volvia a abrir el panel justo
                   despues de cerrarlo. */
                event.preventDefault();
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
        </ul>,
        document.body,
      )}
    </div>
  );
}
