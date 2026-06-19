import { useMemo, useState, type PointerEvent } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { CapitalPoint, Currency, Movement } from "../types";
import { buildAreaPath, buildSmoothPath } from "../lib/chartPath";
import { formatMoney, signedTone } from "../lib/metrics";

type CapitalCurveProps = {
  points: CapitalPoint[];
  currency: Currency;
  movements?: Movement[];
};

const MAX_ZOOM_LEVEL = 3;

export function CapitalCurve({ points, currency, movements = [] }: CapitalCurveProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0);
  const width = 760;
  const height = 320;
  const padding = { bottom: 42, left: 48, right: 26, top: 32 };
  const visibleCount = getVisibleCount(points.length, zoomLevel);
  const visibleStart = Math.max(0, points.length - visibleCount);
  const visiblePoints = points.slice(visibleStart);
  const sortedMovements = [...movements].sort((left, right) => left.date.localeCompare(right.date));
  const visibleMovements = sortedMovements.slice(visibleStart, visibleStart + visiblePoints.length);
  const values = visiblePoints.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const step = visiblePoints.length > 1 ? chartWidth / (visiblePoints.length - 1) : 0;
  const scaledPoints = visiblePoints.map((point, index) => ({
    date: point.date,
    value: point.value,
    x: padding.left + index * step,
    y: height - padding.bottom - ((point.value - min) / range) * chartHeight,
  }));
  const path = buildSmoothPath(scaledPoints);
  const lastPoint = visiblePoints.at(-1);
  const lastScaledPoint = scaledPoints.at(-1);
  const firstPoint = visiblePoints.at(0);
  const delta = lastPoint && firstPoint ? lastPoint.value - firstPoint.value : 0;
  const baselineY = height - padding.bottom - ((0 - min) / range) * chartHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const verticalLines = [0, 0.25, 0.5, 0.75, 1];
  const maxMovementAmount = Math.max(1, ...visibleMovements.map((movement) => movement.amount));
  const movementStep = visibleMovements.length > 1 ? chartWidth / (visibleMovements.length - 1) : 0;
  const eventBars = visibleMovements.map((movement, index) => {
    const barHeight = Math.max(7, Math.min(chartHeight * 0.34, (movement.amount / maxMovementAmount) * chartHeight * 0.34));
    return {
      amount: movement.amount,
      date: movement.date,
      kind: movement.kind,
      x: padding.left + index * movementStep,
      y: baselineY - barHeight,
      height: barHeight,
    };
  });
  const dateTicks = useMemo(() => buildDateTicks(scaledPoints), [scaledPoints]);
  const safeActiveIndex = activeIndex !== null && activeIndex < scaledPoints.length ? activeIndex : null;
  const activeScaledPoint = safeActiveIndex === null ? null : scaledPoints[safeActiveIndex];
  const activePoint = safeActiveIndex === null ? null : visiblePoints[safeActiveIndex];
  const activeMovement = safeActiveIndex === null ? null : visibleMovements[safeActiveIndex];
  const nextVisibleCount = getVisibleCount(points.length, zoomLevel + 1);
  const canZoomIn = points.length > 3 && zoomLevel < MAX_ZOOM_LEVEL && nextVisibleCount < visibleCount;
  const canZoomOut = zoomLevel > 0;
  const zoomLabel = zoomLevel === 0 ? "Todo" : `${visiblePoints.length}/${points.length}`;
  const activeTooltipPosition = activeScaledPoint
    ? {
        left: `${(clamp(activeScaledPoint.x, padding.left + 74, width - padding.right - 74) / width) * 100}%`,
        top: `${(Math.max(padding.top + 72, activeScaledPoint.y - 12) / height) * 100}%`,
      }
    : undefined;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!scaledPoints.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * width;
    const nearestIndex = scaledPoints.reduce((nearest, point, index) => {
      const currentDistance = Math.abs(point.x - pointerX);
      const nearestDistance = Math.abs(scaledPoints[nearest].x - pointerX);
      return currentDistance < nearestDistance ? index : nearest;
    }, 0);
    setActiveIndex(nearestIndex);
  };

  const updateZoom = (nextZoomLevel: number) => {
    setActiveIndex(null);
    setZoomLevel(clamp(nextZoomLevel, 0, MAX_ZOOM_LEVEL));
  };

  if (points.length === 0) {
    return (
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Evolucion de capital</h2>
            <p>Sin movimientos todavia.</p>
          </div>
        </div>
        <div className="chart-empty">No hay datos suficientes</div>
      </section>
    );
  }

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Evolucion de capital</h2>
          <p>
            {zoomLevel > 0
              ? `${visiblePoints.length} de ${points.length} eventos visibles.`
              : `${points.length} eventos financieros en el filtro actual.`}
          </p>
        </div>
        <div className="chart-heading-actions">
          <strong className={`chart-delta ${signedTone(delta)}`}>{formatMoney(delta, currency)}</strong>
          <div className="chart-zoom-controls" aria-label="Zoom del grafico">
            <button className="icon-control compact-icon" disabled={!canZoomOut} onClick={() => updateZoom(zoomLevel - 1)} title="Alejar" type="button">
              <ZoomOut size={15} strokeWidth={2.25} />
            </button>
            <span>{zoomLabel}</span>
            <button className="icon-control compact-icon" disabled={!canZoomIn} onClick={() => updateZoom(zoomLevel + 1)} title="Acercar" type="button">
              <ZoomIn size={15} strokeWidth={2.25} />
            </button>
            <button className="icon-control compact-icon" disabled={zoomLevel === 0} onClick={() => updateZoom(0)} title="Ver todo" type="button">
              <RotateCcw size={15} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
      <div
        className="chart-frame is-interactive"
        role="img"
        aria-label="Grafico de evolucion de capital"
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={handlePointerMove}
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
          {verticalLines.map((position) => {
            const x = padding.left + chartWidth * position;
            return <line className="chart-axis vertical" key={`v-${position}`} x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} />;
          })}
          <line className="chart-axis baseline" x1={padding.left} x2={width - padding.right} y1={baselineY} y2={baselineY} />
          <path className="chart-fill" d={scaledPoints.length ? buildAreaPath(path, scaledPoints[0], scaledPoints.at(-1) || scaledPoints[0], height - padding.bottom) : ""} />
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
            <line
              className="chart-hover-line"
              x1={activeScaledPoint.x}
              x2={activeScaledPoint.x}
              y1={padding.top}
              y2={height - padding.bottom}
            />
          )}
          {scaledPoints.length <= 12 &&
            scaledPoints.map((point, index) => <circle className="chart-point is-muted" key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="3.5" />)}
          {activeScaledPoint && <circle className="chart-point is-active" cx={activeScaledPoint.x} cy={activeScaledPoint.y} r="4.6" />}
          {lastScaledPoint && <circle className="chart-point is-last" cx={lastScaledPoint.x} cy={lastScaledPoint.y} r="5.2" />}
        </svg>
        <div className="chart-date-axis" aria-hidden="true">
          {dateTicks.map((tick) => (
            <span key={`${tick.date}-${tick.x}`} style={{ left: `${(tick.x / width) * 100}%` }}>
              {formatShortDate(tick.date)}
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
            <span>{formatFullDate(activePoint.date)}</span>
            <strong className={signedTone(activePoint.value)}>{formatMoney(activePoint.value, currency)}</strong>
            {activeMovement && (
              <small className={activeMovement.kind === "income" ? "positive" : "negative"}>
                {activeMovement.kind === "income" ? "Retiro / ingreso" : "Gasto"} {formatMoney(activeMovement.amount, currency)}
              </small>
            )}
          </div>
        )}
      </div>
      <div className="chart-footer">
        <span>{visiblePoints[0]?.date}</span>
        <span>{lastPoint ? formatMoney(lastPoint.value, currency) : formatMoney(0, currency)}</span>
        <span>{lastPoint?.date}</span>
      </div>
    </section>
  );
}

function getVisibleCount(total: number, zoomLevel: number) {
  const ratios = [1, 0.72, 0.5, 0.34];
  const ratio = ratios[clamp(zoomLevel, 0, MAX_ZOOM_LEVEL)] || 1;
  return Math.min(total, Math.max(3, Math.ceil(total * ratio)));
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

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" })
    .format(toLocalDate(date))
    .replace(".", "");
}

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(toLocalDate(date));
}

function toLocalDate(date: string) {
  return new Date(`${date}T12:00:00`);
}
