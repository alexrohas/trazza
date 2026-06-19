# trazza

Dashboard web para controlar finanzas de trading y el resultado real de cuentas: compras,
resets, activaciones, fees, payouts y refunds.

## Uso

La landing publica vive en `index.html` y la app esta en `app.html`. El proyecto
es estatico y no necesita build. Puedes abrir `index.html` directamente para
revisar la landing, o servirlo desde localhost para probar el flujo completo de
Supabase.

Opcion local:

```bash
python -m http.server 5173
```

Despues abre `http://localhost:5173` para la landing o
`http://localhost:5173/app.html` para la app.

## Nueva base React

La migracion profesional empieza en `web/`. Es una app React + Vite +
TypeScript aislada de la version estatica, asi que la app actual sigue
funcionando mientras se migran modulos.

```bash
cd web
pnpm install
pnpm dev
```

Por defecto se abre en `http://127.0.0.1:5174`. Si quieres conectar Supabase en
la nueva base, copia `web/.env.example` a `web/.env.local` y rellena
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

La base React ya incluye login/registro con Supabase Auth, carga de `firms`,
`accounts`, `transactions` y `journal_entries`, CRUD real para empresas,
cuentas, movimientos y journal, dashboard filtrable por empresa/cuenta/periodo,
ajustes de perfil/tema/exportacion, migracion desde JSON/localStorage legacy y
un importador CSV basico para el journal. Si no hay configuracion o falla la
sincronizacion, mantiene datos demo para que la UI siga navegable durante la
migracion.

## Datos y sesion

- Login con email/password mediante Supabase Auth.
- Empresas, cuentas, movimientos y journal se sincronizan en Supabase.
- `localStorage` se usa para respaldo local y migracion de datos antiguos.
- Puedes exportar/importar una copia en JSON desde la propia app.

Para activar el Journal en Supabase, ejecuta `supabase-journal.sql` en el SQL
editor del proyecto. La app seguira funcionando aunque la tabla no exista, pero
no podra guardar entradas de journal hasta crearla.

Antes de abrir registros publicos o migrar datos reales, ejecuta tambien
`supabase-rls.sql`. Ese script activa y fuerza RLS, retira permisos anonimos,
crea indices por usuario y deja politicas privadas para `firms`, `accounts`,
`transactions`, `journal_entries` y `journal_error_types`.

Para activar la waitlist de la landing, ejecuta `supabase-waitlist.sql` en el SQL
editor del proyecto. El formulario de `index.html` guarda los correos en
`public.waitlist_emails`.

## Incluye

- Dashboard con resultado neto, gastos, retiros, ROI, break-even, cuentas activas y filtros por empresa/cuenta/periodo.
- Grafico interactivo de evolucion del capital con tooltip, zoom y arrastre.
- Registro de empresas.
- Registro de cuentas.
- Registro de movimientos economicos.
- Journal independiente con calendario mensual, P&L diario, detalle por entrada, importacion CSV, disciplina, estado mental y aprendizajes.
- Ajustes de perfil, moneda, tema claro/oscuro y exportacion JSON en la base React.
- Migracion en React desde una copia JSON o desde localStorage legacy cuando exista en el mismo origen.
- Filtros y vistas por empresa, cuenta, movimiento y journal.
- Vista movil optimizada con tablas convertidas en tarjetas.
- Exportacion JSON/CSV e importacion JSON.
- Pagina legal base con aviso legal, privacidad, cookies, terminos y disclaimer financiero.

## Lanzamiento publico

- Revisa `LEGAL_LAUNCH_CHECKLIST.md` antes de abrir registros o pagos.
- Revisa `legal.html` antes de abrir pagos o cambiar las condiciones de la beta gratuita.
- Ejecuta `supabase-waitlist.sql` para guardar consentimiento de privacidad en la waitlist.
- Ejecuta `supabase-rls.sql` antes de abrir registros publicos para aislar los datos por usuario.
