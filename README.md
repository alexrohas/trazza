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

## Datos y sesion

- Login con email/password mediante Supabase Auth.
- Empresas, cuentas, movimientos y journal se sincronizan en Supabase.
- `localStorage` se usa para respaldo local y migracion de datos antiguos.
- Puedes exportar/importar una copia en JSON desde la propia app.

Para activar el Journal en Supabase, ejecuta `supabase-journal.sql` en el SQL
editor del proyecto. La app seguira funcionando aunque la tabla no exista, pero
no podra guardar entradas de journal hasta crearla.

Para activar la waitlist de la landing, ejecuta `supabase-waitlist.sql` en el SQL
editor del proyecto. El formulario de `index.html` guarda los correos en
`public.waitlist_emails`.

## Incluye

- Dashboard con resultado neto, gastos, retiros, ROI, break-even y cuentas activas.
- Grafico interactivo de evolucion del capital con tooltip, zoom y arrastre.
- Registro de empresas.
- Registro de cuentas.
- Registro de movimientos economicos.
- Journal independiente con calendario mensual, P&L diario, P&L semanal, disciplina, estado mental y aprendizajes.
- Filtros y vistas por empresa, cuenta, movimiento y journal.
- Vista movil optimizada con tablas convertidas en tarjetas.
- Exportacion JSON/CSV e importacion JSON.
