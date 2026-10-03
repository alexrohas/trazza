/* El tamaño de una cuenta, de texto a numero y de vuelta. Vive aparte de db.ts para que
   el catalogo de firmas (y con el la calculadora publica de Lucid, que no trae nada de
   Supabase) pueda usarlo sin arrastrar todo el acceso a datos. */

/** La vuelta de parseAccountSizeAmount, para el nombre automatico de una cuenta: "25000"
 *  -> "25K". Si ya viene escrito como etiqueta ("25K", "Flex 25K") se respeta tal cual: el
 *  usuario ya eligio como llamarlo. */
export function formatSizeForName(size: string) {
  const raw = size.trim();
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));
  if (!/^[\d.,\s]+$/.test(raw) || !Number.isFinite(numeric) || numeric <= 0) return raw;
  if (numeric >= 1000) {
    const thousands = numeric / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return String(numeric);
}

export function parseAccountSizeAmount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const source = String(value ?? "").trim();
  const match = source.match(/(\d[\d.,]*)\s*([km])?/i);
  if (!match) return 0;

  const numeric = normalizeFlexibleNumber(match[1]);
  const suffix = (match[2] || "").toLowerCase();
  const multiplier = suffix === "m" ? 1000000 : suffix === "k" ? 1000 : 1;

  return numeric * multiplier;
}

function normalizeFlexibleNumber(value: string) {
  const source = value.replace(/[^\d.,-]/g, "");
  const lastComma = source.lastIndexOf(",");
  const lastDot = source.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(source.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma !== -1) {
    const parts = source.split(",");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? source.replaceAll(",", "") : source.replace(",", "."));
  }

  if (lastDot !== -1) {
    const parts = source.split(".");
    const isThousands = parts.length > 1 && parts.at(-1)?.length === 3;
    return Number(isThousands ? source.replaceAll(".", "") : source);
  }

  return Number(source);
}
