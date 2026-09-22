# Trazza — contexto para retomar en otra máquina

Journal + dashboard de finanzas para traders de prop firms (~40 usuarios reales en
producción). Este archivo existe porque el trabajo se retoma en un Mac nuevo sin el
historial de conversación anterior — léelo entero antes de tocar nada.

## Qué sirve el dominio (cambió el 7 de septiembre de 2026)

`trazzajournal.com` sirve **el build de React**, no el legado. Dos páginas, un solo
build de Vite desde `web/`:

| URL | Fichero | Qué es |
|---|---|---|
| `/` | `web/index.html` | Landing pública |
| `/app` | `web/app/index.html` | App React (SPA) |
| `/legal.html` | `web/public/legal.html` | Aviso legal, privacidad, cookies, términos |

`/app.html` **redirige a `/app`** (307, temporal a propósito) para que no se rompan los
marcadores de los 40 usuarios ni las URLs de retorno de Stripe antiguas. No lo pases a
301 sin pensarlo: un 301 se cachea en el navegador para siempre y deja de haber vuelta
atrás.

Todo esto vive en `vercel.json` (raíz), que además fija `buildCommand` e
`outputDirectory`. **Antes Vercel servía la raíz del repo tal cual**, sin build: eso
significaba que `trazzajournal.com/supabase-rls.sql` y compañía se descargaban en abierto
(comprobado con `curl`, devolvía 200). Al pasar a servir solo `web/dist` esa exposición
desaparece — no la reintroduzcas moviendo el `outputDirectory` a la raíz.

Reglas de Vercel que conviene tener presentes al tocar `vercel.json`: el orden es
**redirects → sistema de ficheros → rewrites**, así que un rewrite nunca tapa un fichero
que exista de verdad (por eso `/app/:path*` no rompe `/assets/...`). Y `vercel.json` es
JSON estricto: no admite comentarios, de ahí que el porqué esté aquí y no allí.

**Los comandos entran en `web/` con `cd` y llaman a `corepack pnpm`, no a `pnpm` a
secas.** No es cosmético: el primer intento usaba `pnpm --dir web` desde la raíz y el
build murió con *"Ignoring not compatible lockfile"* → *"Headless installation requires a
pnpm-lock.yaml file"*. Vercel elige la versión de pnpm mirando el lockfile **del
directorio raíz**, y ahí no hay ninguno (el nuestro vive en `web/`), así que arrancaba un
pnpm antiguo que no entiende `lockfileVersion: 9.0`. Con `cd web` primero, corepack lee
el `packageManager` de `web/package.json` y usa la versión exacta — y así la versión no
queda duplicada en `vercel.json`, que se desincronizaría a la primera. Si algún día
mueves el lockfile o cambias de gestor, esto es lo primero que hay que revisar.

Si hace falta volver atrás de urgencia, lo rápido no es git: es **hacer rollback al
despliegue anterior desde el panel de Vercel**, que reactiva el legado tal cual estaba.

## Las dos apps, un solo Supabase

- **React** (`web/`, Vite + TS): es el producto. `cd web && pnpm install && pnpm dev`
  (puerto 5174, ver `.claude/launch.json`). Ojo: el dev server sirve **la landing en `/`
  y la app en `/app/`**, igual que producción — esa equivalencia es deliberada, no la
  "arregles" devolviendo la app a la raíz. `pnpm typecheck` antes de dar nada por bueno —
  no hay tests, typecheck es la única red.
- **Legado** (`legacy/`: `app.html` + `app.js` + `styles.css` + `i18n.js`, más
  `index.html`, que fue la landing hasta septiembre de 2026). **Archivado, ya no se
  despliega ni se toca.** Está ahí para consultar cómo hacía algo la versión anterior.
  Para verlo: configuración `trazza-legacy-*` de `.claude/launch.json`, que sirve
  `legacy/` en el 5178 (`/` es la app, `/index.html` la landing vieja; `legal.html` se
  resuelve contra `web/public/` porque se movió con la app nueva y no se duplica).

**Para revisar diseño sin entrar con una cuenta: `trazza-demo-*` (puerto 5175).** La app
pide login contra Supabase, así que sin credenciales de un usuario real no hay forma de
ver las siete pantallas por dentro — y eso es justo lo que hace falta para mirar el
responsive. `.claude/serve-demo.mjs` arranca Vite apuntando `envDir` a una carpeta que no
existe: no encuentra ningún `.env`, `isSupabaseConfigured` sale `false` y `App.tsx` cae en
la rama `unconfigured`, que ya pinta el `AppShell` entero con los datos de `lib/demoState`.
**No borra ni toca `web/.env.local`**, y el dev server de siempre sigue en el 5174, así que
los dos pueden convivir. Si algún día se cambia cómo se decide el modo demo, esto es lo
primero que deja de funcionar.

Su límite: **en demo no hay usuario, así que todo lo que dependa de la sesión no se pinta**
— `useSubscription` se queda en `undefined` y `SubscriptionNotice` no aparece por mucho que
lo busques. Para revisar ese tipo de componente hay que inyectar su marcado contra la hoja
de estilos viva (lo que verifica el CSS y la disposición, no el JSX) o entrar con una
cuenta real y tocarle el `trial_ends_at`.

Las dos comparten las mismas tablas de Supabase (`firms`, `accounts`, `transactions`,
`journal_entries`, `journal_error_types`, `subscriptions`). Sigue importando para
cualquier cambio de esquema: el legado archivado no se rompe solo porque no se sirva, y
si algún día se vuelve a levantar tiene que seguir leyendo lo mismo.

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

Y si otra sesión ya ocupa el 5174 (y la demo el 5175), `preview_start` de
`trazza-web-mac` anuncia un puerto alto que no es el bueno: Vite hace su propia búsqueda
y se queda en el 5176. El puerto real es el que sale en `preview_logs`.

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
Empresas, Cuentas, Movimientos y Journal. Cada una se llevó varias iteraciones de
feedback visual real contra capturas; no son cambios cosméticos superficiales, resuelven
cosas concretas (ver "Trampas ya pisadas" abajo).

**El sistema de diseño**, cerrado el **25 de agosto de 2026** en seis commits: las
escalas de espaciado, letra y peso podadas a seis valores cada una, y una escalera de
proximidad que da a cada nivel de la jerarquía su propia distancia. Aplica a la app
entera, no a pantallas sueltas. Tiene sección propia más abajo — léela antes de tocar
`styles.css`.

**Cuentas — enlazar evaluación con fondeada.** Este archivo lo listó como pendiente
hasta que el usuario avisó, el 26 de agosto de 2026, de que ya estaba hecho — otra
sesión lo cerró sin que quedara anotado aquí. Verificado contra producción antes de dar
el aviso por bueno, no solo contra el código: `supabase-accounts-kind.sql` (aditivo, no
toca `status` ni la app legada) añade `kind`, `drawdown_type` y `parent_account_id` a
`accounts`, y en Supabase hoy hay 85 cuentas, 0 sin `kind`, 0 sin `drawdown_type`, y una
cuenta enlazada de verdad: "Alpha Futures 25K" (`passed`) → "Alpha Futures 25K #2"
(`funded`) vía `parent_account_id`, exactamente el ejemplo que el propio SQL preveía a
mano. En React, `AccountsView.tsx` tiene el botón de promoción sobre la tarjeta del
challenge (`openPromoteAccount`), abre el alta de la fondeada precargada con
`parentAccountId`, y no se ofrece si la evaluación ya tiene una fondeada enlazada
(`hasFundedChild`).

**Journal**, cerrado el **26 de agosto de 2026** en siete commits. El criterio lo fijó el
usuario y conviene mantenerlo si se toca algo: *copiar la estructura y la información del
legado tal cual —qué widgets, qué datos, qué disposición— y respetar las decisiones de
React donde el legado no cabría* (formatos compactos, escalas de espaciado y letra,
paginación). **Una excepción, fijada por el usuario el 21 de septiembre de 2026: el legado
restaba los payouts del P&L del calendario, y eso NO se copia** — ver "Payouts, balance y
P&L" más abajo. Se cerraron cuatro huecos de contenido y se le dio el dinamismo que ya
tenían las gráficas de Finanzas:

- Los tres KPIs del cockpit eran `MetricCard` planas: ahora son el gauge semicircular de
  winrate y las dos barras divididas de Profit factor y Avg win/loss.
- **Disciplina no existía en React**: el dato estaba pero no había dónde verlo salvo
  entrada a entrada. Widget nuevo con el mismo armazón que la curva de P&L.
- El calendario recupera la columna de semana y el total del mes.
- El panel de errores recupera el anillo con el total en el centro y la severidad.
- Zoom de rueda y tooltip en las dos gráficas, anillo que responde en las dos
  direcciones (arco ↔ leyenda), hover en barras y filas, y calendario que enciende la
  semana entera al señalar un día.

**Gestor de tipos de error**, cerrado el **26 de agosto de 2026**. La severidad pasa a
guardarse en vez de deducirse, y los tipos se pueden borrar:

- `supabase-journal-error-severity.sql` (aditivo, columna anulable con check a
  `minor`/`moderate`/`severe`) — **ya ejecutado en producción**.
- El formulario pide nombre y **gravedad**; el color sale de ella. Al invertirse la
  relación desaparece de raíz el problema de que cambiar el color cambiara la severidad.
- **El legado recoge la columna solo**: hace `.select("*")` y su
  `inferJournalErrorSeverity` arranca comprobando `row.severity` antes que el color.
  **Pero al escribir no la incluye** (`journalErrorTypeToDb`), así que editar un tipo
  desde el legado la deja en `NULL` y vuelve a deducirse del color. Por eso
  `colorForSeverity` sigue tirando de las paletas del legado: esa vuelta atrás tiene que
  seguir dando la misma respuesta. Es el motivo de usar la escala cálida (gris → naranja
  → rojo) y no una de rojos, que al perder la severidad marcaría todo como Grave.
