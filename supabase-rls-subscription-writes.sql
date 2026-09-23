-- El solo-lectura al caducar, tambien en la base de datos.
--
-- Se ejecuta a mano en el SQL Editor de Supabase. Rehace las politicas RLS de las siete
-- tablas de datos: la LECTURA queda exactamente igual, y escribir pasa a exigir prueba
-- viva o suscripcion. Idempotente: se puede reejecutar sin romper nada.
--
-- EL AGUJERO
-- Las politicas de estas tablas solo comprobaban que la fila fuera tuya
-- (auth.uid() = user_id). El solo-lectura al caducar lo imponia unicamente canMutateData
-- en el navegador, asi que quien sobrescribiera en las DevTools la respuesta de
-- subscriptions, o escribiera con su JWT directamente contra la API, tenia la app entera
-- gratis sin borrar nada. La importacion de JSON de Ajustes ni siquiera pasaba por guard().
--
-- EL ARREGLO
-- can_write_data() da la misma respuesta que isSubscriptionAccessActive en
-- web/src/hooks/useSubscription.ts: active y lifetime escriben; trialing, mientras no haya
-- pasado trial_ends_at (sin fecha, sin limite); past_due y canceled, no. Sin fila, si: es
-- el fail-open de canMutateData, y aqui ademas no se puede provocar, porque el trigger de
-- alta crea la fila siempre y desde la app nadie puede borrarla. Si cambias la regla en un
-- sitio, cambiala en el otro.
--
-- Cada politica "for all" se parte en cuatro. SELECT sigue mirando solo la propiedad;
-- INSERT, UPDATE y DELETE le suman can_write_data(). Las comprobaciones de propiedad que
-- ya tenian accounts, transactions y journal_entries (que firm_id y account_id sean tuyos)
-- se copian tal cual. Antes se borran TODAS las politicas de estas tablas, como hace
-- supabase-rls.sql: las politicas permisivas se suman con OR, y una sola que quedara por
-- ahi dejando escribir anularia todo esto.
--
-- COMO SE NOTA
-- - Quien paga o esta en prueba: en nada.
-- - Quien no puede escribir y usa la app normal: en nada tampoco; guard() le para antes
--   de llegar aqui y le abre los planes.
-- - Quien se salta el navegador: INSERT y UPDATE fallan con "new row violates row-level
--   security policy"; DELETE no da error, pero no borra nada (en DELETE, RLS filtra filas
--   en vez de fallar).
-- - Las Edge Functions (delete-account, el webhook, el checkout) usan service_role y no
--   se enteran: borrar la cuenta sigue funcionando con la prueba caducada.
--
-- subscriptions pasa a ser de solo lectura tambien por permisos, no solo por RLS: la regla
-- nueva se fia de ella, y authenticated tenia INSERT, UPDATE y DELETE concedidos por
-- defecto (lo unico que lo paraba era que no hubiera politica de escritura). En ella solo
-- escriben el trigger de alta y las Edge Functions, todas con service_role.
--
-- OJO: supabase-rls.sql, supabase-journal.sql, supabase-journal-strategies.sql y
-- supabase-journal-deleted-defaults.sql crean las politicas viejas "for all". Si
-- reejecutas cualquiera de ellos, reejecuta este justo despues: esa politica sola vuelve a
-- dejar escribir a cualquiera, pague o no.

-- ---------------------------------------------------------------------------
-- 1. Quien puede escribir.
-- ---------------------------------------------------------------------------
create or replace function public.can_write_data()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select case
              when s.status in ('active', 'lifetime') then true
              when s.status = 'trialing' then s.trial_ends_at is null or s.trial_ends_at > now()
              else false
            end
       from public.subscriptions s
      where s.user_id = (select auth.uid())),
    true
  );
$$;

-- SECURITY INVOKER (el defecto): lee subscriptions con los permisos de quien escribe, que
-- solo ve su propia fila, asi que no da acceso a nada nuevo. La tiene que poder ejecutar
-- authenticated, porque las politicas se evaluan con sus permisos; anon no escribe en
-- ninguna de estas tablas.
revoke execute on function public.can_write_data() from public, anon;
grant execute on function public.can_write_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. subscriptions, de solo lectura tambien por permisos.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on table public.subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Fuera todas las politicas de las siete tablas.
-- ---------------------------------------------------------------------------
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('firms', 'accounts', 'transactions', 'journal_entries',
                        'journal_error_types', 'journal_strategies',
                        'journal_deleted_default_error_types')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Cuatro politicas por tabla. UPDATE comprueba can_write_data() en WITH CHECK y no en
