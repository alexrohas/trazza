import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/* Insignia del ultimo valor de una curva (chart-value-badge): la usan la curva de capital
   del Panel y la de P&L acumulado del Journal. Iba centrada en el ultimo punto y alineada a
   su izquierda, asi que tapaba justo el tramo final de la curva, que es el que mas se mira.
   Se pidio que no tapara nada.

   Ahora se prueban sitios por encima del punto mas alto de la curva en el ancho que ocupa la
   insignia y por debajo del mas bajo, los dos con aire (el hueco cubre tambien lo que el
   suavizado se sale de los puntos). Gana el que cabe en su zona y pisa menos lineas de
   referencia; a igualdad, el mas cercano al punto.
   Cada sitio se prueba con la insignia alineada al ultimo punto y, ademas, desplazada hasta
   el margen derecho del marco. Lo segundo solo gana si acerca mucho la insignia al punto
   (cada unidad de desplazamiento cuesta media de distancia): hace falta cuando la curva da
   un salto casi vertical justo antes del final, que ocupa todo el alto en el ancho de la
   insignia y la mandaria a media grafica. Paso en una curva de capital real: alineada al
   punto se iba 124 unidades por debajo de el; desplazada, quedo a 10px.

   Todo se calcula en unidades del viewBox, pero la insignia es HTML y mide en pixeles: se
   miden el marco y la insignia antes de pintar y cada vez que cambian de tamano. Hace falta
   observar tambien la insignia y no solo medirla al montar: la vista puede montarse sin
   tamano todavia (con 0 se ignora la medida), y entonces se quedaba con el ancho provisional
   para siempre porque su texto no volvia a cambiar.

   Por la izquierda no pasa del borde del area de trazado (plotLeft). Alineada al ultimo
   punto, con una sola operacion (el punto cae justo en ese borde) o con pocas, la insignia
   se salia del marco, el overflow la cortaba por la mitad y ademas tapaba las cifras del
   eje. En ese caso se desplaza a la derecha lo justo para empezar en el borde. */

export type VerticalRange = { bottom: number; top: number };

type Options = {
  /** Franja vertical (viewBox) en la que puede vivir la insignia; en el Panel excluye la
   *  franja de movimientos de debajo de la curva. */
  bounds: VerticalRange;
  frameRef: RefObject<HTMLDivElement | null>;
  height: number;
  /** Texto de la insignia: si cambia, se vuelve a medir. */
  label: string;
  /** Lineas y etiquetas que no debe pisar, en unidades del viewBox. Recibe el borde izquierdo
   *  de la insignia y la escala vertical para las que dependen de eso (etiquetas en px, lineas
   *  escalonadas que solo importan en el tramo que ocupa la insignia). */
  obstacles: (geometry: { spanLeft: number; unitsPerPixelY: number }) => VerticalRange[];
  /** Borde izquierdo del area de trazado (viewBox): a su izquierda van las cifras del eje. */
  plotLeft: number;
  points: Array<{ x: number; y: number }>;
  width: number;
};

/* Aire entre la insignia y la curva, y margen minimo con el borde derecho del marco, en
   pixeles reales. */
const BADGE_GAP_PX = 10;
const FRAME_EDGE_PX = 6;
/* Cuanto "cuesta" apartar la insignia del ultimo punto hacia la derecha, en unidades de
   distancia vertical por unidad de desplazamiento. */
const SHIFT_COST = 0.5;

export function useCurveValueBadge({ bounds, frameRef, height, label, obstacles, plotLeft, points, width }: Options) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [frameSize, setFrameSize] = useState({ height, width });
  const [badgeSize, setBadgeSize] = useState({ height: 28, width: 96 });
  const hasCurve = points.length > 0;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => {
      if (frame.clientWidth && frame.clientHeight) {
        setFrameSize((current) =>
          current.width === frame.clientWidth && current.height === frame.clientHeight
            ? current
            : { height: frame.clientHeight, width: frame.clientWidth },
        );
      }
      const badge = badgeRef.current;
      if (badge?.offsetWidth && badge.offsetHeight) {
        setBadgeSize((current) =>
          current.width === badge.offsetWidth && current.height === badge.offsetHeight
            ? current
            : { height: badge.offsetHeight, width: badge.offsetWidth },
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    if (badgeRef.current) observer.observe(badgeRef.current);
    return () => observer.disconnect();
  }, [frameRef, hasCurve, label]);

  const last = points[points.length - 1];
  if (!last) return { badgeRef, badgeRight: 0, badgeY: 0 };

  const unitsPerPixelX = width / frameSize.width;
  const unitsPerPixelY = height / frameSize.height;
  const { center, right } = placeCurveValueBadge({
    badgeHeight: badgeSize.height * unitsPerPixelY,
    badgeWidth: badgeSize.width * unitsPerPixelX,
    bounds,
    gap: BADGE_GAP_PX * unitsPerPixelY,
    leftLimit: plotLeft,
    obstaclesFor: (spanLeft) => obstacles({ spanLeft, unitsPerPixelY }),
    points,
    rightLimit: width - FRAME_EDGE_PX * unitsPerPixelX,
  });
  return { badgeRef, badgeRight: right, badgeY: center };
}

/* Centro vertical y borde derecho de la insignia. Ver el comentario de arriba. */
function placeCurveValueBadge({
  badgeHeight,
  badgeWidth,
  bounds,
  gap,
  leftLimit,
  obstaclesFor,
  points,
  rightLimit,
}: {
  badgeHeight: number;
  badgeWidth: number;
  bounds: VerticalRange;
  gap: number;
  leftLimit: number;
  obstaclesFor: (spanLeft: number) => VerticalRange[];
  points: Array<{ x: number; y: number }>;
  rightLimit: number;
}) {
  const last = points[points.length - 1];
  const half = badgeHeight / 2;
  const nearest = Math.max(last.x, leftLimit + badgeWidth);
  const rights = rightLimit > nearest ? [nearest, rightLimit] : [nearest];
  const candidates = rights.flatMap((right) => {
    const spanLeft = right - badgeWidth;
    const extent = getCurveExtent(points, spanLeft);
    const obstacles = obstaclesFor(spanLeft);
    return [extent.top - gap - half, extent.bottom + gap + half]
      .filter((center) => center - half >= bounds.top && center + half <= bounds.bottom)
      .map((center) => ({
        center,
        cost: Math.abs(center - last.y) + (right - last.x) * SHIFT_COST,
        crossings: obstacles.filter((range) => range.bottom >= center - half && range.top <= center + half).length,
        right,
      }));
  });
  const best = candidates.sort((left, right) => left.crossings - right.crossings || left.cost - right.cost)[0];
  return best ? { center: best.center, right: best.right } : { center: last.y, right: nearest };
}

/* Alto que ocupa la curva desde spanLeft hasta su ultimo punto, incluido el tramo que entra
   por la izquierda (su altura justo en el borde). */
function getCurveExtent(points: Array<{ x: number; y: number }>, spanLeft: number) {
  const last = points[points.length - 1];
  let top = last.y;
  let bottom = last.y;
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const point = points[index];
    if (point.x < spanLeft) {
      const next = points[index + 1];
      const ratio = next.x === point.x ? 0 : (spanLeft - point.x) / (next.x - point.x);
      const edgeY = point.y + ratio * (next.y - point.y);
      top = Math.min(top, edgeY);
      bottom = Math.max(bottom, edgeY);
      break;
    }
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  return { bottom, top };
}
