-- Reglas de cobro de una cuenta: consistencia, dias rentables y minimo para cobrar.
--
-- Se ejecuta a mano en el SQL Editor de Supabase. Es ADITIVO igual que
-- supabase-accounts-kind.sql: columnas nuevas, anulables y sin defecto. El legado
-- (app.js, archivado en legacy/) hace select * al leer y enumera columnas al escribir,
-- asi que ni se entera de estas ni las pisa si algun dia se vuelve a levantar.
--
-- Por que existen. La app ya guardaba las reglas que miden el RECORRIDO de la cuenta
-- (objetivo, drawdown maximo, drawdown diario) y las pinta en la barra. Lo que no
-- guardaba son las reglas que deciden si puedes COBRAR, que en las prop firms de
-- futuros son otras tres y viven en la letra pequena de cada plan:
--
--   consistency_pct  El dia mas rentable no puede pasar de X% del beneficio del ciclo.
--                    Es la causa numero uno de payout denegado del sector (Apex 30%,
--                    LucidPro 40%, LucidFlex 50% en evaluacion).
--   min_profit_days  Cuantos dias rentables hacen falta por ciclo (Topstep 5, Flex 5).
--   profit_day_min   Cuanto tiene que ganar un dia para contar como rentable. Topstep
--                    pide 200 $; donde no se exige minimo se deja a null y cuenta
--                    cualquier dia en verde.
--   payout_min       Beneficio minimo del ciclo para poder pedir el cobro.
--
-- NULL significa "esta firma no tiene esa regla" y no "cero": con cero, una cuenta sin
-- configurar afirmaria que su limite de consistencia es 0% y que le faltan dias que
-- nadie le pide. Por eso no hay relleno ni defecto — al reves que kind/drawdown_type,
-- donde si habia un valor correcto que derivar de lo existente.
--
-- El ciclo NO se guarda: va desde el ultimo payout registrado de esa cuenta en
-- transactions (category = 'payout'), y si no hay ninguno, desde el principio de la
-- cuenta. Es un dato que la app ya tiene, asi que guardarlo seria una segunda copia
-- que se desincroniza en cuanto alguien corrige la fecha de un payout.

-- ---------------------------------------------------------------------------
-- 0. ANTES DE NADA: mira que hay. Ejecuta solo esto primero y revisa el resultado.
-- ---------------------------------------------------------------------------
-- select kind, count(*) from public.accounts group by kind order by 2 desc;

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas. Idempotente: se puede reejecutar sin romper nada.
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists consistency_pct numeric;

alter table public.accounts
  add column if not exists min_profit_days integer;

alter table public.accounts
  add column if not exists profit_day_min numeric;

alter table public.accounts
  add column if not exists payout_min numeric;

-- ---------------------------------------------------------------------------
-- 2. Restricciones. Van con "not valid" implicito solo en el sentido de que las filas
--    existentes traen null y null pasa cualquier check, asi que no hace falta relleno
--    previo. El tope de consistencia es 100 y no 99: una firma puede no tener limite
--    (null), pero un 100% escrito a mano es una forma valida de decir "sin tope".
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_consistency_pct_check') then
    alter table public.accounts
      add constraint accounts_consistency_pct_check
      check (consistency_pct is null or (consistency_pct > 0 and consistency_pct <= 100));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_min_profit_days_check') then
    alter table public.accounts
      add constraint accounts_min_profit_days_check
      check (min_profit_days is null or min_profit_days >= 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_profit_day_min_check') then
    alter table public.accounts
      add constraint accounts_profit_day_min_check
      check (profit_day_min is null or profit_day_min >= 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_payout_min_check') then
    alter table public.accounts
      add constraint accounts_payout_min_check
      check (payout_min is null or payout_min >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Comprobacion final. Las cuatro deben existir y salir todas a null todavia:
--    las reglas las escribe cada usuario desde el formulario de la cuenta.
-- ---------------------------------------------------------------------------
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'accounts'
--   and column_name in ('consistency_pct', 'min_profit_days', 'profit_day_min', 'payout_min')
-- order by column_name;
--
-- select count(*) filter (where consistency_pct is not null) as con_consistencia,
--        count(*) filter (where min_profit_days is not null) as con_dias,
--        count(*) filter (where payout_min is not null) as con_minimo
-- from public.accounts;
