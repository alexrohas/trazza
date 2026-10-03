import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Dos paginas, un solo build. La landing publica (index.html) y la app React
 * (app/index.html) se sirven del mismo dominio: "/" vende, "/app" trabaja.
 *
 * La entrada de la app esta en app/index.html y no en la raiz para que la ruta del
 * fichero y la de produccion coincidan. Con Vite en modo multipagina, la posicion del
 * html ES la url: el dev server sirve la landing en "/" y la app en "/app/", igual que
 * Vercel despues. Cualquier apaño para tener la app en la raiz en desarrollo rompe esa
 * equivalencia, que es justo lo que evita sorpresas al desplegar.
 *
 * `base` se queda en "/" (el defecto): los dos html cuelgan del mismo dist, asi que
 * comparten dist/assets y las urls absolutas que Vite genera valen para los dos.
 *
 * Las entradas van en ruta relativa a la raiz del proyecto, no con resolve(__dirname):
 * el paquete es "type": "module", asi que __dirname no existe aqui, y la alternativa
 * (fileURLToPath sobre import.meta.url) obliga a añadir @types/node como dependencia
 * solo para que tsconfig.node.json deje pasar este fichero. Vite resuelve las rutas
 * relativas contra `root`, que es exactamente lo que hace falta.
 */

/**
 * En produccion, vercel.json reescribe "/app" (sin barra) a "/app/index.html". El dev
 * server de Vite no hace esa reescritura y sirve la landing en su lugar, asi que los
 * enlaces de la landing (href="/app", "/app?mode=signup") no llevaban a la app en local:
 * pulsar "Entrar" recargaba la propia landing. Esto replica la reescritura de Vercel solo
 * para desarrollo. Es una reescritura interna, no un redirect: la barra de direcciones
 * sigue mostrando "/app" igual que en produccion, y no toca el build.
 */
function appIndexRewrite(): Plugin {
  return {
    name: "trazza-app-index-rewrite",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        /* `req` es Connect.IncomingMessage; este paquete no instala @types/node a
           proposito (ver el comentario de arriba), asi que TS no ve `.url` y se accede
           con un cast a la forma minima que se usa aqui. */
        const withUrl = req as { url?: string };
        const { url } = withUrl;
        /* La calculadora de Lucid es otra pagina con su propio index.html y la misma
           reescritura en vercel.json, asi que pasa por el mismo sitio. */
        for (const page of ["/app", "/calculadora-lucid"]) {
          if (url === page || (url !== undefined && url.startsWith(`${page}?`))) {
            withUrl.url = `${page}/${url.slice(page.length)}`;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), appIndexRewrite()],
  build: {
    rollupOptions: {
      input: {
        landing: "index.html",
        app: "app/index.html",
        calculator: "calculadora-lucid/index.html",
      },
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
  preview: {
    port: 4174,
    strictPort: false,
  },
});
