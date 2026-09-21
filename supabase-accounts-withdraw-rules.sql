-- Dos reglas mas de una cuenta: el beneficio minimo para poder retirar y el nivel al que
-- se bloquea el MLL trailing.
--
-- Se ejecuta a mano en el SQL Editor de Supabase. ADITIVO como
-- supabase-accounts-payout-rules.sql: columnas nuevas, anulables y sin defecto, que el
-- legado archivado ni lee ni escribe.
--
-- Salen de construir el catalogo de planes de Lucid (web/src/lib/firmCatalog.ts), al
-- comprobar sus reglas oficiales contra lo que Trazza sabia calcular:
--
--   withdraw_min_profit  Beneficio que tiene que QUEDAR EN LA CUENTA (lo ganado menos lo
--                        ya retirado) para poder pedir un cobro. No es lo mismo que
--                        payout_min, que mide solo el ciclo actual. Lucid pide retirar
--                        como minimo 500 $: en Flex el retiro tiene tope del 50 % del
--                        beneficio (hacen falta 1.000 $), y en Pro no se puede tocar el
--                        colchon de MLL + 100 $ (en una 50K, 2.600 $). Sin esta columna,
--                        una Flex 50K con cinco dias de 150 $ salia "Lista para cobrar"
--                        cuando no podia retirar nada.
--
--   trail_lock_offset    Cuanto por encima del balance inicial deja de subir el MLL
--                        trailing. Trazza lo bloqueaba siempre en el balance inicial,
--                        que es la convencion de Apex/Topstep; Lucid lo bloquea en
--                        inicial + 100 $, asi que en una cuenta de Lucid ya bloqueada la
--                        app ensenaba 100 $ mas de margen del que habia. NULL = 0, el
--                        comportamiento de siempre.
--
-- Como en las reglas de cobro, NULL significa "esta firma no tiene esa regla": una cuenta
-- sin configurar no se entera de que existen.

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas. Idempotente: se puede reejecutar sin romper nada.
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists withdraw_min_profit numeric;

alter table public.accounts
  add column if not exists trail_lock_offset numeric;

-- ---------------------------------------------------------------------------
-- 2. Restricciones. Las filas existentes traen null, que pasa cualquier check, asi que
--    no hace falta relleno previo.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_withdraw_min_profit_check') then
    alter table public.accounts
      add constraint accounts_withdraw_min_profit_check
      check (withdraw_min_profit is null or withdraw_min_profit >= 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_trail_lock_offset_check') then
    alter table public.accounts
      add constraint accounts_trail_lock_offset_check
      check (trail_lock_offset is null or trail_lock_offset >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Comprobacion final. Las dos deben existir y salir a null: las rellena el catalogo
--    al elegir un plan, o el usuario a mano desde el formulario de la cuenta.
-- ---------------------------------------------------------------------------
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'accounts'
--   and column_name in ('withdraw_min_profit', 'trail_lock_offset')
-- order by column_name;
