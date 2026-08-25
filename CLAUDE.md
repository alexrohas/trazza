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

**El sistema de diseño**, cerrado el **25 de agosto de 2026** en seis commits: las
escalas de espaciado, letra y peso podadas a seis valores cada una, y una escalera de
proximidad que da a cada nivel de la jerarquía su propia distancia. Aplica a la app
entera, no a pantallas sueltas. Tiene sección propia más abajo — léela antes de tocar
`styles.css`.

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

Pantallas de React sin su pasada de pulido dedicada: **Movimientos** y **Journal** (el
Journal es la más grande y compleja, dejarla para el final). Ojo: el sistema de diseño
sí está aplicado en toda la app, esas dos incluidas, así que no se parte de cero — lo
que falta es la iteración pantalla a pantalla contra capturas reales.

Cabos sueltos de bajo impacto, arrástralos si tocas esos archivos pero no merece una
sesión aparte (verificados el 26 de agosto de 2026): `AccountHealth.tsx` y
`JournalPanel.tsx` no se importan en ningún sitio; en `styles.css` hay tres reglas
`.workspace` duplicadas —gana la última— y un bloque `.workspace-header` entero que no
usa ningún `.tsx`.

Y una decisión de gusto pendiente: la rejilla del Panel es `auto-fit` con suelo de
180px, que a 1280px da 5 columnas y deja la segunda fila con tres huecos vacíos; subir
el suelo a 220px daría filas de 4 y 3, con tarjetas más anchas.

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
- **Un importe truncado con elipsis es peor que no mostrarlo**, porque parece un dato y
  no lo es ("-425,00 US$" se leía "-425,00..."). Si un número no cabe, cambia el
  formato y no el tamaño de letra. Hay tres: `formatMoney` (con divisa), `formatAmount`
  (sin divisa) y `formatMoneyCompact` (sin divisa ni decimales, para cajas muy
  estrechas como las celdas del calendario del Journal).

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
