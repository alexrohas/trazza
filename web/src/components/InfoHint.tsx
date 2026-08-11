import { useId } from "react";
import { Info } from "lucide-react";

type InfoHintProps = {
  text?: string;
};

/**
 * Sustituye a los subtitulos/hints siempre visibles: el texto solo aparece al pasar el
 * cursor (o al enfocar con teclado). Tooltip propio con CSS, no el atributo `title`
 * nativo del navegador: ese no se puede maquetar (ni bordes, ni fondo, ni animacion),
 * lo dibuja el sistema operativo tal cual.
 */
export function InfoHint({ text }: InfoHintProps) {
  const tooltipId = useId();
  if (!text) return null;

  return (
    <span className="info-hint-wrap">
      <button aria-describedby={tooltipId} aria-label={text} className="info-hint" type="button">
        <Info size={13} strokeWidth={2} />
      </button>
      <span className="info-hint-tooltip" id={tooltipId} role="tooltip">
        {text}
      </span>
    </span>
  );
}
