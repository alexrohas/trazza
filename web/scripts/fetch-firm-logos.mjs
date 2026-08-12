/**
 * Descarga el mejor logo disponible de cada prop firm y lo deja listo en
 * src/assets/firm-logos/, con el nombre que espera el resolutor de logos.
 *
 *   node scripts/fetch-firm-logos.mjs            # descarga las que falten
 *   node scripts/fetch-firm-logos.mjs --force    # vuelve a bajar las que ya existan
 *   node scripts/fetch-firm-logos.mjs --dry      # solo dice que encontraria
 *
 * No usa dependencias: fetch va incluido en Node 18 en adelante.
 *
 * Edita FIRMS para anadir o quitar empresas. La clave es el nombre tal y como lo tienes
 * dado de alta en Trazza, porque de ahi sale el nombre del archivo.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FIRMS = {
  Apex: "apextraderfunding.com",
  "The5ers": "the5ers.com",
  "Alpha Capital": "alphacapitalgroup.uk",
  "Alpha Futures": "alphafutures.com",
  "Goat Funded": "goatfundedtrader.com",
  // Anade aqui las demas: "Nombre en Trazza": "dominio.com",
};

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/assets/firm-logos");
const TIMEOUT_MS = 12000;
const MAX_BYTES = 2 * 1024 * 1024;
/* Por debajo de esto se ve borroso en el cuadro de 42px en pantallas de alta densidad. */
const MIN_RASTER_SIZE = 84;

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry");