--    USING a proposito: asi falla con un error en vez de actualizar cero filas callando.
--    El (select ...) alrededor de auth.uid() y de can_write_data() hace que se calculen
--    una vez por consulta y no una vez por fila.
-- ---------------------------------------------------------------------------

-- firms
create policy "firms: owner reads" on public.firms
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "firms: owner inserts while subscribed" on public.firms
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "firms: owner updates while subscribed" on public.firms
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "firms: owner deletes while subscribed" on public.firms
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- accounts: la empresa, si la hay, tambien tiene que ser tuya.
create policy "accounts: owner reads" on public.accounts
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "accounts: owner inserts while subscribed" on public.accounts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      firm_id is null
      or exists (
        select 1 from public.firms
        where firms.id = accounts.firm_id and firms.user_id = (select auth.uid())
      )
    )
    and (select public.can_write_data())
  );
create policy "accounts: owner updates while subscribed" on public.accounts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      firm_id is null
      or exists (
        select 1 from public.firms
        where firms.id = accounts.firm_id and firms.user_id = (select auth.uid())
      )
    )
    and (select public.can_write_data())
  );
create policy "accounts: owner deletes while subscribed" on public.accounts
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- transactions: empresa y cuenta, si las hay, tambien tuyas.
create policy "transactions: owner reads" on public.transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "transactions: owner inserts while subscribed" on public.transactions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      firm_id is null
      or exists (
        select 1 from public.firms
        where firms.id = transactions.firm_id and firms.user_id = (select auth.uid())
      )
    )
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = transactions.account_id and accounts.user_id = (select auth.uid())
      )
    )
    and (select public.can_write_data())
  );
create policy "transactions: owner updates while subscribed" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      firm_id is null
      or exists (
        select 1 from public.firms
        where firms.id = transactions.firm_id and firms.user_id = (select auth.uid())
      )
    )
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = transactions.account_id and accounts.user_id = (select auth.uid())
      )
    )
    and (select public.can_write_data())
  );
create policy "transactions: owner deletes while subscribed" on public.transactions
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- journal_entries: empresa y cuenta, si las hay, tambien tuyas.
create policy "journal_entries: owner reads" on public.journal_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journal_entries: owner inserts while subscribed" on public.journal_entries
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      firm_id is null
      or exists (
        select 1 from public.firms
        where firms.id = journal_entries.firm_id and firms.user_id = (select auth.uid())
      )
    )
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = journal_entries.account_id and accounts.user_id = (select auth.uid())
      )
    )
    and (select public.can_write_data())
  );
create policy "journal_entries: owner updates while subscribed" on public.journal_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      firm_id is null
      or exists (
        select 1 from public.firms
        where firms.id = journal_entries.firm_id and firms.user_id = (select auth.uid())
      )
    )
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = journal_entries.account_id and accounts.user_id = (select auth.uid())
      )
    )
    and (select public.can_write_data())
  );
create policy "journal_entries: owner deletes while subscribed" on public.journal_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- journal_error_types
create policy "journal_error_types: owner reads" on public.journal_error_types
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journal_error_types: owner inserts while subscribed" on public.journal_error_types
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "journal_error_types: owner updates while subscribed" on public.journal_error_types
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "journal_error_types: owner deletes while subscribed" on public.journal_error_types
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- journal_strategies
create policy "journal_strategies: owner reads" on public.journal_strategies
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journal_strategies: owner inserts while subscribed" on public.journal_strategies
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "journal_strategies: owner updates while subscribed" on public.journal_strategies
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "journal_strategies: owner deletes while subscribed" on public.journal_strategies
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- journal_deleted_default_error_types
create policy "journal_deleted_default_error_types: owner reads" on public.journal_deleted_default_error_types
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journal_deleted_default_error_types: owner inserts while subscribed" on public.journal_deleted_default_error_types
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "journal_deleted_default_error_types: owner updates while subscribed" on public.journal_deleted_default_error_types
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.can_write_data()));
create policy "journal_deleted_default_error_types: owner deletes while subscribed" on public.journal_deleted_default_error_types
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.can_write_data()));

-- ---------------------------------------------------------------------------
-- 5. Comprobacion: cuatro politicas por tabla y ninguna "for all".
-- ---------------------------------------------------------------------------
-- select tablename, count(*) as politicas, string_agg(cmd, ',' order by cmd) as comandos
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('firms', 'accounts', 'transactions', 'journal_entries',
--                     'journal_error_types', 'journal_strategies',
--                     'journal_deleted_default_error_types')
-- group by tablename order by tablename;