- Las filas antiguas llegan sin severidad y siguen deduciéndola. `undefined` significa
  "dedúcela", no "moderado": poner un defecto congelaría una deducción como si fuera un
  dato.
- **Borrado bloqueado si el tipo está en uso.** Las entradas guardan el id del tipo, así
  que borrar uno usado dejaría esas entradas mostrando un UUID donde va el nombre. Para
  esos está ocultar.

La mecánica de zoom y recorrido vive en **`useChartZoomHover`** y la usan las **tres**
gráficas de la app: `CapitalCurve` del Panel y las dos del Journal. Salió de
`CapitalCurve` y volvió a ella, así que no hay copia duplicada que mantener. El hook no
sabe nada de la geometría de cada gráfica porque recibe los puntos ya escalados — es lo
que permite que `CapitalCurve` cruce su línea guía hasta la franja de movimientos
mientras las del Journal la paran en la curva.

**Movimientos** cerró su pasada el mismo día: hover de fila con revelado de acciones
(mismo patrón que `.journal-error-type-row`), altura de fila uniforme, y paginación (20
por página) donde antes se pintaban todas las filas de golpe.

**El corte a React y la landing nueva**, el **7 de septiembre de 2026**. El legado salió
de la raíz a `legacy/`, el dominio pasó a servir el build de Vite (ver la primera sección)
y la landing se rehízo entera sobre los tokens de la app: mismo morado, misma letra,
mismas sombras y la misma cinta de colores que hay detrás de la tarjeta de acceso, que es
lo que hace que entrar en el producto no parezca cambiar de sitio. Es un archivo estático
(`web/index.html` + `src/landing/`) y **no arrastra el bundle de React**: 22 kB de CSS y
7 kB de JS, frente a los 692 de la app.

Detalles de la landing que no son obvios y conviene no deshacer:

- **Su traducción no usa el diccionario de la app.** El castellano vive en el HTML y
  `landing.ts` solo lleva el inglés, así que no hay dos copias del texto que puedan
  divergir y el contenido real viaja en el documento, que es lo que lee Google. Comparte
  con la app las claves `trazza:theme` y `trazza:language` de `localStorage`, de modo que
  quien elige inglés u oscuro en la landing se encuentra la app igual.
- **`?mode=signup`.** Los botones de alta apuntan a `/app?mode=signup` y `entryParams.ts`
  lo lee para abrir `AuthScreen` directamente en registro. Antes ese parámetro se
  ignoraba y quien pulsaba "Crear cuenta" aterrizaba en el formulario de acceso.
- **La vuelta de Stripe (`?checkout=success`) refresca la suscripción dos veces**, a los
  1,2 y a los 4 segundos. La fila la escribe el webhook, no el checkout, y Stripe devuelve
  al navegador sin esperarlo: sin ese reintento, un recién pagado podía ver el paywall.
- Los dos parámetros se leen **una sola vez** al cargar el módulo y se limpian de la barra
  con `replaceState`, para que "success" no se vuelva a disparar en cada recarga.

**El móvil**, cerrado el **8 de septiembre de 2026** en nueve commits (más el del servidor
demo, que hizo falta para poder mirarlo). El criterio lo fijó
el usuario y conviene mantenerlo: **un diseño con dos disposiciones, no dos diseños.** Los
tokens los comparten app y landing desde el corte a React precisamente para que el morado
de una no se separe del de la otra; duplicar eso en una rama "móvil" reintroduce ese
problema multiplicado por siete pantallas. Así que no hay tokens nuevos, ni colores
nuevos, ni componentes duplicados: **lo que falla en móvil no es el diseño, es la
disposición** — piezas que dan por hecho que hay sitio a lo ancho.

- **El menú es un cajón** que entra sobre el contenido, no un bloque apilado arriba. Antes
  ocupaba 538px: en un teléfono de 812, la primera pantalla entera era navegación. Se
  cierra al elegir destino, con Escape y tocando la capa oscura; bloquea el scroll del
  fondo y lo suelta al ensanchar, porque si no el estado se queda en "abierto" y deja el
  `body` sin scroll en escritorio. Ese umbral está escrito **dos veces y en dos formas**:
  `@media (max-width: 820px)` en la hoja y `matchMedia("(min-width: 821px)")` en
  `AppShell`. Son complementarios a propósito, no iguales — si mueves uno, el otro es el
  de al lado, no el mismo número.
- **Empresas**: `.firm-overview-panel` pedía 692px que no se encogen, así que a 375 se
  salía media pantalla y los filtros Crypto y Otro no se podían pulsar. A una columna.
- **El calendario** saca la columna SEMANA de la rejilla y le da la fila entera debajo de
  sus siete días — el marcado ya los emite en ese orden, así que no hubo que tocar el TSX.
- **Zonas de pulsación a 44px** en un solo bloque al final del `@media` de 820. Los dos
  glifos discretos (info y filtros) conservan su tamaño y crecen solo la zona sensible,
  con un pseudoelemento transparente.
- **El Panel a dos columnas** (era una) y las alturas de pantalla en `dvh`.

Se verificó midiendo, no mirando: las **48 combinaciones** de 6 vistas × claro/oscuro ×
es/en × 375 y 414px, sin un elemento fuera de la ventana ni un texto truncado con elipsis.
Y los diez commits pasan `pnpm typecheck` por separado, comprobado uno a uno.

**El aviso de suscripción**, el **8 de septiembre de 2026**. `SubscriptionNotice.tsx` se
pinta sobre el contenido en las tres situaciones que lo piden: prueba caducada o
suscripción cancelada (con texto distinto para cada una — decirle "tu prueba ha terminado"
a alguien que canceló suena a que la app no sabe con quién habla), pago fallido, que manda
al portal de facturación y no al selector de planes porque ahí el arreglo es la tarjeta, y
prueba a punto de acabar, a tres días o menos.

Existe porque **el paywall era invisible hasta que chocabas con él**: `guard()` en
`App.tsx` abre `PlansModal` al intentar guardar algo, así que quien volvía con la prueba
caducada, miraba sus datos y se iba, no llegaba a enterarse de que había algo que pagar ni
de por qué no podía editar. El aviso de "quedan X días" tapa el otro hueco: `trialDaysLeft`
estaba calculado desde el principio pero solo se pintaba entrando en Ajustes, de modo que
la prueba se acababa sin que nadie lo hubiera dicho.

No bloquea nada —el solo-lectura sigue siendo igual de generoso, solo deja de ser
invisible— y mantiene el fail-open: con el estado sin resolver o con la carga fallida no se
muestra nada, porque ahí `canMutateData` deja escribir y anunciar un bloqueo sería mentir.
Va por encima de los avisos de sincronización, porque el de carga sale en cada arranque y
empujaría hacia abajo justo lo que se quiere que se lea. Comparte métrica exacta con
`.state-notice` (12/16 de padding, gap 12, margen inferior 16): los dos se pintan en el
mismo sitio y pueden verse apilados, y si no midieran igual se leerían como dos componentes
distintos en vez de como dos avisos.

**El webhook de Stripe dejó de poder perder un cobro en silencio**, el mismo día.
`upsertPaidSubscription` se llamaba "upsert" pero hacía `.update()`, que no distingue
"actualizada" de "no había fila que actualizar": un usuario sin fila en `subscriptions`
pagaba, se afectaban cero filas, Stripe recibía un 200 y la persona se quedaba con el
paywall puesto sin que constara un error en ninguna parte. Ahora es un `upsert` de verdad
(la PK es `user_id`, así que el conflicto se resuelve solo) y **la escritura fallida se
propaga**, para que el handler devuelva 500 y Stripe reintente: `supabase-js` no lanza,
devuelve `{ error }`, y tragárselo era contestar 200 a un cobro no registrado, que Stripe
ya no repite. Desplegado como v16.

Los otros dos escritores del webhook (`customer.subscription.deleted` e
`invoice.payment_failed`) siguen sin comprobar el error **a propósito**: quitan acceso en
vez de darlo, así que un fallo ahí deja a alguien con acceso de más, mucho menos grave que
dejar fuera a quien ha pagado. Si algún día se tocan, ese es el criterio.

**Las reglas de cobro**, cerradas el **20 de septiembre de 2026** en tres commits
(`70b8cc9`, `bee80d4`, `fcc717a`). La app ya guardaba las reglas que miden el *recorrido*
de una cuenta —objetivo, drawdown máximo, drawdown diario, que es lo que pinta la barra—
pero no las que deciden si **puedes cobrar**, que en las prop firms de futuros son otras
y son la causa número uno de payout denegado del sector.

`supabase-accounts-payout-rules.sql` (aditivo, anulable, **ya ejecutado en producción**)
añade cuatro columnas: `consistency_pct`, `min_profit_days`, `profit_day_min` y
`payout_min`. **`NULL` significa "esta firma no tiene esa regla", nunca cero** — con cero,
una cuenta sin configurar afirmaría que su límite de consistencia es 0 % y que le faltan
días que nadie le pide. Por eso no hay relleno ni defecto, al revés que `kind` y
`drawdown_type`, donde sí había un valor correcto que derivar de lo existente.

Detalles que no son obvios y conviene no deshacer:

- **El ciclo no se guarda**: va desde el último payout registrado de esa cuenta en
  `transactions` y, si no hay ninguno, desde el principio. Guardarlo sería una segunda
  copia que se desincroniza en cuanto alguien corrige la fecha de un payout. Cuentan los
  días **posteriores** a esa fecha, no el día del payout, que ya contó en el ciclo que
  cerró. Y lo que cierra ciclo es un payout, no cualquier ingreso: un refund devuelve
  dinero pero no reinicia nada de lo que mide la firma.
