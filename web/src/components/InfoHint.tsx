import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

type InfoHintProps = {
  text?: string;
};

const TOOLTIP_WIDTH = 220;
const GAP = 8;

/**
 * Sustituye a los subtitulos/hints siempre visibles: el texto solo aparece al pasar el
 * cursor (o al enfocar con teclado). Tooltip propio con CSS, no el atributo `title`
 * nativo del navegador: ese no se puede maquetar (ni bordes, ni fondo, ni animacion),
 * lo dibuja el sistema operativo tal cual.
 *
 * El globo cuelga de <body> por portal, como los paneles de Select/DatePicker. Dentro
 * de un modal el contenedor que scrollea (.modal-body, overflow:auto) recorta a sus
 * descendientes, asi que un tooltip posicionado en el flujo se cortaba a media frase
 * cuando el icono quedaba cerca de un borde. Colgado del body no hay ancestro que lo
 * pueda recortar, y se decide lado segun el hueco real que haya en la ventana.
 */
export function InfoHint({ text }: InfoHintProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; upward: boolean } | null>(null);

  if (!text) return null;

  const show = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    /* Alto estimado, no medido: el globo aun no esta en el DOM cuando hay que decidir
       el lado. Solo sirve para elegir arriba o abajo, no para colocarlo. */
    const estimatedHeight = 120;
    const roomBelow = window.innerHeight - rect.bottom;
    const upward = roomBelow < estimatedHeight && rect.top > roomBelow;
    /* Anclado al icono pero sin salirse de la ventana por la derecha. */
    const left = Math.max(GAP, Math.min(rect.left - 6, window.innerWidth - TOOLTIP_WIDTH - GAP));

    setPosition({
      left,
      top: upward ? rect.top - GAP : rect.bottom + GAP,
      upward,
    });
  };

  const hide = () => setPosition(null);

  return (
    <span className="info-hint-wrap">
      <button
        aria-describedby={position ? tooltipId : undefined}
        aria-label={text}
        className="info-hint"
        onBlur={hide}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        ref={triggerRef}
        type="button"
      >
        <Info size={13} strokeWidth={2} />
      </button>
      {position &&
        createPortal(
          <span
            className="info-hint-tooltip is-visible"
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              left: position.left,
              ...(position.upward ? { bottom: window.innerHeight - position.top } : { top: position.top }),
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