function slugify(value) {
  return value.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Devuelve {status, text|buffer} o {status: 0} si ni siquiera hubo respuesta. El estado
 *  se conserva porque un 403 y una caida piden acciones distintas por parte de quien
 *  ejecuta el script. */
async function get(url, asBuffer = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; TrazzaLogoFetcher/1.0)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return { status: response.status };
    if (asBuffer) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) return { status: response.status };
      return { buffer, status: response.status, type: response.headers.get("content-type") || "" };
    }
    return { status: response.status, text: await response.text() };
  } catch {
    return { status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dimensiones reales leidas del propio archivo, que ademas sirven para confirmar que lo
 * descargado es una imagen. Hace falta comprobarlo: muchas webs responden 200 con su
 * HTML a rutas que no existen (/favicon.svg en una SPA), y fiarse del content-type o de
 * la extension de la URL acababa guardando paginas web con extension .svg.
 */
function readImageSize(buffer, ext) {
  if (ext === "png") {
    if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return undefined;
    return { height: buffer.readUInt32BE(20), width: buffer.readUInt32BE(16) };
  }
  if (ext === "svg") {
    const text = buffer.toString("utf8", 0, 4096).trimStart();
    if (!/^(<\?xml|<svg|<!--)/i.test(text) || /<!DOCTYPE html/i.test(text)) return undefined;
    const viewBox = text.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
    if (viewBox) return { height: Number(viewBox[2]), width: Number(viewBox[1]) };
    return { height: 0, width: 0 };
  }
  if (ext === "jpg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 ? { height: 0, width: 0 } : undefined;
  }
  if (ext === "webp") {
    return buffer.length > 12 && buffer.toString("ascii", 8, 12) === "WEBP" ? { height: 0, width: 0 } : undefined;
  }
  return undefined;
}

function extensionFor(url, contentType) {
  if (/svg/i.test(contentType) || /\.svg(\?|$)/i.test(url)) return "svg";
  if (/webp/i.test(contentType) || /\.webp(\?|$)/i.test(url)) return "webp";
  if (/png/i.test(contentType) || /\.png(\?|$)/i.test(url)) return "png";
  if (/jpe?g/i.test(contentType) || /\.jpe?g(\?|$)/i.test(url)) return "jpg";
  return undefined;
}

/**
 * Candidatos ordenados de mejor a peor. El SVG gana siempre porque no pierde nitidez;
 * despues el icono de app, que suele ser de 180px; el og:image va al final porque a
 * menudo es una captura promocional y no el logo.
 */
function findCandidates(html, origin) {
  const candidates = [];
  const push = (href, rank) => {
    if (!href) return;
    try {
      candidates.push({ rank, url: new URL(href, origin).href });
    } catch {
      /* href malformado: se ignora */
    }
  };

  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of links) {
    const rel = (tag.match(/rel=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    if (rel.includes("apple-touch-icon")) push(href, 2);
    else if (rel.includes("icon")) push(href, /\.svg(\?|$)/i.test(href) ? 1 : 3);
  }

  const og = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0];
  push(og?.match(/content=["']([^"']+)["']/i)?.[1], 4);

  push("/favicon.svg", 1);
  push("/apple-touch-icon.png", 2);
  push("/favicon.ico", 5);

  const seen = new Set();
  return candidates
    .sort((a, b) => a.rank - b.rank)
    .filter((c) => (seen.has(c.url) ? false : seen.add(c.url)));
}

async function fetchLogo(name, domain, existing) {
  const slug = slugify(name);
  if (!force && existing.has(slug)) return { estado: "ya existe", empresa: name };

  const origin = `https://${domain}`;
  const page = await get(origin);
  if (!page.text) {
    /* 403 y 429 son proteccion antibot, no una web caida: desde un navegador normal el
       logo se descarga sin problema. No se intenta esquivar. */
    const estado = page.status === 403 || page.status === 429 ? "bloquea el script" : "web inaccesible";
    return { empresa: name, estado, aviso: page.status ? `HTTP ${page.status}` : "sin respuesta" };
  }

  /* Se evaluan todos los candidatos en vez de quedarse con el primero que sirva: la
     mayoria de firmas publican el logotipo apaisado (789x200 en FTMO), y en un cuadro de
     42px eso queda a 8px de alto, ilegible. Se penaliza la proporcion para preferir la
     version cuadrada, que casi siempre existe como icono de app. */
  let best;
  for (const candidate of findCandidates(page.text, origin)) {
    const ext = extensionFor(candidate.url, "");
    if (ext === undefined && !/favicon|icon|logo/i.test(candidate.url)) continue;

    const asset = await get(candidate.url, true);
    if (!asset.buffer) continue;
    const realExt = extensionFor(candidate.url, asset.type);
    /* El .ico se descarta: el navegador no lo escala bien en un <img> de 42px. */
    if (!realExt) continue;

    const size = readImageSize(asset.buffer, realExt);
    if (!size) continue;

    const ratio = size.width && size.height ? Math.max(size.width / size.height, size.height / size.width) : 1;
    const score = candidate.rank + (ratio > 1.4 ? ratio * 2 : 0);
    if (!best || score < best.score) best = { asset, ext: realExt, ratio, score, size, url: candidate.url };
    if (score <= 1) break;
  }

  if (!best) return { estado: "sin logo utilizable", empresa: name };

  const avisos = [];
  if (best.size.width && best.size.width < MIN_RASTER_SIZE && best.ext !== "svg") avisos.push(`pequeno (${best.size.width}px)`);
  if (best.ratio > 1.8) avisos.push(`apaisado ${best.ratio.toFixed(1)}:1, se vera bajito`);

  if (!dryRun) await writeFile(resolve(OUT_DIR, `${slug}.${best.ext}`), best.asset.buffer);
  return {
    archivo: `${slug}.${best.ext}`,
    aviso: avisos.join(" / "),
    empresa: name,
    estado: dryRun ? "encontrado" : "descargado",
    origen: best.url,
  };
}

await mkdir(OUT_DIR, { recursive: true });
const existing = new Set(
  (await readdir(OUT_DIR))
    .filter((file) => /\.(svg|png|webp|jpe?g)$/i.test(file))
    .map((file) => slugify(file.replace(/\.[^.]+$/, ""))),
);

const results = [];
for (const [name, domain] of Object.entries(FIRMS)) {
  const result = await fetchLogo(name, domain, existing);
  results.push(result);
  const detalle = [result.archivo, result.aviso && `AVISO: ${result.aviso}`].filter(Boolean).join("  ");
  console.log(`${result.estado.padEnd(20)} ${result.empresa.padEnd(18)} ${detalle}`);
}

const bloqueadas = results.filter((r) => r.estado === "bloquea el script");
const fallos = results.filter((r) => r.estado === "web inaccesible" || r.estado === "sin logo utilizable");
console.log(`\n${results.length - fallos.length - bloqueadas.length} de ${results.length} resueltas.`);
if (bloqueadas.length) {
  console.log(`\nBloquean peticiones automaticas: ${bloqueadas.map((r) => r.empresa).join(", ")}`);
  console.log("Esas se descargan bien desde el navegador: abre su web, clic derecho en el");
  console.log("logo, Inspeccionar, y guarda el archivo con el nombre de la empresa.");
}
if (fallos.length) {
  console.log(`\nSin resolver: ${fallos.map((r) => r.empresa).join(", ")}`);
  console.log("Revisa que el dominio sea correcto o busca el logo a mano.");
}
if (!dryRun) console.log(`\nCarpeta: ${OUT_DIR}`);
