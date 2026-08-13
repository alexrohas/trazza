-- Tipo de cuenta y enlace evaluacion -> fondeada.
--
-- Se ejecuta a mano en el SQL Editor de Supabase. Es ADITIVO a proposito: no toca la
-- columna status ni sus valores, asi que la app legada (app.js, la que sirve
-- trazzajournal.com con los usuarios de pago) sigue leyendo exactamente lo mismo que
-- hoy y no se entera del cambio. Las columnas nuevas no rompen a quien no las mira.
--
-- El modelo separa dos preguntas que hoy viven mezcladas en status:
--   kind   -> QUE es la cuenta: challenge, fondeada o capital propio
--   status -> QUE le ha pasado: sigue en los valores de siempre
-- Los tres estados que usa el React (activa / fallada / superada) caen sobre valores
-- que status ya tiene: active, failed y passed. Por eso no hace falta migrar el enum.

-- ---------------------------------------------------------------------------
-- 0. ANTES DE NADA: mira que hay. Ejecuta solo esto primero y revisa el resultado.
-- ---------------------------------------------------------------------------
-- select status, count(*), count(phase_target) filter (where phase_target > 0) as con_objetivo
-- from public.accounts group by status order by 2 desc;
--
-- Comprueba tambien de que tipo es la clave primaria, porque el enlace de abajo
-- declara parent_account_id como uuid y tiene que coincidir:
-- select data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'accounts' and column_name = 'id';

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas. Idempotente: se puede reejecutar sin romper nada.
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists kind text;

-- on delete set null y no cascade: borrar la evaluacion no debe llevarse por delante
-- la cuenta fondeada que salio de ella, solo deshacer el enlace.
alter table public.accounts
  add column if not exists parent_account_id uuid references public.accounts (id) on delete set null;

create index if not exists accounts_parent_idx on public.accounts (parent_account_id);

-- ---------------------------------------------------------------------------
-- 2. Relleno. Deriva el tipo de lo que ya hay: si la cuenta tiene objetivo de fase
--    es un challenge, y si no, una fondeada. Capital propio no se asigna a nadie
--    automaticamente porque no hay forma de distinguirlo con los datos actuales:
--    esas las marca el usuario a mano cuando las edite.
-- ---------------------------------------------------------------------------
update public.accounts
set kind = case when coalesce(phase_target, 0) > 0 then 'challenge' else 'funded' end
where kind is null;

-- ---------------------------------------------------------------------------
-- 3. Restriccion, despues del relleno para que no falle con las filas existentes.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_kind_check'
  ) then
    alter table public.accounts
      add constraint accounts_kind_check check (kind in ('challenge', 'funded', 'own'));
  end if;
end $$;

alter table public.accounts
  alter column kind set default 'challenge';

-- ---------------------------------------------------------------------------
-- 4. Enlace de las cuentas que ya existen. NO se automatiza: emparejar una
--    evaluacion con su fondeada requiere saber cual salio de cual, y eso no esta en
--    los datos. Se hace a mano, caso por caso.
--
--    Ejemplo real detectado en la cuenta de alexrgsbj@gmail.com: "Alpha Futures 25K"
--    solo tiene un gasto de 39,50 (la cuota del challenge) y "Alpha Futures 25K #2"
--    solo tiene 693,90 en retiros (payouts, que solo salen de fondeadas). Son la
--    evaluacion y la fondeada que salio de ella.
--
--    Descomenta y sustituye los ids despues de localizarlos con:
--      select id, name, status, kind from public.accounts where name ilike 'alpha futures%';
-- ---------------------------------------------------------------------------
-- update public.accounts set parent_account_id = '<id-de-Alpha-Futures-25K>'
--   where id = '<id-de-Alpha-Futures-25K-#2>';
--
-- -- La evaluacion no fallo: se supero, y de ella nacio la fondeada.
-- update public.accounts set status = 'passed'
--   where id = '<id-de-Alpha-Futures-25K>';

-- ---------------------------------------------------------------------------
-- 5. Comprobacion final.
-- ---------------------------------------------------------------------------
-- select kind, status, count(*) from public.accounts group by kind, status order by 1, 2;
-- select count(*) as sin_tipo from public.accounts where kind is null;  -- debe dar 0
