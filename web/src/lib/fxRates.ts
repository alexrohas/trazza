/**
 * Cambio oficial del BCE por dia, via Frankfurter (api.frankfurter.dev: gratuito, sin
 * clave y con CORS abierto). Solo se le mandan dos divisas y un rango de fechas, ningun
 * dato del usuario.
 *
 * Es el cambio que pide Hacienda para convertir a euros, asi que la importacion de
 * extractos y un futuro informe fiscal dan la misma cifra.
 *
 * El BCE no publica en fin de semana ni en festivos: esos dias usan el ultimo cambio
 * publicado antes, que es la practica habitual. Por eso el rango se pide con una semana
 * de margen por delante.
 */

const cache = new Map<string, Promise<Map<string, number>>>();

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function fetchRange(from: string, to: string, start: string, end: string) {
  const response = await fetch(`https://api.frankfurter.dev/v1/${start}..${end}?base=${from}&symbols=${to}`);
  if (!response.ok) throw new Error(`fx ${response.status}`);
  const body = (await response.json()) as { rates?: Record<string, Record<string, number>> };
  const rates = new Map<string, number>();
  Object.entries(body.rates || {}).forEach(([date, values]) => {
    if (typeof values[to] === "number") rates.set(date, values[to]);
  });
  return rates;
}

/**
 * Devuelve una funcion que da el cambio de `from` a `to` para cada fecha (undefined si no
 * hay ninguno publicado antes). Si las dos divisas son la misma no hace ninguna llamada.
 */
export async function loadEcbRates(from: string, to: string, dates: string[]): Promise<(date: string) => number | undefined> {
  if (from === to || !dates.length) return () => 1;
  const sorted = [...dates].sort();
  const start = shiftDate(sorted[0], -7);
  const end = sorted[sorted.length - 1];
  const key = `${from}-${to}-${start}-${end}`;
  if (!cache.has(key)) {
    const request = fetchRange(from, to, start, end);
    /* Un fallo no se queda cacheado: el siguiente intento vuelve a llamar. */
    request.catch(() => cache.delete(key));
    cache.set(key, request);
  }
  const rates = await cache.get(key)!;
  const published = [...rates.keys()].sort();

  return (date: string) => {
    let found: number | undefined;
    for (const day of published) {
      if (day > date) break;
      found = rates.get(day);
    }
    return found;
  };
}
