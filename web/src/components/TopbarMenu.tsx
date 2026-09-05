import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export type TopbarMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /* Apunte corto a la derecha de la fila: el idioma actual ("ES"), un estado. */
  trailing?: string;
  disabled?: boolean;
  /* Los toggles (tema, idioma) dejan el menu abierto para poder encadenar cambios y ver
     el efecto sin reabrirlo; las acciones de un solo uso (sincronizar, salir) lo cierran. */
  keepOpen?: boolean;
};

type TopbarMenuProps = {
  items: TopbarMenuItem[];
  label: string;
};

/**
 * Menu de desbordamiento de la barra superior: recoge los controles de segundo nivel
 * (tema, idioma, sincronizar, salir) que antes vivian sueltos como iconos y saturaban la
 * fila — seis controles que ni cabian bien (ver el breakpoint de .topbar en styles.css).
 *
 * Reutiliza el lenguaje visual del panel de Select: portado a document.body (position
 * fixed con coordenadas del viewport), mismo borde/sombra/radio, y se cierra igual (click
 * fuera, Escape, scroll o resize). Anclado por la derecha porque el disparador esta en la
 * esquina y el panel crece hacia dentro.
 */
type PanelPosition = {
  /* Distancia al borde derecho del viewport (px): el panel siempre se ancla por la
     derecha, se abra hacia arriba o hacia abajo. */
  right: number;
  /* Distancia al borde de referencia: a top si baja, a bottom si sube. */
  anchor: number;
  openUpward: boolean;
};

export function TopbarMenu({ items, label }: TopbarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    /* El panel cuelga de document.body, asi que no es descendiente de rootRef: hay que
       comprobar tambien panelRef para no contar un click en una fila como "fuera". */
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
        setHighlightedIndex((current) => Math.min(items.length - 1, current + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const item = items[highlightedIndex];
        if (item && !item.disabled) {
          item.onSelect();
          if (!item.keepOpen) setIsOpen(false);
        }
      }
    };
    /* Con el menu abierto, un scroll de la pagina lo cierra en vez de dejarlo flotando
       lejos del disparador (la posicion se fija al abrir). */
    const handleScroll = () => setIsOpen(false);

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
  }, [highlightedIndex, isOpen, items]);

  /* El anclaje por la derecha funciona en escritorio (el disparador vive en la esquina),
     pero en movil la barra se apila y las acciones se alinean a la izquierda: el
     disparador queda a media pantalla y un panel de 208px se salia por el borde
     izquierdo. Ya renderizado, se mide y se empuja hacia dentro si asoma. Corre una sola
     vez por apertura (deps solo isOpen): al ajustar la posicion no se vuelve a disparar,
     asi que no hay bucle. */
  useLayoutEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const overflowLeft = 8 - rect.left;
    if (overflowLeft > 0) {
      setPanelPosition((pos) => (pos ? { ...pos, right: Math.max(8, pos.right - overflowLeft) } : pos));
    }
  }, [isOpen]);

  const openPanel = () => {
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      /* clientWidth/Height, no innerWidth/Height: el primero excluye la barra de scroll.
         Con innerWidth el ancla por la derecha (position:fixed; right) se iba ~15px a la
         izquierda del disparador en escritorio, que es donde la pagina tiene scroll. */
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      /* En escritorio el disparador esta arriba y siempre hay sitio abajo. En movil la
         barra apilada lo empuja hacia el centro y el panel se salia por abajo: si abajo
         no cabe y arriba hay mas, se abre hacia arriba (mismo criterio que Select). */
      const roomBelow = viewportHeight - rect.bottom;
      const openUpward = roomBelow < 220 && rect.top > roomBelow;
      setPanelPosition({
        right: viewportWidth - rect.right,
        anchor: openUpward ? viewportHeight - rect.top + 6 : rect.bottom + 6,
        openUpward,
      });
    }
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  return (
    <div className="topbar-menu" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className="theme-toggle topbar-menu-trigger"
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
        type="button"
      >
        <MoreHorizontal size={17} strokeWidth={2.2} />
      </button>
      {isOpen && panelPosition && createPortal(
        <div
          className={`topbar-menu-panel ${panelPosition.openUpward ? "is-upward" : ""}`}
          ref={panelRef}
          role="menu"
          style={{
            position: "fixed",
            right: panelPosition.right,
            ...(panelPosition.openUpward
              ? { bottom: panelPosition.anchor }
              : { top: panelPosition.anchor }),
          }}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                className={`topbar-menu-item ${index === highlightedIndex ? "is-highlighted" : ""}`}
                disabled={item.disabled}
                key={item.id}
                onClick={() => {
                  item.onSelect();
                  if (!item.keepOpen) setIsOpen(false);
                }}
                onPointerEnter={() => setHighlightedIndex(index)}
                role="menuitem"
                type="button"
              >
                <Icon size={16} strokeWidth={2.2} />
                <span>{item.label}</span>
                {item.trailing ? <small>{item.trailing}</small> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
