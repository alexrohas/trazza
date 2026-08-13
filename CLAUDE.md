# Trazza — contexto para retomar en otra máquina

Journal + dashboard de finanzas para traders de prop firms (~40 usuarios reales en
producción). Este archivo existe porque el trabajo se retoma en un Mac nuevo sin el
historial de conversación anterior — léelo entero antes de tocar nada.

## Las dos apps, un solo Supabase

- **Legado** (`app.html` + `app.js` + `styles.css`, JS vanilla, sin build): lo que sirve
  `trazzajournal.com` hoy. Estable, con los 40 usuarios reales encima.
- **React** (`web/`, Vite + TS): reescritura en curso, es donde está todo el trabajo
  reciente. `cd web && pnpm install && pnpm dev` (puerto 5174, ver `.claude/launch.json`).
  `pnpm typecheck` antes de dar nada por bueno — no hay tests, typecheck es la única red.

Ambas comparten las mismas tablas de Supabase (`firms`, `accounts`, `transactions`,
`journal_entries`, `journal_error_types`, `subscriptions`). Eso importa para cualquier
cambio de esquema: lo que se toque en SQL lo ven las dos apps a la vez.

`web/.env.local` no viaja con git (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) —
cópialo de la máquina anterior o pídelo.

**El proyecto se trabaja en dos máquinas: un Mac y un PC con Windows.** Por eso
`.claude/launch.json` tiene dos configuraciones y hay que elegir la de la máquina en la
que estés: `trazza-web-mac` y `trazza-web-windows`. En Windows basta con invocar `pnpm`
directamente, pero en el Mac no: el lanzador ejecuta el binario sin pasar por un shell
de login, y allí Node vive en `~/.local/node` exportado desde `~/.zshenv`, así que sin
`zsh -lc` no lo encuentra. No unifiques las dos en una: arreglar una rompe la otra.

Aviso relacionado para el Mac: si dentro de una sesión ya arrancada sale
`node: command not found`, no es que falte Node — es que ese shell se inicializó antes
de que existiera el `.zshenv`. Antepón
`export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm:$PATH"` en la propia llamada.

## Qué está cerrado

**Monetización con Stripe**, sobre el legado: trial de 14 días, checkout mensual/anual,
webhook, portal de facturación, paywall, bloqueo de solo-lectura al expirar, borrado de
cuenta autoservicio. Todo desplegado y verificado con dinero real. Precio actual:
**4,99 €/mes, 42 €/año** (bajado desde 6,99/59 — el anual se recalculó para que la
insignia "Ahorra 30%" siguiera siendo cierta, no es casualidad que dé 42).

El cambio de precio quedó **cerrado el 13 de agosto de 2026**: precios nuevos creados en
Stripe, `STRIPE_PRICE_MONTHLY` y `STRIPE_PRICE_ANNUAL` apuntando a ellos, y verificado
con un checkout real (sale 4,99). El trial de 14 días **no vive en Stripe** — lo crea el
trigger de `supabase-subscriptions.sql`, y el checkout no manda `trial_period_days`; si
algún día se añade un periodo de prueba a un precio de Stripe, se sumarían los dos.

El dashboard de Stripe quedó ordenado en la misma sesión: 4,99 es el precio
"Predeterminado" del producto, y los dos viejos (6,99 y 59) están archivados. La única
suscripción que colgaba del 6,99 era de prueba, así que no hubo que migrar a nadie —
no queda ningún suscriptor en precios antiguos.

**React, pulido visual — hecho pantalla a pantalla**: Login, Ajustes, Panel (dashboard),
Empresas, Cuentas. Cada una se llevó varias iteraciones de feedback visual real contra
capturas; no son cambios cosméticos superficiales, resuelven cosas concretas (ver
"Trampas ya pisadas" abajo).

## Qué queda

Del plan original, lo único abierto de peso: **Cuentas — enlazar evaluación con
fondeada**. Hoy una cuenta que pasa de evaluación a fondeada es una fila nueva sin
relación con la anterior en el modelo de datos, y eso obliga a nombrarlas a mano para
compensar ("[ALPHA] 25K FUNDED" mete la empresa y el estado en el texto libre porque no
hay dónde más ponerlos). Ya se resolvieron el nombre automático y que las cuentas
terminadas muestren su desenlace en vez de límites que ya no rigen; enlazar la sucesión
en sí es lo que falta y **toca el esquema de Supabase con producción debajo**, así que
antes de tocarlo: mirar bien qué migración hace falta, probarla contra una cuenta de
prueba primero.

Pantallas de React sin pulir todavía: **Movimientos** y **Journal** (el Journal es la más
grande y compleja, dejarla para el final).

Cabos sueltos de bajo impacto, arrástralos si tocas esos archivos pero no merece una
sesión aparte: `AccountHealth.tsx` y `JournalPanel.tsx` no se importan en ningún sitio
(código muerto); `lib/metrics.ts` tiene un par de fallbacks sin traducir ("Sin tamaño",
"Sin cuenta").