- **El motor vive del journal** (`lib/accountRules.ts`), sin ninguna integración: si el
  usuario apunta su día, Trazza puede decirle qué le falta. Los días ya agrupados que
  usaba el suelo EOD trailing se sacaron a `getAccountPnlByDate` en `metrics.ts` y los
  comparten los dos — no hay dos formas de agrupar por día.
- **Su límite real: una entrada sin cuenta asignada no cuenta para nada.** Medido en
  Supabase el 17 de septiembre de 2026: 274 de 431 entradas tienen `account_id`, así que
  el resto es invisible para este cálculo. Si alguien dice que "el ciclo sale vacío", eso
  es lo primero que mirar.
- Se pinta en dos sitios con el mismo lenguaje y desde un solo componente
  (`AccountRuleStatus.tsx`): el panel entero bajo la barra de recorrido del Journal y una
  sola línea en la tarjeta de Cuentas, que dice solo la regla que falta.
- **Lo que falta va con "+" y sin verbo** ("+2 días", "+790,00 €"). El signo funciona
  igual en los dos idiomas y se salta la concordancia de singular y plural, que en
  castellano cambia el verbo y en inglés no.
- En consistencia, ese "+" es **el beneficio que hace falta en OTROS días**, no lo que
  falta para un objetivo: sale de despejar `mejorDía / (beneficio + x) = límite`. Ganarlo
  en el propio mejor día no sirve, sube las dos cifras a la vez — de ahí el tooltip.
- Con el ciclo en pérdidas o a cero la consistencia se da por **cumplida**, no por rota:
  sin beneficio no hay nada que repartir, y marcarla en rojo desde el primer día sería
  avisar de un problema que aún no ha ocurrido.
- Los datos demo llevan reglas puestas a propósito (`data/demoData.ts`), para que el
  bloque se vea en el servidor demo sin entrar con una cuenta real.

Queda fuera, por si hace falta: **días operados mínimos** (Apex pide 8) no está — la
tarjeta enseña el número pero sin meta contra la que compararlo.

