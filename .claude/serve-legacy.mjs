// Servidor estatico minimo para previsualizar la app legada (app.html + app.js + styles.css),
// que no tiene build ni dev server propio. Solo para desarrollo local: sirve la raiz del repo
// en http://localhost:5178 y nada mas.
//
// La raiz se resuelve desde la ruta de este fichero y no desde process.cwd() a proposito: el
// lanzador de .claude/launch.json arranca el proceso sin un cwd utilizable en el Mac.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const PORT = Number(process.env.PORT || 5178);

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const filePath = normalize(join(ROOT, requestPath === "/" ? "/app.html" : requestPath));

  if (!filePath.startsWith(ROOT + sep)) {
    response.statusCode = 403;
    response.end("403");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.setHeader("content-type", MIME[extname(filePath)] || "application/octet-stream");
    response.setHeader("cache-control", "no-store");
    response.end(file);
  } catch {
    response.statusCode = 404;
    response.end("404");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Legado servido en http://localhost:${PORT} (raiz: ${ROOT})`);
});