## Trampas ya pisadas — no las repitas

Cada una de estas costó una ronda de depuración real. Están aquí para que la próxima
sesión no vuelva a pisarlas.

- **`fill-mode: both` en animaciones de entrada rompe cosas no obvias.** Deja un
  `transform` residual (aunque sea la identidad) que crea contexto de apilado: eso
  metió desplegables por detrás de tarjetas y modales midiendo la página entera en vez
  de la ventana. Usa `backwards`, nunca `both`. Ver el comentario grande al principio de
  la sección MOTION en `styles.css`.
- **`min-width: 0` hace falta en cualquier envoltorio de campo de formulario metido en
  una rejilla.** Sin él, un contenido largo ("General / sin empresa") desborda su
  columna y desalinea toda la fila. Afectó a `.custom-select` y `.date-picker`; si se
  añade un componente de formulario nuevo, ponlo desde el principio.
- **Modales van en portal (`createPortal` sobre `document.body`), no inline.** Si un
  ancestro lleva `transform` (cualquier animación de entrada), un modal `position:fixed`
  dentro de él deja de medir el viewport y mide el ancestro.
- **Los temas van en pares.** Cualquier token de color nuevo necesita su valor en
  `:root` y en `:root[data-theme="dark"]`. Ya pasó que un fondo neutro se veía casi
  negro en oscuro (la placa de los logos de empresa) por usar `var(--surface-muted)` sin
  comprobar el tema oscuro primero.
- **`useGrouping` está tipado como booleano** en la versión de TS de este proyecto, no
  acepta `"always"` aunque el runtime sí lo soporte. Usa `true` — da el mismo resultado.
- **El español omite el separador de miles en números de 4 cifras** (`5000,00`, no
  `5.000,00`). Correcto al escribir, malo en una columna de importes. `formatMoney` ya
  fuerza `useGrouping: true` para evitarlo — no lo quites.
- **`i18n/es.ts` y `en.ts` tienen que tener las mismas claves siempre.** Verificación
  rápida antes de cualquier commit que toque textos:
  ```bash
  node -e "
  const es=require('fs').readFileSync('web/src/lib/i18n/es.ts','utf8').match(/\"[a-zA-Z.]+\":/g)||[];
  const en=require('fs').readFileSync('web/src/lib/i18n/en.ts','utf8').match(/\"[a-zA-Z.]+\":/g)||[];
  const a=new Set(es),b=new Set(en);
  console.log(a.size,'/',b.size,'| desajustes:',[...a].filter(k=>!b.has(k)).concat([...b].filter(k=>!a.has(k))));"
  ```
- **Al borrar un componente/prop, busca claves de i18n que se queden huérfanas** y
  bórralas de los dos idiomas a la vez — se han acumulado varias por descuido.

## Componentes propios que sustituyen a nativos

Tres controles del navegador no admiten estilos porque no los pinta la página: la lista
del `<select>`, el calendario de `<input type="date">`, el tooltip de `title`. Hay
sustitutos propios — reutilízalos, no vuelvas a picar nativo:

- `Select.tsx` — desplegable con panel propio.
- `DatePicker.tsx` — calendario propio. Prop `clearable={false}` para los campos
  `required` (no hay validación nativa que lo sujete si no).
- `Combobox.tsx` — como `Select` pero admite texto libre además de sugerencias (usado en
  el nombre de empresa: sugiere firmas conocidas, no obliga a elegir de una lista).
- `InfoHint.tsx` — tooltip propio con icono de información.
- `FilterToggle.tsx` — botón que pliega/despliega un bloque de filtros.

Todos comparten lenguaje visual con `var(--shadow)` (el token minimalista de la app, no
inventes sombras nuevas) y viven en `web/src/components/`.

## Cómo se ha estado trabajando (para mantener el ritmo)

- El usuario da feedback visual mirando capturas reales, no descripciones — cuando algo
  "no se ve bien", conviene verificarlo con medición real (inyección de DOM contra la
  hoja de estilos viva, `getBoundingClientRect`) antes de decir que está arreglado, no
  fiarse de que el CSS "debería" funcionar.
- Los commits van agrupados por qué cuentan, no por orden cronológico — cuando el
  trabajo mezcla features distintas en los mismos archivos, merece la pena separar por
  parche antes de comitear (`git apply --cached` con un patch recortado a mano) en vez
  de meterlo todo junto. Cada commit debe compilar por sí solo (`pnpm typecheck` antes
  de comitear, no solo al final).
- git: local manda sobre origin, push normal sin `--force` salvo que se pida explícito.
- Antes de tocar el precio, la copia legal o cualquier texto contractual: son
  `legal.html` y compañía, ese texto es lo que ve un usuario de pago — cambios ahí no
  son solo estéticos.