**Obligatorio y opcional en los formularios**, el mismo día. No había forma de saber qué
hacía falta rellenar. La convención elegida y su porqué están en el sistema de diseño,
más abajo; lo que conviene saber aquí es que **el nombre de una cuenta dejó de ser
obligatorio**: se compone solo con la empresa y el tamaño, que sí lo son, así que pedirlo
con un asterisco era pedir teclear algo que ya está escrito. Para que eso fuera cierto en
todos los casos, **capital propio pasa a componerlo con su etiqueta de tipo** ("Capital
propio 50K") en lugar de la empresa que no tiene: era el único tipo de cuenta en el que
había que escribirlo a mano, y por tanto el único motivo real para que el campo siguiera
siendo obligatorio. Al guardar, si el campo está vacío se usa la propuesta.

**El catálogo de planes de Lucid**, cerrado el **21 de septiembre de 2026** en dos commits
(`668ca53` catálogo y reglas, `aea9a2f` aviso del Journal). Existe por un dato: **un día
después de desplegar las reglas de cobro, ninguna cuenta las tenía puestas** — había que
teclear ocho números que casi nadie se sabe. Con una empresa de Lucid, el formulario
ofrece un campo "Plan" (Flex y Pro, de 25K a 150K) y elegirlo rellena tamaño, objetivo,
MLL, límite diario, consistencia, días rentables y lo necesario para cobrar. Solo Lucid
porque es la firma de 20 de los 30 usuarios con empresa; añadir otra es añadir un objeto
a `firmCatalog` en `web/src/lib/firmCatalog.ts`, el formulario no sabe de firmas concretas.

**Estos datos caducan, y un valor precargado equivocado es peor que un campo vacío**,
porque parece un dato. Cada firma lleva `verifiedAt` (la fecha que enseña la pista del
campo) y `sources` con las páginas de `support.lucidtrading.com` de las que salió cada
número. Al revisarlos, siempre desde el soporte oficial y nunca desde blogs: al montarlo,
la propia web de Lucid se contradecía entre dos artículos sobre el límite diario de la
Pro 25K, y mandó el más específico y más reciente (el del límite diario, sin límite).

Decisiones que conviene no deshacer:

- **El plan no se guarda en la cuenta: se deduce de sus valores** (`matchCatalogPlan`).
  Si el usuario cambia un solo número, el selector vuelve a "Elige el plan" en vez de
  afirmar que la cuenta sigue un plan que ya no sigue. Y una revisión futura del catálogo
  no cambia en silencio las reglas de cuentas que ya existen — que es justo lo que hacen
  las firmas: Lucid subió la consistencia de Pro del 35 al 40 % en noviembre de 2025 y
  mantuvo el 35 % a quien había comprado antes.
- **Cambiar de evaluación a fondeada conserva el plan y aplica la otra fase**, y
  promocionar una evaluación hace nacer la fondeada con las reglas de fondeada de ese
  mismo plan: una Flex 50K pierde el objetivo y la consistencia del 50 % y gana los cinco
  días de 150 $.
- **Flex y Pro comparten objetivo y MLL por tamaño**, y aun así nunca se confunden: el
  límite diario, la consistencia o los días rentables siempre los separan.

Comprobar las reglas oficiales contra el motor sacó **dos huecos que ya existían**, y van
como dos columnas más (`supabase-accounts-withdraw-rules.sql`, aditivo, **ya ejecutado en
producción**):

- **`withdraw_min_profit` — beneficio para retirar.** Lo que queda en la cuenta: lo
  ganado desde el principio menos lo ya retirado **en bruto**. No es `payout_min`, que
  mide solo el ciclo. Lucid exige retirar 500 $ como poco, con tope del 50 % del
  beneficio en Flex (hacen falta 1.000 $) y sin tocar el colchón de MLL + 100 $ en Pro
  (en una 50K, 2.600 $). Sin esto, una Flex 50K con cinco días de 150 $ salía "Lista para
  cobrar" sin poder retirar nada.
- **`trail_lock_offset` — bloqueo del trailing.** Cuánto por encima del balance inicial
  deja de subir el MLL. Trazza lo bloqueaba siempre en el inicial, que es lo de
  Apex/Topstep; Lucid lo bloquea en inicial + 100 $, así que en sus cuentas ya bloqueadas
  la app enseñaba 100 $ más de margen del real. `NULL` es 0, el comportamiento de siempre.

"Mínimo para cobrar" pasó a llamarse **"Objetivo del ciclo"**: con dos reglas de dinero, el
nombre viejo valía para las dos.

**Las cuentas sin reglas ya no están en blanco en el Journal**: en su lugar hay una línea y
un botón que abre esa cuenta en Cuentas (`editAccountRequest` viaja por `App.tsx` con un
id que sube en cada petición, como `createRequest`). Si la empresa está en el catálogo, el
texto ofrece elegir el plan en vez de teclear las reglas.

Lo que el catálogo **no** carga, a propósito:

- El límite diario de **Pro fondeada escala** (al 60 % del mejor cierre una vez superado el
  balance de trail). No cabe en un número fijo; se carga el de la primera fase.
- El ciclo de **Flex fondeada** solo tiene que acabar en positivo (1 $). No va como
  objetivo del ciclo porque "210 / 1 $" se leería como un error, y en la práctica ya lo
  cubren los cinco días rentables y el beneficio para retirar.

Verificado con **16 casos contra el código real** (compilando `metrics`, `accountRules` y
`firmCatalog` con `tsc` a CommonJS y ejecutándolos con Node): MLL bloqueado en 50.100,
retiro con el payout descontado, objetivo de ciclo que solo mira desde el último payout y
planes que no se confunden.

**Payouts, balance y P&L**, el mismo 21 de septiembre de 2026 (`ae1df69` y `1d28180`).
La regla la fijó el usuario y es la que manda en toda la app: **el P&L es lo que se gana
operando, y retirar dinero no lo cambia. Un payout baja el balance, nunca el P&L.** Si en
un mes se ganan 1.000 y se retiran 500, el P&L de ese mes son 1.000, no 500. Había dos
fallos, uno a cada lado de esa línea:

- **El balance no descontaba los payouts.** Era tamaño + P&L del journal, y en cualquier
  fondeada que hubiera cobrado la distancia al MLL salía más holgada de lo real: la demo
  cobró 1.250 $ y seguía marcando 51.210 con 2.500 hasta el MLL, cuando tenía 49.960 y
  1.460. Ahora es partida + P&L − payouts **en bruto** (lo que sale de la cuenta; el neto
  es lo que te llega tras el reparto). El suelo trailing calcula su pico con los cierres
  ya descontados; un payout no lo baja (el trailing solo sube), pero acerca el balance a
  él. La línea del MLL del gráfico de P&L **sube lo retirado**, porque la curva es de
  trading y no incluye los payouts, pero la cuenta sí los perdió. "Retirado" tiene una
  sola definición para todo eso: `getAccountWithdrawn` en `metrics.ts`.
- **El calendario del Journal sí restaba los payouts del P&L**: en los totales de semana y
  de mes, en cada mes de la vista anual y en el total del año. Venía del legado. Ahora
  suman solo P&L (mayo de la demo pasa de 180 a 1.430), y el payout se ve aparte, en la
  celda de su día, en azul y **sin signo**, en la vista y en la imagen que se comparte
  (`signDisplay: "never"` en los formatos compactos). Con "−1,3K" un día de cobro se leía
  como un día en pérdidas.

Lo que no cambia, a propósito: "Resultado" en las tarjetas, el P&L neto y el retorno del
Journal siguen siendo resultado de operar. Y el **Panel de Finanzas** sigue tratando el
payout como ingreso que suma: ahí se mide caja (lo cobrado contra lo gastado), no
trading, y ahí es correcto.

Un detalle que ahora se nota y se dejó así: la tarjeta de Cuentas enseña "Retirado" en
**neto** (lo que te llegó, junto a "Gastado", que es lo que da el ROI), mientras el
balance resta el **bruto**. Quien sume de cabeza no cuadrará la diferencia del reparto.
Si molesta, lo limpio es una pista en esa cifra, no pasarla a bruto.

Verificado con 30 casos contra el código real (los del catálogo más 14 de payouts: el
caso de la demo, refunds, payouts de otra cuenta, drawdown estático y Lucid bloqueado)
y, en la demo, midiendo la línea del MLL del gráfico: sus escalones salen en −2.500,
−2.080 y −250 exactos.

**Una prueba gratuita por persona, no por cuenta**, el **22 de septiembre de 2026**
(`supabase-subscriptions-trial-claims.sql`, **ya ejecutado en producción** como la
migración `20260922133123`). El agujero lo vio el usuario: el trigger de alta regalaba 14
días a cada fila nueva de `auth.users` sin mirar nada más, y `delete-account` borra la
suscripción y el usuario sin dejar rastro. Exportar el JSON, borrar la cuenta,
registrarse otra vez con el mismo email e importar devolvía una prueba nueva con todos
los datos dentro: dos minutos cada 14 días.

Ahora cada alta guarda en `trial_claims` el SHA-256 del email normalizado (nunca el
email), en una tabla sin FK a `auth.users` para que sobreviva al borrado. Decisiones que
conviene no deshacer:

- **El reloj es del email, no de la cuenta.** Un alta con huella hereda el
  `trial_ends_at` de la primera prueba: quien borra al tercer día conserva los once que
  le quedaban, y quien ya la agotó nace en solo lectura con el aviso de siempre ("Tu
  prueba gratuita ha terminado"). Borrar la cuenta ni se castiga ni se premia.
- **La normalización es la mitad del arreglo.** 53 de 55 usuarios usan Gmail, que da por
  buenos `a.lex@` y `alex+2@` como si fueran `alex@`: se quita el `+loquesea` en
  cualquier dominio y los puntos solo en Gmail. Un email distinto de verdad sí recibe
  prueba nueva; eso solo lo corta pedir tarjeta al empezar, y con la activación que hay
  no compensa.
- **El trigger es fail-open**: si la parte de la huella falla, el alta sigue con prueba
  normal y deja un `warning`. Un error en un trigger de `auth.users` tumba el registro
  entero, y dejar sin cuenta a alguien real es peor que regalar una prueba.
- **`supabase-subscriptions.sql` conserva la versión vieja de la función** (lleva un aviso
  encima): reejecutarlo sin reejecutar después el de `trial_claims` reabre el agujero.
- **`legal.html` lo declara** en Conservación, Suscripciones y Eliminación: un hash de un
  email sigue siendo dato personal, y la página prometía borrar "todos sus datos". La base
  jurídica ya estaba (interés legítimo para prevenir abusos).
- Desde la app nadie lee la tabla ni llama a `trial_email_hash`: sin permisos y con RLS
  sin políticas. El asesor de Supabase lo marca como INFO, y es a propósito.

Verificado con 33 casos en PGlite imitando los permisos de Supabase, con un ensayo contra
producción que se deshace solo (ver "Cómo se ha estado trabajando") y, ya aplicado,
repitiendo las altas simuladas: 55 huellas para 55 emails, el alias de un usuario real
hereda su fin exacto, un email nuevo recibe 14 días y borrar y volver no reinicia nada.

## Qué queda

**Del plan original no queda nada abierto**, y a 26 de agosto de 2026 tampoco quedan
cabos: las siete pantallas de React están pulidas, Cuentas quedó cerrada y la severidad
de los errores dejó de ser una deducción (ver abajo).

El calendario del Journal en móvil estuvo aquí desde el 2 de septiembre de 2026 y **se
cerró el 8**, con el resto de la pasada de móvil (tiene sección propia arriba).

**No quedaba nada abierto hasta el 17 de septiembre de 2026**, cuando se hizo el análisis
de competencia que abrió una lista nueva (sección propia justo abajo). El último pendiente
del plan viejo —comprobar un cobro real de punta a punta sobre el build de React— se
cerró el **8 de septiembre de 2026** con el primer pago de verdad (ver "El primer pago"
abajo).

El corte a React se desplegó el 7 de septiembre de 2026 y está verificado contra
producción: rutas (`/`, `/app`, `/legal.html`, `/robots.txt`, `/sitemap.xml`), la
redirección `/app.html` → `/app` conservando la query, el dominio sin www redirigiendo al
www, la URL y la clave de Supabase incrustadas de verdad en el bundle (o sea, no salió en
modo demo) y los `.sql` ya devolviendo 404. Las dos Edge Functions de Stripe se
redesplegaron después, con las URLs de retorno apuntando ya a `/app`, y responden
correctamente.

### Siguiente: el paywall solo vive en el navegador (visto el 22 de septiembre de 2026)

**Es el agujero más grave que queda y el siguiente paso acordado con el usuario**, justo
después de cerrar el de la prueba por persona. Las políticas RLS de las siete tablas de
datos (`firms`, `accounts`, `transactions`, `journal_entries`, `journal_error_types`,
`journal_strategies` y `journal_deleted_default_error_types`) solo comprueban que la fila
sea tuya (`auth.uid() = user_id`), nunca la suscripción. El solo-lectura al caducar lo
impone únicamente `canMutateData` en el navegador, así que quien sepa sobrescribir en las
DevTools la respuesta de `subscriptions`, o escribir con su JWT contra la API, tiene la
app entera gratis sin borrar nada. Y la importación de JSON de Ajustes ni siquiera pasa
por `guard()`: `App.tsx` le pasa `dataState.importData` tal cual.

El arreglo es una función `security definer` que diga si el usuario puede escribir —la
misma regla que `isSubscriptionAccessActive`— metida en las políticas de escritura de esas
siete tablas, con la lectura intacta (el solo-lectura sigue igual de generoso). Es
delicado porque toca cada escritura de quien paga: antes hay que comprobar que la app no
escribe nada sola al cargar (sembrar tipos de error por defecto, por ejemplo), porque eso
rompería la primera carga de una cuenta caducada, y ensayarlo contra producción con el
mismo `DO` que se deshace solo.

### Qué construir después (análisis de competencia, 17 de septiembre de 2026)

Esto está aquí porque la conclusión no es intuitiva y redescubrirla cuesta una sesión
entera de búsquedas. **El control de gastos y payouts —que es el corazón de Trazza—
está comoditizado**: Tradezella lo regala dentro de su plan (PropFirm Sync, que además
lee los cargos del banco vía Plaid) y Master Tracker tiene plan gratuito con costes y ROI. En
español hay dos ya montados: Trading Control (11,99 €/mes, con reglas precargadas de más
de 20 firmas) y SimpleTrader (29-149 €/mes, copiador + journal + gestor financiero con
"próximos vencimientos"). Otros del ramo: Deltalytix (open source, sync con Rithmic y
Tradovate, avisos de cargo, catálogo de firmas), Everedge, PropTato, Tradesyncer.

O sea: **"ver cuánto gastas y cuánto cobras" ya no justifica pagar por sí solo.** Tampoco
se puede ganar en integraciones con brokers, IA o replay, que piden equipo y dinero. Lo
que sí es terreno propio son tres cosas, y de ahí sale la lista:

1. Ser **la herramienta de fondeo de futuros en español**. Dato propio, medido en
   Supabase el 17 de septiembre: de los 30 usuarios que han creado una empresa, **20
   tienen Lucid**; luego Alpha (7), Tradeify, Apex y Topstep. De CFDs solo 3. Los nombres
   son texto libre y están duplicados ("lucid", "lucid trading", "lucid 1", "apha futures
   50 k"), así que hoy no se pueden agregar datos ni precargar reglas.
2. Responder la pregunta de dinero **entera**: cuánto gano de verdad, cuándo puedo cobrar
   (esto ya está hecho, ver las reglas de cobro arriba) y qué le debo a Hacienda.
3. Conocer a fondo **las cinco o seis firmas que usan tus usuarios**, en vez de 500
   brokers por encima.

La lista, por orden de impacto entre esfuerzo:

- ~~**Catálogo de firmas y planes con reglas precargadas.**~~ **Hecho para Lucid el 21 de
  septiembre de 2026** (ver "Qué está cerrado"). Quedan Alpha (7 usuarios), Tradeify, Apex
  y Topstep, cada una con sus fuentes oficiales y su fecha. Lo que **no** hizo: arreglar
  los nombres de empresa duplicados. El catálogo reconoce "lucid", "Lucid Trading" o
  "lucid 1" por igual, pero no los fusiona; eso sigue pendiente, y es lo que necesitan
  tanto la importación del extracto como el informe fiscal.
- **Importar el extracto del banco (Revolut, Wise) en CSV**, procesado en el navegador y
  detectando cargos de LUCID/APEX/TOPSTEP y payouts. Es el PropFirm Sync de Tradezella sin
  Plaid, sin coste y sin pedir acceso al banco. Ataca el agujero grande: **35 de 54
  usuarios no crearon ni un registro**, y hoy ver el gasto acumulado exige teclear 167
  compras a mano.
- **Informe fiscal para España**: payouts por trimestre en euros al cambio del día, gastos
  por firma, exportación para la gestoría y estimación orientativa del modelo 130. Ningún
  competidor en inglés lo tiene, y desde febrero de 2026 Wise y Revolut informan a Hacienda
  (DAC8 / modelo 196), así que el tema aprieta. **Cuidado: las fuentes se contradicen sobre
  si el coste de los challenges es deducible** — no darlo por hecho, dejar que lo decida la
  gestoría y avisarlo. Sirve además como contenido SEO en español con intención de compra.
- **Avisos de cargos y fechas.** Apex y Topstep renuevan la evaluación cada mes aunque la
  hayas suspendido. Preguntar "¿has cancelado la suscripción?" al marcar una cuenta como
  fallada, calendario de próximos cargos, aviso de ventana de payout. Por email sería
  además la primera razón para volver a entrar.
- **Tarjetas para compartir** un payout o el mes: `journalCalendarImage.ts` ya hace la del
  calendario, y es difusión gratis en Discord y Telegram.
- **Códigos de descuento de afiliado** (el modelo de PropFirmMatch): ingresos que no
  dependen de la conversión, pero hay que declararlo y no recomendar por comisión.

Lo que **no** conviene hacer: sync automático con Rithmic/Tradovate/ProjectX (caro de
mantener, la API de TopstepX cuesta 29 $/mes por usuario, y ahí ya están los grandes),
replay/backtesting/copiador (piden capital), estadísticas públicas por firma (con 54
usuarios no significan nada) y **volver a bajar el precio** — ya está medido que el precio
no es la restricción.

### El primer pago (8 de septiembre de 2026)

`sergiootrading11@gmail.com` (`a3835d9c`) es el primer cobro real del proyecto. En
`subscriptions`: `status = active`, `stripe_customer_id` y `stripe_subscription_id`
puestos, `price_id = price_1U3k7SCelowhkFldSlwvgfNY` y `current_period_end` un mes
exacto por delante (8 de octubre) → **plan mensual**. El importe concreto no se comprobó
contra Stripe en esta sesión, pero el `price_id` es el que `STRIPE_PRICE_MONTHLY` sirve
desde el cambio de precio del 13 de agosto, así que es el de 4,99.

Con esto queda probada **la mitad que faltaba**: `price_id` y `current_period_end` solo
los escribe `upsertPaidSubscription` dentro del webhook, y aquí los escribió sobre una
fila que antes era `trialing` — o sea, webhook firmado, validado y aplicado **sobre el
despliegue de React**, no solo sobre el legado como en agosto. La vuelta del navegador a
`/app?checkout=success` con el reintento de `useSubscription` es la otra pieza que
estrenó el corte a React; el usuario celebró el pago sin reportar que se quedara con el
paywall puesto, así que el reintento hizo su trabajo.

Antes de este pago la tabla no tenía ninguna suscripción `active`. La traza del webhook
de agosto (usuario `3bc74b`, `updated_at` del 6 de agosto a las 14:13) sigue siendo
válida como prueba de que el endpoint está de alta y el secreto de firma es el bueno,
pero ya no es la única: ahora hay un `active` de verdad.

**El código de cobro sí está revisado entero, el 8 de septiembre de 2026, y está bien.**
Conviene saberlo para no volver a sospechar de él: `create-checkout-session` fija
`client_reference_id` **y** `subscription_data.metadata.supabase_user_id` **y** persiste el
`stripe_customer_id` antes de redirigir, así que el webhook tiene tres caminos
independientes para saber de quién es el pago. Usa `constructEventAsync`, que es la
variante correcta en Deno, y `getCurrentPeriodEnd` lee el campo en las dos formas que ha
tenido en la API de Stripe. Y que los dos usuarios que abrieron el checkout tengan
`stripe_customer_id` escrito demuestra que esa mitad corre de verdad en producción.

**Y el webhook está probado de punta a punta en producción.** Desde el 8 de septiembre de
2026 hay una suscripción `active` de verdad (ver "El primer pago"), pero incluso antes la
prueba ya estaba en los datos, y conviene saber leerla para no volver a dudar de lo mismo:

`price_id` y `current_period_end` los escribe **un solo sitio en todo el sistema**:
`upsertPaidSubscription`, dentro del webhook. El SQL se limita a declarar las columnas y
ninguna otra función las toca — `create-checkout-session` solo escribe
`stripe_customer_id`. Pues el usuario `3bc74b` tiene las dos puestas, con un
`current_period_end` exactamente un mes posterior a su alta y un `updated_at` del **6 de
agosto de 2026 a las 14:13**. Eso es un periodo mensual escrito por el handler: ese día
Stripe entregó un evento firmado, la firma se validó y la fila se escribió. De ahí salen
dos cosas que **no hace falta volver a comprobar**: el endpoint está dado de alta y
suscrito a los eventos, y `STRIPE_WEBHOOK_SIGNING_SECRET` es el del endpoint bueno. Es la
suscripción de prueba del 6,99 que menciona la sección de monetización; después se pasó a
`lifetime` y se le limpiaron los ids de Stripe, pero el rastro del webhook se quedó ahí.

Queda suelto un solo detalle, y es menor: que `SITE_URL` no acabe en barra, o las URLs de
retorno salen con `//app`.

Si algún día hace falta reconfirmar el cableado —porque se toque el endpoint o se rote el
secreto— se hace gratis desde Stripe → Developers → Webhooks → **Send test webhook**: un
200 lo prueba, y el historial de entregas de esa pantalla dice qué ha llegado. Pero no es
un pendiente: nada indica que se haya movido nada desde agosto.

### Por qué casi nadie ha pagado todavía (medido el 8 de septiembre de 2026)

**El 8 de septiembre de 2026 llegó el primer pago** (`sergiootrading11@gmail.com`,
mensual — ver "El primer pago"). Lo de abajo se midió ese mismo día, justo antes, y sigue
explicando el ritmo: un pago no cambia el análisis, lo confirma.

Esto está aquí porque la lectura intuitiva es errónea y cuesta una sesión entera
redescubrirlo. **No es que la gente se haya negado a pagar: es que casi a nadie se le ha
pedido.** 39 de los 54 usuarios tenían el trial vivo hasta el **5 de septiembre**, o sea
que el muro llevaba dos días puesto para la mayoría.

Los números que importan, sacados de Supabase:

- 54 registrados, de los cuales **11 son `lifetime`** y nunca pueden pagar → base real 43.
  (Eran 9 hasta el 8 de septiembre de 2026, cuando se dieron dos de alta a mano.)
- 5 nunca confirmaron el email ni entraron.
- Solo **19** llegaron a crear una cuenta o empresa; 13 tienen ≥10 registros.
- **2 inicios de sesión en los últimos 7 días.** Ese es el número de verdad.
- Hasta el 8 de septiembre solo un usuario real había abierto el checkout (7 de agosto)
  sin terminarlo. Ese día otro lo completó: primer pago.
- **Tres semanas seguidas con cero altas** (17, 24 y 31 de agosto). El pico fue la semana
  del 13 de julio, con 11.

Cruzando las tres cosas, el muro del 5 de septiembre cayó sobre **unas 4 personas
realmente activas**. Que a los tres días pague 1 de esas 4 es aritmética, no una señal
sobre el producto en ningún sentido: ni el 0 de antes era malo ni este 1 es bueno. Para
leer algo de la conversión hacen falta del orden de 30-50 personas enganchadas llegando
al paywall.

Dos consecuencias prácticas. Una: **el precio no es la restricción** y bajarlo otra vez no
arreglaría nada — la bajada de 6,99 a 4,99 se hizo sin evidencia, porque en ese momento aún
no se le había pedido pagar a nadie. Dos: **la retención va antes que la difusión**. De 54
registrados, 35 no crearon ni un solo registro; meter tráfico por ese embudo quema la
audiencia sin cambiar el resultado.

Ojo también con `subscriptions.created_at`: **no es la fecha de alta**. 48 de las 54 filas
se crearon el 5 de agosto de 2026 de una tirada, que es cuando se pobló la tabla. La fecha
de alta real está en `auth.users.created_at`, y se nota porque hay usuarios cuya última
actividad es *anterior* a su `created_at` en `subscriptions`.

Los cabos de CSS que hubo aquí sí están todos cerrados a 26 de agosto de 2026: las tres
reglas `.workspace` duplicadas se consolidaron en una (con cuidado: el `min-width: 0`
solo lo declaraban dos de las tres), y las clases muertas `.workspace-header`,
`.workspace-controls` y `.workspace-section` se borraron enteras.

Aviso de método, que costó una confusión real: `AccountHealth.tsx` y `JournalPanel.tsx`
salieron listados aquí como código muerto durante bastante tiempo **cuando ya no
existían** — se habían borrado en `69f2482`, el mismo commit que arregló los textos de
`metrics.ts`. Contar referencias excluyendo el propio fichero da cero igual si nadie lo
usa que si no está: comprueba que el fichero existe antes de dar por bueno un cabo.

La rejilla de tarjetas del Panel (`.metric-grid`) **no es `auto-fit`, es fija a
propósito**: son 7 celdas (la destacada ocupa dos columnas) y 7 no se reparte limpio en
casi ningún número de columnas fijo por el ancho — con `auto-fit` un portátil típico
(1440-1512px) elegía 5 columnas y la segunda fila se quedaba con 3 huecos vacíos. La
solución fue hacer que la última tarjeta también ocupe dos columnas (8 celdas, que sí
cuadra en 4) y fijar la rejilla en `repeat(4, minmax(0,1fr))`: dos filas de 4 completas
hasta los 1560px. Por encima de **1560px** un `@media (min-width: 1560px)` cambia a 7
columnas de una sola fila, con solo la destacada a `span 2` (ahí sí cuadra: 2+1×5=7). Si
tocas esto, ojo con la trampa de cascada de más abajo — el override de una fila vive al
final del archivo, no junto a la regla base, y hay una razón concreta para eso.

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
- **Un tooltip anclado con `translate(-50%, -100%)` crece hacia arriba, y el marco lo
  recorta.** Los marcos de gráfico llevan `overflow: hidden`, así que el suelo del
  posicionamiento tiene que reservar el **alto real de la tarjeta**, no un margen a ojo.
  Con tres filas medía 121px sobre un marco de 286 y se comía 38px de la fecha. Y ojo con
  las unidades: el `top` va en el sistema del `viewBox`, no en píxeles de pantalla.
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
- **Un número en píxeles escrito a mano puede estar acoplado en silencio a un token.**
  `.topbar` llevaba `margin: 0 -18px 18px` para cancelar el padding de `.workspace`,
  que valía `--space-2xl`. Al subir ese token a 24 la cabecera se quedó metida 6px por
  lado y su fondo desenfocado dejó de llegar al borde, sin que nada lo delatara. Si un
  número cancela a otro, exprésalo con el mismo token y no con su valor.
  **Y atarlos al mismo token no basta: hay que atarlos a la misma variable.** El arreglo
  de arriba aguantó hasta que un `@media` le cambió el padding a `.workspace` y no el
  margen a `.topbar` — con eso la cabecera volvió a salirse, 8px por lado en las siete
  pantallas, tapados por un `overflow-x: hidden` que hacía invisible el síntoma. Un token
  solo cubre que cambie el token; una variable propia (`--workspace-pad`, declarada por
  quien pone el padding y consumida por quien lo cancela) cubre también que cambie el
  breakpoint, porque redeclararla arrastra las dos a la vez. Mismo patrón en
  `--journal-calendar-bleed`. Si ves un `overflow: hidden` puesto para que algo "no se
  note", sospecha: casi siempre tapa una cuenta que no cuadra.
- **Una regla CSS puede apuntar a una clase que ya no existe y no avisa de nada.** El
  `@media` de 820 repartía `.sidebar-nav` en dos columnas y ocultaba `.sidebar-status`
  para que el menú no se comiera la pantalla en móvil. Nunca se aplicaron: el marcado usa
  `.nav-list` / `.nav-group` desde que se fundió el interruptor de área con la lista, y
  nadie renombró el CSS. El bug parecía "falta CSS de móvil" cuando en realidad **sobraba
  CSS que no apuntaba a nada**. Había cuatro reglas así y la cuarta apareció mirando el
  bundle ya desplegado, lejos del `@media`, en la zona de pares de tema oscuro — esa
  además pintaba fondo claro sobre el riel, que es oscuro con cualquier tema. Al tocar
  responsive, comprueba con `grep` que cada selector del `@media` existe en algún `.tsx`
  antes de suponer que la regla se está aplicando.
- **Los breakpoints calculados midiendo caducan cuando cambia la medida.** El apilado
  de la barra superior estaba en 960px porque ahí era donde dejaban de caber los seis
  controles; al ensanchar el botón principal pasaron a pedir 5px más y la fila se
  partía en dos líneas en toda una banda de anchos. Si tocas algo que se midió, revisa
  el breakpoint que se derivó de ello — su comentario lleva los números originales.
- **El color de un tipo de error no es decorativo: es el respaldo de su severidad.**
  Desde que existe la columna `severity` la fuente de verdad es esa, pero las filas
  antiguas y cualquiera que se edite desde el legado llegan sin ella y caen en la
  deducción por color. El orden en `journalErrors.ts` importa y es: **severidad
  guardada → paletas → etiqueta**. Si alguna vez cambias los colores que asigna
  `colorForSeverity`, sácalos de las paletas del legado o romperás ese respaldo. (La
  regla de etiqueta ya tuvo su fallo propio: React hacía `riesgo` → grave sin excluir
  `poco`, y volvía "Poco riesgo" en Grave cuando el legado lo enseña como Leve.)
- **Un importe truncado con elipsis es peor que no mostrarlo**, porque parece un dato y
  no lo es ("-425,00 US$" se leía "-425,00..."). Si un número no cabe, cambia el
  formato y no el tamaño de letra. Hay tres: `formatMoney` (con divisa), `formatAmount`
  (sin divisa) y `formatMoneyCompactSigned` (con divisa estrecha —
  `currencyDisplay:"narrowSymbol"`, "$" en vez de "US$"— y signo explícito, sin
  decimales, para cajas muy estrechas como las celdas del calendario del Journal;
  sustituyó a un `formatMoneyCompact` sin divisa el 2 de septiembre de 2026 porque el
  usuario pidió ver también el importe con signo ahí, no solo la cifra).
  **Hay un cuarto desde el 8 de septiembre**, `formatAmountCompactSigned`: el mismo
  compacto con signo pero **sin divisa y sin separador de miles**, solo para la celda del
  calendario en un teléfono, donde no queda ancho que negociar. Lo de quitar el separador
  va **a propósito y en contra de la regla de más abajo**, que existe para evitar la
  *mezcla* (unos con punto y otros sin él); aquí no se agrupa nunca, así que no hay mezcla,
  y gana un dígito entero de sitio: "−1.250" pide 38px de los 39 útiles y "−1250" pide 32,
  que es lo que hace entrar hasta cinco cifras. `CapitalCurve` tiene su equivalente para
  fechas, `formatTinyDate` ("7/3" en vez de "07 mar").
  **Desde el 8 de septiembre de 2026 los dos compactos del calendario usan notación
  "K"/"M"** (`compactScale` en `metrics.ts`): a partir de 1.000, "2.410 $" → "+2,4K $";
  a partir de un millón, "M". Una cifra decimal solo mientras el número escalado tiene una
  sola cifra entera (1–9,9K y 1–9,9M); de diez para arriba, ninguna. Por debajo de 1.000
  no toca nada. Se hizo copiando el calendario de Tradezella, y su valor real es que un
  día de cinco cifras deja de recortarse: a `--text-md` (que es a lo que subió el importe
  ese día, ver la sección de móvil/Journal) "−12.500 $" pedía ~75px y "−13K $" pide ~50.
  El aria-label y el panel de detalle siguen con el importe exacto vía `formatMoney`.
- **Cuando un texto necesita dos formatos según el ancho, emítelos los dos y que elija el
  `@media`.** Es lo que hacen la celda del calendario y el eje de fechas: dos `<span>`, uno
  con `display: none`. Un `useMediaQuery` también valdría —esta app es solo cliente, así
  que `matchMedia` ya acierta en la primera pintura y no habría parpadeo—, pero partiría el
  breakpoint entre el CSS y el JS, y el 560 vive hoy solo en la hoja de estilos, que es
  donde alguien lo va a buscar el día que lo mueva.
  **Si lo que se queda sin sitio es un panel y no la pantalla, el corte va en una
  container query, no en un `@media`.** Pasó con el mes del calendario del Journal
  (`9a04aec`, 22 de septiembre de 2026): un `@media (max-width: 560px)` acertaba en el
  teléfono y fallaba a 821px, donde vuelve la barra lateral y la pantalla es ancha pero
  el calendario no (la fila pedía 333px en un panel de 331). El contenedor es
  `.journal-calendar-panel > .panel-heading` (`container-type: inline-size`) y el corte,
  `@container (max-width: 359px)`. Ojo: un elemento no puede consultar su propio ancho,
  así que el contenedor tiene que ser un ancestro del texto que cambia.
- **Un título que cambia de ancho entre flechas se sujeta con una reserva invisible, no
  con un `min-width` a ojo.** El `h2` es una rejilla de una celda: dentro va, oculto con
  `visibility: hidden`, el texto más ancho posible, y el real se pinta encima en la misma
  celda y centrado. Cada parte variable de la reserva es una pila `inline-grid` con todas
  sus opciones superpuestas (los doce meses, los diez dígitos por cifra del año), así que
  la anchura la da la fuente de verdad y vale igual en los dos idiomas. Lo usan la fecha
  de Eventos (`WidestLongDate`) y el mes del calendario (`WidestMonthLabel`). Si hay
  formato corto, necesita **su propia reserva** corta: con la larga debajo, el corto no
  ahorraría ni un píxel.
- **Antes de decidir que algo "no cabe", mide el texto real, no uno parecido.** La cuenta
  del calendario se hizo primero con un `canvas.measureText` sobre `"-1.250"` con guion
  ASCII y daba 33px, dentro de los 35 disponibles; en pantalla seguía recortando, porque
  `Intl` no escribe un guion sino el signo menos tipográfico (U+2212), que es tan ancho
  como un dígito. Tres píxeles de diferencia y la conclusión al revés. Lo fiable es un
  `Range` sobre el nodo ya pintado, comparando `scrollWidth` con `clientWidth` — y ojo, en
  elementos `inline` esos dos valen 0, hay que medir el bloque que los contiene.
- **Un empate de especificidad CSS lo gana quien aparece después en el archivo, no
  quien "debería" mandar por el `@media`.** Una regla `@media (min-width: 1560px)`
  con el mismo selector y especificidad que una regla base incondicional, puesta
  *antes* que esa base en el archivo, perdía el empate y no hacía nada — sin error,
  sin warning, el `min-width` nunca llegaba a decidir. Se arregla moviéndola *después*
  de la regla que compite con ella, no subiéndole la especificidad. Pasó con
  `.metric-grid .metric-card:last-child`, que definía `span 2` en la base y
  `auto` en el breakpoint ancho.
  **Volvió a aparecer dos veces en la tanda del Journal**, en su otra forma: un
  `:root[data-theme="dark"] .journal-day` es **(0,3,0)** y se come cualquier
  `.journal-day.algo` **(0,2,0)**, aunque el segundo describa un estado más
  específico. Un realce de hover se quedaba sin aplicar sin dar error. Si añades un
  estado a algo que ya tiene regla de tema oscuro, **el estado necesita su propio par
  de tema** o no se verá en oscuro. Y compruébalo midiendo el color computado: leer el
  CSS no lo delata.
  **Y una tercera forma, la peor de depurar, el 8 de septiembre de 2026:** hay una regla
  al final de `styles.css` ("Card surfaces: keep layout size but remove visible outlines")
  que hace `border-color: transparent !important` sobre una lista larga de selectores. Con
  `!important` gana a cualquier `border-color` sin `!important`, tenga la especificidad que
  tenga. `.journal-day` estaba en esa lista, así que varios despliegues seguidos de reglas
  de borde para el calendario no pintaron nada — el CSS salía, el navegador lo cargaba, y
  el borde seguía transparente. El síntoma desde fuera es idéntico al de una caché que no
  se refresca, y se fue media sesión ahí. Antes de tocar `border-color` de algo, `grep`
  esa lista; si el elemento está, quítalo de ahí, no pongas otro `!important`. El tell:
  `getComputedStyle(cell).borderTopColor` da `rgba(0, 0, 0, 0)` en vez de tu color.
- **Una capa decorativa dentro de un contenedor con `overflow: hidden` se corta donde
  acaba el contenedor, no donde acaba su degradado.** La cinta de colores del hero
  (`.hero-ribbon`) iba de -30% a 130% del alto de `.hero`: los dos recortes caían en
  plena zona opaca del degradado y dejaban dos líneas horizontales duras cruzando la
  página, muy visibles en oscuro. Se arregla haciendo que la caja de la capa coincida
  con la del recorte (`top: 0; height: 100%`), para que sus extremos transparentes caigan
  justo sobre los cortes.
  **Y el arreglo "obvio" es peor: `mask-image` no vale aquí.** La máscara se aplica
  *después* del filtro y su caja es la del elemento, que no incluye lo que el `blur()`
  derrama fuera — así que recorta el propio difuminado y devuelve un paralelogramo de
  bordes duros, que es exactamente lo que se quería evitar. Con desenfoques grandes, la
  geometría manda; la máscara no.
- **Al redesplegar `stripe-webhook` hay que pasar `verify_jwt: false` explícitamente.**
  Es la única de las cuatro Edge Functions que lo lleva desactivado, porque Stripe la llama
  directamente y no manda ningún JWT — la autenticidad la da la firma. Tanto el MCP de
  Supabase como el CLI **asumen `true` por defecto**, así que un redespliegue distraído
  deja el webhook rechazando todos los eventos con un 401 antes siquiera de entrar en el
  handler. Y no lo notarías: solo se rompe cuando alguien paga. Después de desplegarla,
  una llamada sin firma tiene que devolver **400 "Missing stripe-signature header"**; si
  devuelve 401, es esto.
- **Un panel de navegador oculto no es solo un problema de capturas: `innerWidth` vale 0**,
  y con eso toda la geometría miente en silencio (`getBoundingClientRect` devuelve ceros
  que parecen medidas). El color computado sí sigue siendo fiable, así que para comprobar
  pares de tema vale igual; para cualquier cosa de disposición, no. `tabs_context` dice si
  el panel está oculto — mirarlo antes ahorra la ronda entera.
  (Aviso del 19 de septiembre de 2026: el panel puede estar oculto **y** con otra pestaña
  al frente, y entonces las capturas de la tuya salen en blanco aunque el DOM mida bien.
  Medir por JS siguió funcionando toda la sesión; solo se pierde el *ver*.)
- **En modo demo los formularios son de solo lectura, así que no se pueden probar ahí.**
  `canWrite` es `dataMode === "cloud" && ...`, y con él a `false` los `Select` propios
  llegan `disabled`: al pincharlos no se abre el panel de opciones y **el síntoma parece
  otro** ("los clicks sintéticos no funcionan en este componente"), cuando lo que pasa es
  que el control está desactivado. Para verificar un formulario en la demo hay que forzar
  `canWrite` a `true` temporalmente y revertirlo después — comprobando con `git show
  HEAD:<fichero>` que la línea vuelve a quedar idéntica, no fiándose del deshacer.
- **Un script que reparte el diff en varios commits tiene que reconstruir desde un sha
  base fijo, nunca desde `HEAD`.** En cuanto entra el primer commit, `HEAD` se mueve y los
  números de línea del diff dejan de corresponder con el fichero de partida: la segunda
  etapa sale con trozos duplicados o cortados. Costó una etapa entera, y lo delató el
  typecheck con dos `TS1109: Expression expected` en ficheros que no se habían tocado en
  ese grupo. El script de la tanda del 20 de septiembre está en el scratchpad de esa
  sesión, pero lo que hay que recordar es la constante `BASE`.
- **En zsh, `$variable:letra` no es texto: es un modificador.** `git show $sha:web/src/...`
  se convirtió en `git show b/src/...`, porque zsh leyó `:w` como modificador de la
  variable y se comió la `w` y todo lo que la precedía. Con los dos puntos pegados a una
  variable, escríbela siempre entre llaves: `"${sha}:web/src/..."`. El síntoma es un
  `fatal: ambiguous argument` con una ruta mutilada, y como iba en una cadena de `&&`, lo
  que venía detrás (un `git push`) no llegó a ejecutarse — por suerte, esa vez.

## El sistema de diseño — léelo antes de tocar `styles.css`

**Los tokens ya no viven en `styles.css`: están en `web/src/styles/tokens.css`**, que
importan tanto `styles.css` (la app) como `src/landing/landing.css` (la landing). Se
sacaron ahí el 7 de septiembre de 2026, cuando la landing dejó de tener paleta propia. No
es orden por el orden: es lo que impide que el morado de la página de venta se vaya
separando poco a poco del morado del producto. Si cambias un token, cambian las dos.

La idea de fondo, por si hay tentación de "mejorarlo": lo que hace que una interfaz se
lea como cuidada no es tener buen ojo cada vez, es **tener pocos valores donde elegir**.
Todo esto son tokens en `:root`, y cada bloque lleva encima un comentario largo con el
porqué y las mediciones que lo justifican. Léelos antes de cambiar un número.

- **Espaciado: seis valores, `4 / 8 / 12 / 16 / 24 / 32`.** Los trece nombres
  (`--space-3xs` … `--space-6xl`) siguen existiendo, pero apuntan a esos seis. No añadas
  un paso intermedio: con 10, 12 y 14 disponibles a la vez se vuelve a decidir elemento
  por elemento, que es justo lo que la escala existe para impedir.
- **Letra: seis tamaños, `12 / 14 / 16 / 20 / 24 / 32`.** Mismo criterio con los diez
  nombres `--text-*`. 12 es el registro de etiqueta y 14 el de texto corrido; que sean
  dos y no cuatro indistinguibles es el punto entero.
- **Peso: `400 / 500 / 500 / 600 / 700`** para normal/medium/semibold/bold/black. El
  peso de trabajo es 500-600 y el 700 queda para énfasis de verdad. Si te ves poniendo
  negrita para destacar algo, casi siempre lo que falta es tamaño, no grosor.
- **Escalera de proximidad**, de fuera hacia dentro:

  | separa | regla | valor |
  |---|---|---|
  | secciones de la vista | `.view-stack` gap | 32 |
  | paneles entre sí, y el borde del panel de su contenido | `.dashboard-grid` gap, `.panel` padding | 24 |
  | la cabecera de un panel de su contenido | `.panel-heading` gap y margin-bottom | 16 |
  | tarjetas entre sí | `.metric-grid` gap | 12 |
  | etiqueta y cifra dentro de una tarjeta | `.metric-card` gap | 8 |

  **Ningún nivel puede valer lo mismo que su vecino.** El ojo agrupa por
  distancia: si separar dos tarjetas cuesta lo mismo que separar una etiqueta de su
  cifra, no hay nada que agrupar y la pantalla se lee plana aunque cada pieza esté bien.
  Ese era el defecto real de la app, más que la falta de aire.

Quedan 19 valores de espaciado escritos a mano y son **deliberados**: ajustes ópticos de
1-3px, márgenes negativos que cancelan el padding de su contenedor, tres `padding-right`
que reservan sitio para un control absoluto y un `gap: 1px` que es una línea divisoria.
No los "arregles" en masa.

La única letra fluida de la app es la cifra titular del Panel
(`.metric-card.is-featured strong`), un `clamp()` con los topes atados a la escala. Es
una excepción a propósito y está comentada como tal.

### Obligatorio y opcional en los formularios (20 de septiembre de 2026)

**Se marca lo obligatorio, no lo opcional.** Es minoría en todos los formularios —3 campos
de 13 en Cuentas, 2 de 9 en Movimientos, 1 de 12 en un trade—, así que escribir "opcional"
diez veces por formulario pesa mucho más que tres asteriscos, y convierte en ruido justo
lo que se quería destacar. El asterisco va en `--accent-strong` (nunca en rojo: no es un
error) y la fila de acciones lleva la leyenda "* Obligatorio. El resto es opcional.", que
es la otra mitad de la respuesta.

Dos decisiones que conviene no deshacer:

- **La marca la decide `:has(:required)`, o sea el propio atributo del control**, no una
  lista de campos escrita aparte. Así no hay una segunda fuente de verdad que mantener al
  día y un campo que deje de ser obligatorio pierde la marca solo. Los controles propios
  (`Select`, `DatePicker`) no son `:required` porque no son campos nativos: esos se marcan
  a mano con `.is-required`, y hoy solo lo usa la empresa de una cuenta, que valida en JS.
  El selector mira a cualquier descendiente y no al hijo directo, porque `Combobox` y el
  importe de un movimiento envuelven su `input` en un `div`.
- **El formulario de acceso queda fuera** (no está en la lista de clases del selector):
  ahí todos los campos son obligatorios, y cuando no hay nada opcional la marca no
  distingue nada, solo ensucia. Misma idea con la leyenda, que solo va en los formularios
  largos.

Si un campo se rellena solo, **no es obligatorio aunque haga falta**: lleva una pista
(`InfoHint`) que dice qué hace, no un asterisco que pide teclear algo que ya está escrito.
Es el caso del nombre de una cuenta. Y el icono de pista, cuando va pegado a la etiqueta de
un campo (texto de 12), baja a caja de 15 con glifo de 11 y se separa con `--space-3xs`: a
los 18/13 de las cabeceras de tarjeta pesaba más que la propia etiqueta.

### La landing extiende la escalera hacia arriba, no la contradice

`landing.css` añade dos peldaños **por encima** del 32 de `.view-stack`
(`--landing-rung: 48` entre la cabecera de un bloque y su contenido, `--landing-block`
entre bloques de la página) y dos tamaños de letra por encima del tope de 32
(`--landing-display`, `--landing-heading`, los dos `clamp()` con el suelo atado a un
valor real de la escala). Están arriba del todo a propósito: así no compiten con ningún
valor de la escala interna y la regla de "ningún nivel vale lo mismo que su vecino" sigue
en pie. Si necesitas un espaciado nuevo en la landing, el sitio correcto es ese rango
alto — no inventar un 10 o un 14 en medio.

Lo demás de la landing —color, peso, radios, sombras, curvas— sale de `tokens.css` sin
excepción. Las maquetas de producto del hero y de las tarjetas (`.mock-*`) son **HTML con
esos mismos tokens, no capturas de pantalla**: se ven nítidas en cualquier pantalla,
cambian de tema con la página y no se quedan viejas cuando el producto cambia. Si te
piden actualizar "la captura" de la landing, lo que hay que tocar es el marcado.

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
  fiarse de que el CSS "debería" funcionar. **Pero esa técnica tiene una trampa cara**:
  si el script que escribe en `document.documentElement.style` caduca a mitad, la línea
  de limpieza del final no llega a correr y el `<html>` se queda clavado con el último
  valor. A partir de ahí todas las mediciones y capturas mienten en silencio e inventan
  roturas que no existen. Antes de fiarte de una tanda, comprueba que el ancho del
  `<html>` coincide con `innerWidth`. Para comparar dos estados usa variables CSS
  (`setProperty`/`removeProperty` sobre `:root`), nunca geometría del `<html>`, y no
  metas `await` dentro del inyector — son justo los que caducan.
- **Si el panel del navegador está oculto o colapsado, sus capturas mienten.** Pasó
  entero en la sesión de la landing: el DOM medía bien (`getBoundingClientRect` daba la
  cabecera en `top: 0`), pero las capturas salían en blanco o con el contenido desplazado
  cientos de píxeles, porque un panel oculto no repinta. `tabs_context` dice
  explícitamente si está oculto — mirarlo *antes* de creerse una captura ahorra la ronda
  entera de depurar un bug que no existe. Cuando pase, la salida es capturar por CDP
  contra el Chrome del sistema: Node trae `WebSocket` global desde la v22, así que un
  script de ~50 líneas sin dependencias da control total del viewport, del
  `deviceScaleFactor` (2 para poder leer el texto) y del scroll. Dos avisos si lo
  rehaces: `chrome --headless --screenshot` con un `#ancla` en la URL captura a mitad del
  desplazamiento suave y sale medio en blanco, y para probar el tema oscuro hay que
  sembrar `localStorage` navegando primero al mismo origen, porque el tema se decide en
  el script de arranque del `<head>`.
  **Volvió a pasar el 8 de septiembre de 2026 y el CDP fue otra vez la salida buena**, con
  dos apuntes nuevos. Uno: con el panel oculto **el JavaScript sí funciona** aunque las
  capturas salgan en blanco, así que `javascript_tool` sigue sirviendo para medir el DOM y
  solo hay que irse fuera para *ver*. Dos: la extensión de Chrome puede no estar conectada,
  así que no cuentes con ella como plan B — el plan B es el script. Con él se puede además
  recorrer la app entera sola (pulsando `.nav-group button` por su texto) y auditar las
  siete pantallas de una pasada, que es como salieron casi todos los fallos de móvil.
- **Al auditar por script, distingue el desborde real del que tú mismo has provocado.** Un
  pseudoelemento transparente que agranda una zona de pulsación infla el `scrollWidth` de
  su botón y el de todos sus contenedores, así que un chequeo ingenuo de
  `scrollWidth > clientWidth` lo denuncia como rotura y te manda a "arreglar" algo que está
  bien. Lo que importa de verdad es más estrecho: elementos cuyo `getBoundingClientRect`
  se sale de la **ventana**, y nodos de texto con `text-overflow: ellipsis` que de verdad
  recortan. Con ese criterio salieron 72 combinaciones limpias y ni un falso positivo.
  Cuidado también con el contrario: un `scrollWidth` mayor puede ser un **sangrado
  deliberado** (`.journal-errors-legend li` lleva padding con margen negativo para que el
  hover llegue a los bordes, igual que `.topbar`). Comprueba de dónde sale antes de tocar
  nada: en esa sesión llegué a escribir un "arreglo" con su comentario explicando un
  problema que no existía, y hubo que deshacerlo.
- **El heredoc de Bash de esta herramienta se come las barras invertidas.** Un
  `cat > x.mjs <<'EOF'` con `\n`, `\s+` o `C:\\ruta` dentro llega al fichero como `n`, `s+`
  y `C:\ruta`, sin avisar. Costó tres rondas: un `spawn` de Chrome con la ruta rota, un
  `split(/s+/)` que partía los nombres de clase por la letra "s" y un `String.replace` que
  no encontraba nada. Para escribir scripts o cualquier cosa con escapes, usa la
  herramienta `Write`; el heredoc, solo para texto plano (los mensajes de commit van bien).
- Los commits van agrupados por qué cuentan, no por orden cronológico — cuando el
  trabajo mezcla features distintas en los mismos archivos, merece la pena separar por
  parche antes de comitear (`git apply --cached` con un patch recortado a mano) en vez
  de meterlo todo junto. Cada commit debe compilar por sí solo (`pnpm typecheck` antes
  de comitear, no solo al final).
  **Para repartos grandes hay algo mejor que recortar parches a mano**, y la pasada de
  móvil (380 líneas de `styles.css` en 8 historias) lo pedía: un script que parsea el
  unified diff y **reconstruye el fichero** eligiendo qué cambios entran, en vez de
  aplicar trozos con `git apply`. No hay desplazamientos ni fuzz entre pasos, y sobre todo
  se puede comprobar antes de tocar nada que aplicando **todos** los grupos sale el fichero
  final byte a byte — o sea, que el reparto no pierde ni traspapela ningún cambio. Después,
  para verificar de verdad "cada commit compila por sí solo": `git checkout <sha> -- web/src`
  en bucle sobre todos los commits, `pnpm typecheck` en cada uno y `git checkout HEAD --
  web/src` al final. Barato y es la única forma de saberlo, porque hacer typecheck con el
  árbol de trabajo entero no dice nada de los intermedios.
  **Pero ese `checkout` miente si la tanda añade ficheros nuevos**: no borra los que el
  commit antiguo no tenía, así que el typecheck del primer commit se hace con un
  componente del tercero delante y puede fallar (o pasar) por algo que ese commit no
  contiene. La forma exacta es un worktree desechable por sha —`git worktree add -q
  --detach <dir> <sha>`, enlazar `node_modules` del principal con `ln -s`, typecheck, y
  `git worktree remove --force`—, que arranca del árbol limpio de ese commit y nada más.
  **Cuando en el árbol hay trabajo de otra sesión mezclado en los mismos ficheros**
  (pasó el 21 de septiembre de 2026: la vista de Eventos estaba a medias en los i18n y en
  `styles.css` mientras se comiteaba Lucid), el reparto no puede escribir en el disco,
  porque pisaría ese trabajo. La salida es el mismo script de reconstrucción, pero
  escribiendo **solo al índice**: `git hash-object -w --stdin` con el contenido
  reconstruido y `git update-index --cacheinfo 100644,<sha>,<ruta>`. Los hunks ajenos se
  marcan como un grupo más que nunca entra. Dos comprobaciones hacen falta: antes, que
  todos los grupos juntos —incluido el ajeno— reproducen el árbol byte a byte; y
  después, que `git diff` (lo no preparado) mide exactamente lo mismo que medía el
  trabajo ajeno antes de empezar. Al comitear se guarda el índice, así que el árbol no se
  mueve y la otra sesión ni se entera. Primero, eso sí, hay que **darse cuenta**: mira
  `git status` antes de tocar nada, no solo antes de comitear.
- **Para probar SQL sin tocar producción, PGlite; para ensayar contra producción, un `DO`
  que se deshace solo.** PGlite (`@electric-sql/pglite`, instalado en el scratchpad) es un
  Postgres de verdad dentro de Node y admite roles: con un dueño `NOSUPERUSER BYPASSRLS`
  (lo que es `postgres` en Supabase) y las altas hechas como `supabase_auth_admin`, se
  reproduce el modelo de permisos real. Para ensayar en el Supabase de verdad: un solo
  `DO` que ejecuta la migración con `EXECUTE` (el fichero tal cual, entre `$mig$`), simula
  altas insertando en `auth.users` (solo exige `id`) y acaba en `RAISE EXCEPTION` con los
  resultados en JSON dentro del mensaje. La excepción lo deshace todo, DDL incluido, sin
  depender de cómo gestione el MCP las transacciones, y el resultado llega igual dentro del
  error. Después hay que comprobar que no queda nada **con un patrón específico**: buscar
  restos con `'%vuelta%'` devolvió dos usuarios reales de julio y pareció que el ensayo
  había dejado basura.
- git: local manda sobre origin, push normal sin `--force` salvo que se pida explícito.
- Antes de tocar el precio, la copia legal o cualquier texto contractual: es
  `web/public/legal.html` (se movió ahí al pasar el despliegue a Vite; se sirve igual en
  `/legal.html`), y ese texto es lo que ve un usuario de pago — cambios ahí no son solo
  estéticos. El precio, además, está escrito **en tres sitios que tienen que decir lo
  mismo**: Stripe, `PlansModal` de la app y el objeto `pricing` de
  `src/landing/landing.ts`.
