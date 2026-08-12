/**
 * Logos de empresas servidos desde el propio proyecto, no desde un servicio externo.
 *
 * Se descubren solos: basta con dejar el archivo en src/assets/firm-logos/ y Vite lo
 * recoge al compilar. No hay ningun registro que mantener en paralelo, ni peticiones a
 * terceros (que ademas les revelarian que prop firms usa cada usuario), ni respuestas
 * 404 por cada empresa sin logo.
 *
 * El nombre del archivo es lo que empareja: apex.svg cubre "Apex", y alpha-futures.png
 * cubre "Alpha Futures". Mayusculas, espacios, guiones y acentos dan igual, porque
 * ambos lados se normalizan antes de comparar.
 */
const modules = import.meta.glob("../assets/firm-logos/*.{svg,png,webp,jpg,jpeg}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const logosBySlug = new Map<string, string>();
const duplicates = new Map<string, string[]>();
for (const [path, url] of Object.entries(modules)) {
  const fileName = path.split("/").pop() ?? "";
  const slug = slugify(fileName.replace(/\.[^.]+$/, ""));
  if (!slug) continue;
  if (logosBySlug.has(slug)) duplicates.set(slug, [...(duplicates.get(slug) ?? []), fileName]);
  logosBySlug.set(slug, url);
}

/* Dos archivos con el mismo nombre y distinta extension (apex.png y apex.jpeg) compiten
   por la misma empresa, y gana el ultimo por orden alfabetico, que no tiene por que ser
   el bueno: al sustituir un logo apaisado por su version cuadrada sin borrar el viejo,
   seguia mostrandose el viejo sin que nada lo indicara. */
if (import.meta.env.DEV && duplicates.size) {
  duplicates.forEach((files, slug) => {
    console.warn(`[firmLogos] Hay varios logos para "${slug}": ${files.join(", ")}. Deja solo uno.`);
  });
}

/** Longitud minima para el emparejamiento por prefijo: sin ella, un archivo suelto de
 *  dos letras se colaria en media lista de empresas. */
const MIN_PREFIX_LENGTH = 3;

export function getFirmLogo(name: string) {
  const slug = slugify(name);
  if (!slug) return undefined;

  const exact = logosBySlug.get(slug);
  if (exact) return exact;

  /* Prefijo mas largo, no el primero que encaje: si conviven apex.svg y
     apextraderfunding.svg, "Apex Trader Funding" debe quedarse con el especifico. */
  let best: { length: number; url: string } | undefined;
  logosBySlug.forEach((url, key) => {
    if (key.length < MIN_PREFIX_LENGTH || !slug.startsWith(key)) return;
    if (!best || key.length > best.length) best = { length: key.length, url };
  });
  return best?.url;
}

/**
 * Nombre bonito de cada firma conocida, para sugerirlo al dar de alta una empresa.
 *
 * La clave es el mismo slug que sale del nombre del archivo del logo, asi que la lista
 * de sugerencias se deriva de los logos que existen de verdad: no hay dos listas que
 * mantener sincronizadas, y no se sugiere una firma cuyo logo no tenemos.
 *
 * Al anadir un logo nuevo, anade aqui su nombre. Si se te olvida no se rompe nada: el
 * logo seguira funcionando, simplemente esa firma no aparecera entre las sugerencias.
 */
const FIRM_DISPLAY_NAMES: Record<string, string> = {
  alphacapital: "Alpha Capital",
  alphafutures: "Alpha Futures",
  apex: "Apex",
  ftmo: "FTMO",
  fundednext: "FundedNext",
  fundingpips: "Funding Pips",
  goatfunded: "Goat Funded",
  lucid: "Lucid",
  myfundedfutures: "MyFundedFutures",
  takeprofit: "Take Profit Trader",
  the5ers: "The5ers",
  topstep: "Topstep",
  tradeify: "Tradeify",
  wallstreetfunded: "Wall Street Funded",
};

/** Firmas sugeribles: solo las que tienen logo Y nombre declarado, en orden alfabetico. */
export function getKnownFirmNames() {
  return [...logosBySlug.keys()]
    .map((slug) => FIRM_DISPLAY_NAMES[slug])
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right));
}
