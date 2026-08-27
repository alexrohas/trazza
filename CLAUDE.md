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
paginación). Se cerraron cuatro huecos de contenido y se le dio el dinamismo que ya
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

## Qué queda

**Del plan original no queda nada abierto**, y a 26 de agosto de 2026 tampoco quedan
cabos: las siete pantallas de React están pulidas, Cuentas quedó cerrada y la severidad
de los errores dejó de ser una deducción (ver abajo).

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
  (sin divisa) y `formatMoneyCompact` (sin divisa ni decimales, para cajas muy
  estrechas como las celdas del calendario del Journal).
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

## El sistema de diseño — léelo antes de tocar `styles.css`

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
- Los commits van agrupados por qué cuentan, no por orden cronológico — cuando el
  trabajo mezcla features distintas en los mismos archivos, merece la pena separar por
  parche antes de comitear (`git apply --cached` con un patch recortado a mano) en vez
  de meterlo todo junto. Cada commit debe compilar por sí solo (`pnpm typecheck` antes
  de comitear, no solo al final).
- git: local manda sobre origin, push normal sin `--force` salvo que se pida explícito.
- Antes de tocar el precio, la copia legal o cualquier texto contractual: son
  `legal.html` y compañía, ese texto es lo que ve un usuario de pago — cambios ahí no
  son solo estéticos.
