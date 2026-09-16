-- Estrategias del journal: una tabla nueva y una columna nueva, nada mas.
--
-- ADITIVO a proposito, igual que supabase-journal-error-severity.sql: una tabla nueva
-- (journal_strategies) y una columna anulable en journal_entries (strategy_id). No toca
-- ninguna columna existente, asi que nada de lo que ya funciona deja de hacerlo.
--
-- POR QUE NO ES UNA FOREIGN KEY
-- Mismo criterio que journal_entries.errors (text[]): la relacion se resuelve por
-- coincidencia de id de texto, no por integridad referencial. Es la forma en que ya
-- funcionan los tipos de error, y romper esa uniformidad para las estrategias -con una
-- FK real solo aqui- complicaria el import/export de datos (mapImportedDataForCloud en
-- db.ts) sin necesidad real: una entrada con un strategy_id que ya no existe se limita a
-- no resolver nombre, no a fallar un insert.
--
-- SIN SEMILLAS POR DEFECTO
-- A diferencia de journal_error_types (8 tipos hardcodeados en journalErrors.ts, alli
-- porque el legado ya traia esos 8), las estrategias no existian en ninguna app antes de
-- esta migracion. No hay nada que igualar, asi que la tabla arranca vacia para todo el
-- mundo y no hace falta la tabla-tumba equivalente a
-- journal_deleted_default_error_types.
--
-- EL LEGADO NI SE ENTERA
-- app.js no conoce esta tabla ni la columna nueva: sigue leyendo y escribiendo
-- journal_entries igual que siempre, y strategy_id se queda a NULL en cualquier fila que
-- toque desde alli. No es un problema: la severidad de arriba ya establecio que una app
-- que no rellena una columna nueva no rompe nada, solo no aprovecha el dato.

-- ---------------------------------------------------------------------------
-- 0. ANTES DE NADA: mira que hay. Ejecuta solo esto primero.
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'journal_entries';
-- select count(*) as entradas, count(strategy_id) as con_estrategia from public.journal_entries;

-- ---------------------------------------------------------------------------
-- 1. Tabla nueva, mismo molde que journal_error_types sin la columna de color.
-- ---------------------------------------------------------------------------
create table if not exists public.journal_strategies (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  label text not null check (length(trim(label)) >= 2),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists journal_strategies_user_position_idx
  on public.journal_strategies (user_id, position, label);

alter table public.journal_strategies enable row level security;
alter table public.journal_strategies force row level security;

grant select, insert, update, delete on table public.journal_strategies to authenticated;

drop policy if exists "Journal strategies are private" on public.journal_strategies;
create policy "Journal strategies are private"
  on public.journal_strategies
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists journal_strategies_set_updated_at on public.journal_strategies;
create trigger journal_strategies_set_updated_at
  before update on public.journal_strategies
  for each row
  execute function public.trazza_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Columna nueva en journal_entries. Anulable y sin relleno: una entrada sin
--    estrategia significa justo eso, no "estrategia desconocida".
-- ---------------------------------------------------------------------------
alter table public.journal_entries
  add column if not exists strategy_id text;

-- ---------------------------------------------------------------------------
-- 3. Comprobacion final.
-- ---------------------------------------------------------------------------
-- select count(*) from public.journal_strategies;
-- -- Vacio al principio: se va llenando segun se creen estrategias desde React.
