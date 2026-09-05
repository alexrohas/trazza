-- Registro de tipos de error "por defecto" borrados de verdad.
--
-- Es ADITIVO: crea una tabla nueva, no toca ninguna existente. La app legada
-- (app.html/app.js, la que sirve trazzajournal.com) ni se entera de que existe.
--
-- POR QUE HACE FALTA
-- React trae ocho tipos de error "por defecto" (Entrada tarde, FOMO, Revenge trade,
-- Riesgo excesivo, Sin stop claro, Salida temprana, Noticia/volatilidad, Fuera del
-- plan — ver defaultJournalErrorTypes en web/src/lib/journalErrors.ts) como una lista
-- fija en el codigo, no filas reales de journal_error_types, hasta que el usuario edita
-- u oculta uno por primera vez. mergeJournalErrorTypes los vuelve a sembrar en CADA
-- carga si no encuentra una fila real con ese id.
--
-- Eso hace que "borrar" uno nunca se quede borrado: el DELETE no encuentra fila que
-- tocar (Supabase no lo trata como error, borrar cero filas no lo es) y en el siguiente
-- reload() reaparece igual que antes. A peticion expresa del usuario ("quiero que me
-- deje borrar cualquier error, sea por defecto o no"), hace falta un sitio donde
-- guardar "este id se borro de verdad" para que mergeJournalErrorTypes pueda dejar de
-- sembrarlo — y tiene que vivir en Supabase, no en localStorage, porque el proyecto se
-- trabaja desde dos maquinas (Mac y Windows) y un borrado que no persiste en un
-- dispositivo desconcierta igual que el bug original.
--
-- Solo guarda el id del tipo, no una fila completa de journal_error_types: no hace
-- falta mas para que el merge sepa que no debe reinyectarlo.

-- ---------------------------------------------------------------------------
-- 0. ANTES DE NADA: mira que hay. Ejecuta solo esto primero.
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'journal_deleted_default_error_types';

-- ---------------------------------------------------------------------------
-- 1. Tabla. Idempotente: se puede reejecutar sin romper nada.
-- ---------------------------------------------------------------------------
create table if not exists public.journal_deleted_default_error_types (
  user_id uuid not null references auth.users (id) on delete cascade,
  type_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, type_id)
);

-- ---------------------------------------------------------------------------
-- 2. RLS, mismo patron que journal_error_types (ver supabase-rls.sql): cada usuario
--    solo ve y toca sus propias filas.
-- ---------------------------------------------------------------------------
alter table public.journal_deleted_default_error_types enable row level security;
alter table public.journal_deleted_default_error_types force row level security;

revoke all on table public.journal_deleted_default_error_types from anon;
grant select, insert, delete on table public.journal_deleted_default_error_types to authenticated;

drop policy if exists "Deleted default error types are private" on public.journal_deleted_default_error_types;
create policy "Deleted default error types are private"
  on public.journal_deleted_default_error_types
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Comprobacion final.
-- ---------------------------------------------------------------------------
-- select * from public.journal_deleted_default_error_types order by deleted_at desc;
