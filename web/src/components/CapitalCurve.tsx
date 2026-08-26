import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import type { CapitalPoint, Currency, Movement } from "../types";
import { buildAreaPath, buildSmoothPath } from "../lib/chartPath";
import { useChartZoomHover } from "../hooks/useChartZoomHover";
import { InfoHint } from "./InfoHint";
import { useI18n, useT } from "../lib/i18n/context";
import type { Language } from "../lib/i18n/context";
import { formatMoney, signedTone } from "../lib/metrics";

type CapitalCurveProps = {
  points: CapitalPoint[];
  currency: Currency;
  movements?: Movement[];
};

export function CapitalCurve({ points, currency, movements = [] }: CapitalCurveProps) {
  const t = useT();
  const { language } = useI18n();
  const width = 760;
  /* Mas alto que ancho de lo que pedia la proporcion original: con 320 la curva se
     aplastaba y las variaciones pequenas no se distinguian. El alto del marco en CSS
     sube en la misma medida, asi que el grafico crece de verdad y no se estira.
     Con la franja de movimientos ocupando 166, hacen falta 560 para que la curva gane
     alto en vez de limitarse a cederselo a la franja. */
  const height = 560;
  /* left algo mas ancho que el resto: ahi viven las etiquetas de precio del eje. */
  const padding = { bottom: 42, left: 62, right: 26, top: 32 };
  const totalPoints = points.length;
  const { activeIndex, frameRef, isZoomed, onPointerMove, reset, setActiveIndex, visibleCount, visibleStart } =
    useChartZoomHover({ chartWidth: width - padding.left - padding.right, paddingLeft: padding.left, totalPoints, width });
  const visiblePoints = points.slice(visibleStart, visibleStart + visibleCount);
  const sortedMovements = [...movements].sort((left, right) => left.date.localeCompare(right.date));
  const visibleMovements = sortedMovements.slice(visibleStart, visibleStart + visiblePoints.length);
  const values = visiblePoints.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  /* Los movimientos viven en su propia franja bajo la curva, no encima. Superpuestos le
     comian hasta un tercio del alto y se peleaban con el relleno; y como su altura era un
     porcentaje del alto del grafico, dependia de cuanto hubiera subido el capital en vez
     de cuanto dinero movio cada uno. Aqui se comparan entre si. */
  const bandHeight = 150;
  const bandGap = 16;
  const chartHeight = height - padding.top - padding.bottom - bandHeight - bandGap;
  const chartBottom = padding.top + chartHeight;
  const bandBaseline = chartBottom + bandGap + bandHeight;
  const step = visiblePoints.length > 1 ? chartWidth / (visiblePoints.length - 1) : 0;
  const scaledPoints = visiblePoints.map((point, index) => ({
    date: point.date,
    value: point.value,
    x: padding.left + index * step,
    y: chartBottom - ((point.value - min) / range) * chartHeight,
  }));
  const path = buildSmoothPath(scaledPoints);
  const lastPoint = visiblePoints.at(-1);
  const lastScaledPoint = scaledPoints.at(-1);
  const firstPoint = visiblePoints.at(0);
  const delta = lastPoint && firstPoint ? lastPoint.value - firstPoint.value : 0;
  const baselineY = chartBottom - ((0 - min) / range) * chartHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  /* Etiquetas del eje de precios: la posicion 0 es la parte de arriba, asi que el valor
     baja de max a min segun se desciende. Dan una referencia de en que rango se mueve la
     curva, que antes no habia en ningun sitio. */
  const axisValues = gridLines.map((position) => ({
    position,
    value: max - position * range,
  }));
  /* Escala lineal a proposito: la altura es directamente proporcional al importe, asi que
     el doble de alto es el doble de dinero. Se probo comprimir con raiz cuadrada para que
     los gastos pequenos (50 frente a retiros de 900, proporcion de 1 a 18) no quedaran en
     unos pocos pixeles, pero deformaba la lectura. Se prefiere fidelidad sobre
     legibilidad: un gasto pequeno se ve pequeno porque lo es. */
  const maxMovementAmount = Math.max(1, ...visibleMovements.map((movement) => movement.amount));
  const movementStep = visibleMovements.length > 1 ? chartWidth / (visibleMovements.length - 1) : 0;
  const eventBars = visibleMovements.map((movement, index) => {
    const barHeight = Math.max(4, (movement.amount / maxMovementAmount) * bandHeight * 0.9);
    return {
      amount: movement.amount,
      date: movement.date,
      kind: movement.kind,
      x: padding.left + index * movementStep,
      y: bandBaseline - barHeight,
      height: barHeight,
    };
  });
  const dateTicks = useMemo(() => buildDateTicks(scaledPoints), [scaledPoints]);
  const safeActiveIndex = activeIndex !== null && activeIndex < scaledPoints.length ? activeIndex : null;
  const activeScaledPoint = safeActiveIndex === null ? null : scaledPoints[safeActiveIndex];
  const activePoint = safeActiveIndex === null ? null : visiblePoints[safeActiveIndex];
  const activeMovement = safeActiveIndex === null ? null : visibleMovements[safeActiveIndex];
  const activeTooltipPosition = activeScaledPoint
    ? {
        left: `${(clamp(activeScaledPoint.x, padding.left + 74, width - padding.right - 74) / width) * 100}%`,
        top: `${(Math.max(padding.top + 72, activeScaledPoint.y - 12) / height) * 100}%`,
      }
    : undefined;

  if (points.length === 0) {
    return (
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("capitalCurve.title")}</h2>
            <p>{t("capitalCurve.emptySubtitle")}</p>
          </div>
        </div>
        <div className="chart-empty">{t("capitalCurve.noData")}</div>
      </section>
    );
  }

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div className="panel-title-row">
          <h2>{t("capitalCurve.title")}</h2>
          <InfoHint
            text={
              isZoomed
                ? `${visiblePoints.length} ${t("common.of")} ${points.length} ${t("capitalCurve.visibleEventsSuffix")}`
                : `${points.length} ${t("capitalCurve.allEventsSuffix")}`
            }
          />
        </div>
        <div className="chart-heading-actions">
          {/* Iba suelto y en color, asi que se confundia con el saldo final que muestra la
              etiqueta del ultimo punto (359,24 de variacion frente a 319,24 de saldo).
              Con rotulo y signo explicito se lee por lo que es. */}
          <span className="chart-delta-block">
            <small>{t("capitalCurve.deltaLabel")}</small>
            <strong className={`chart-delta ${signedTone(delta)}`}>
              {delta > 0 ? "+" : ""}
              {formatMoney(delta, currency)}
            </strong>
          </span>
          {/* Sin lupas: el zoom es con la rueda. Este boton solo aparece con zoom puesto,
              para no dejar sin salida a quien no descubra la rueda. */}
          {isZoomed && (
            <button className="chart-reset-zoom" onClick={reset} type="button">
              <RotateCcw size={13} strokeWidth={2.4} />
              {t("capitalCurve.viewAll")}
            </button>
          )}
        </div>
      </div>
      <div
        className="chart-frame is-interactive"
        role="img"
        aria-label={t("capitalCurve.chartAriaLabel")}
        onDoubleClick={reset}
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={(event) => onPointerMove(event, scaledPoints)}
        ref={frameRef}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="capital-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.34)" />
              <stop offset="68%" stopColor="rgba(139, 92, 246, 0.12)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
            </linearGradient>
          </defs>
          {gridLines.map((position) => {
            const y = padding.top + chartHeight * position;
            return <line className="chart-axis muted" key={`h-${position}`} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
          })}
          {/* Sin lineas verticales: junto con las horizontales de los extremos dibujaban un
              marco rectangular que ensuciaba el grafico. La referencia vertical ya la da la
              guia que sigue al cursor, que aparece solo cuando hace falta. */}
          <line className="chart-axis baseline" x1={padding.left} x2={width - padding.right} y1={baselineY} y2={baselineY} />
          <path className="chart-fill" d={scaledPoints.length ? buildAreaPath(path, scaledPoints[0], scaledPoints.at(-1) || scaledPoints[0], chartBottom) : ""} />
          <line className="chart-axis band-baseline" x1={padding.left} x2={width - padding.right} y1={bandBaseline} y2={bandBaseline} />
          {eventBars.map((bar, index) => (
            <rect
              className={`chart-event-bar ${bar.kind === "income" ? "income" : "expense"} ${activeIndex === index ? "is-active" : ""}`}
              height={bar.height}
              key={`${bar.date}-${bar.kind}-${bar.amount}-${index}`}
              rx="3"
              width="5"
              x={bar.x - 2.5}
              y={bar.y}
            />
          ))}
          <path className="chart-line" d={path} />
          {activeScaledPoint && (
            /* La guia cruza tambien la franja: es lo que ata visualmente el punto de la
               curva con el movimiento que lo provoco, ahora que ya no se solapan. */
            <line
              className="chart-hover-line"
              x1={activeScaledPoint.x}
              x2={activeScaledPoint.x}
              y1={padding.top}
              y2={bandBaseline}
            />
          )}
        </svg>
        {/* Los puntos van en HTML, no como <circle> en el SVG: con preserveAspectRatio
            "none" las escalas X e Y difieren, asi que un circulo salia ovalado (hasta un
            53% mas ancho que alto en paneles anchos). En HTML son circulos de verdad y su
            tamano se fija en pixeles reales, sin depender del ancho del panel. */}
        {lastScaledPoint && (
          <span
            className="chart-dot is-last"
            style={{ left: `${(lastScaledPoint.x / width) * 100}%`, top: `${(lastScaledPoint.y / height) * 100}%` }}
          />
        )}
        {activeScaledPoint && (
          <span
            className="chart-dot is-active"
            style={{ left: `${(activeScaledPoint.x / width) * 100}%`, top: `${(activeScaledPoint.y / height) * 100}%` }}
          />
        )}
        <div className="chart-value-axis" aria-hidden="true">
          {axisValues.map((tick) => (
            <span key={tick.position} style={{ top: `${((padding.top + chartHeight * tick.position) / height) * 100}%` }}>
              {formatCompactValue(tick.value, language)}
            </span>
          ))}
        </div>
        <div className="chart-date-axis" aria-hidden="true">
          {dateTicks.map((tick) => (
            <span key={`${tick.date}-${tick.x}`} style={{ left: `${(tick.x / width) * 100}%` }}>
              {formatShortDate(tick.date, language)}
            </span>
          ))}
        </div>
        {lastScaledPoint && (
          <span
            className={`chart-value-badge ${signedTone(lastPoint?.value || 0)}`}
            style={{ left: `${(lastScaledPoint.x / width) * 100}%`, top: `${(lastScaledPoint.y / height) * 100}%` }}
          >
            {formatMoney(lastPoint?.value || 0, currency)}
          </span>
        )}
        {activeScaledPoint && activePoint && activeTooltipPosition && (
          <div className="chart-hover-card" style={activeTooltipPosition}>
            <span>{formatFullDate(activePoint.date, language)}</span>
            <strong className={signedTone(activePoint.value)}>{formatMoney(activePoint.value, currency)}</strong>
            {activeMovement && (
              <small className={activeMovement.kind === "income" ? "positive" : "negative"}>
                {activeMovement.kind === "income" ? t("capitalCurve.withdrawalIncome") : t("capitalCurve.expense")} {formatMoney(activeMovement.amount, currency)}
              </small>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Formato corto para el eje: en 62px de margen no cabe "1.085,54 US$", y ahi solo hace
 *  falta el orden de magnitud. El importe exacto lo dan el tooltip y la etiqueta final. */
function formatCompactValue(value: number, language: Language) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-ES", {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
    notation: "compact",
  }).format(value);
}

function buildDateTicks(points: Array<{ date: string; x: number }>) {
  if (points.length <= 6) return points;
  const targetIndexes = [0, 0.25, 0.5, 0.75, 1].map((position) => Math.round((points.length - 1) * position));
  return targetIndexes.reduce<Array<{ date: string; x: number }>>((ticks, index) => {
    const point = points[index];
    if (point && !ticks.some((tick) => tick.date === point.date && tick.x === point.x)) ticks.push(point);
    return ticks;
  }, []);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatShortDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { day: "2-digit", month: "short" })
    .format(toLocalDate(date))
    .replace(".", "");
}

function formatFullDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(toLocalDate(date));
}

function toLocalDate(date: string) {
  return new Date(`${date}T12:00:00`);
}
