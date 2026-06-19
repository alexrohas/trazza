export type SvgPoint = {
  x: number;
  y: number;
};

export function buildSmoothPath(points: SvgPoint[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${format(points[0].x)} ${format(points[0].y)}`;

  const segments = [`M ${format(points[0].x)} ${format(points[0].y)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;

    const controlOne = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const controlTwo = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };

    segments.push(
      `C ${format(controlOne.x)} ${format(controlOne.y)} ${format(controlTwo.x)} ${format(controlTwo.y)} ${format(next.x)} ${format(next.y)}`,
    );
  }

  return segments.join(" ");
}

export function buildAreaPath(linePath: string, first: SvgPoint, last: SvgPoint, baselineY: number) {
  if (!linePath) return "";
  return `${linePath} L ${format(last.x)} ${format(baselineY)} L ${format(first.x)} ${format(baselineY)} Z`;
}

export function format(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0";
}
