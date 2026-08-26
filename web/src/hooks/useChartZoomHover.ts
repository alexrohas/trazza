import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/* Zoom de rueda y recorrido con el cursor para los graficos de linea. Lo usan los tres:
   CapitalCurve (Panel) y las curvas de P&L y Disciplina del Journal. Salio de
   CapitalCurve y volvio a ella, asi que la mecanica esta en un solo sitio y las tres
   graficas se tocan igual por construccion, no por acuerdo.

   Los factores son los mismos que los del legado, que es la referencia de tacto que se
   quiere replicar: cada muesca encoge la ventana a 0.78 o la agranda a 1.28.

   El hook no sabe nada de la geometria de cada grafico —alto, padding, franjas— porque
   recibe los puntos ya escalados en onPointerMove. Es lo que permite que CapitalCurve
   siga cruzando su linea guia hasta la franja de movimientos mientras las del Journal
   la paran en la curva. */
const ZOOM_IN_FACTOR = 0.78;
const ZOOM_OUT_FACTOR = 1.28;
const MIN_VISIBLE_POINTS = 4;

type ScaledPoint = { x: number };

type Options = {
  chartWidth: number;
  paddingLeft: number;
  totalPoints: number;
  width: number;
};

export function useChartZoomHover({ chartWidth, paddingLeft, totalPoints, width }: Options) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  /* Ventana visible como {inicio, cantidad} y no niveles discretos de zoom: la rueda
     ancla el punto que hay bajo el cursor, y para eso hace falta mover el inicio
     libremente, no solo recortar por el final. */
  const [view, setView] = useState<{ count: number; start: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const visibleCount = view ? clamp(view.count, Math.min(MIN_VISIBLE_POINTS, totalPoints), totalPoints) : totalPoints;
  const visibleStart = view ? clamp(view.start, 0, Math.max(0, totalPoints - visibleCount)) : 0;
  const isZoomed = visibleCount < totalPoints;

  const reset = useCallback(() => {
    setActiveIndex(null);
    setView(null);
  }, []);

  /* Recibe los puntos ya escalados en vez de calcularlos: cada grafico tiene su propia
     geometria (alto, padding, franjas) y el hook no deberia saber nada de eso. */
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>, scaledPoints: ScaledPoint[]) => {
      if (!scaledPoints.length) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const pointerX = ((event.clientX - rect.left) / rect.width) * width;
      const nearestIndex = scaledPoints.reduce((nearest, point, index) => {
        const distancia = Math.abs(point.x - pointerX);
        const menor = Math.abs(scaledPoints[nearest].x - pointerX);
        return distancia < menor ? index : nearest;
      }, 0);
      setActiveIndex(nearestIndex);
    },
    [width],
  );

  /* Listener nativo y no pasivo: React registra `wheel` en la raiz como pasivo, asi que
     un onWheel de JSX no puede llamar a preventDefault() y la pagina scrollearia al hacer
     zoom. Mismo motivo por el que el legado lo registra con { passive: false }. */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || totalPoints < MIN_VISIBLE_POINTS) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const localX = ((event.clientX - rect.left) / rect.width) * width;
      const ratio = clamp((localX - paddingLeft) / Math.max(1, chartWidth), 0, 1);
      const factor = event.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
      const nextCount = clamp(Math.round(visibleCount * factor), Math.min(MIN_VISIBLE_POINTS, totalPoints), totalPoints);
      if (nextCount === visibleCount) return;

      // El punto bajo el cursor se queda donde esta: se despeja el inicio que lo mantiene.
      const anchor = visibleStart + ratio * Math.max(visibleCount - 1, 1);
      const nextStart = clamp(Math.round(anchor - ratio * Math.max(nextCount - 1, 1)), 0, totalPoints - nextCount);
      setView(nextCount >= totalPoints ? null : { count: nextCount, start: nextStart });
    };

    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, [chartWidth, paddingLeft, totalPoints, visibleCount, visibleStart, width]);

  return {
    activeIndex,
    frameRef,
    isZoomed,
    onPointerMove,
    reset,
    setActiveIndex,
    visibleCount,
    visibleStart,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
