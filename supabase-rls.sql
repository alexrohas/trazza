-- RLS hardening for Trazza user-owned data.
-- Run this in Supabase SQL Editor before opening public signups.

create extension if not exists pgcrypto;

-- Helpful indexes for per-user reads.
create index if not exists firms_user_id_idx on public.firms (user_id);
create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists accounts_user_firm_idx on public.accounts (user_id, firm_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_user_firm_idx on public.transactions (user_id, firm_id);
create index if not exists transactions_user_account_idx on public.transactions (user_id, account_id);
create index if not exists journal_entries_user_date_idx on public.journal_entries (user_id, date desc);
create index if not exists journal_entries_user_firm_idx on public.journal_entries (user_id, firm_id);
create index if not exists journal_entries_user_account_idx on public.journal_entries (user_id, account_id);
create index if not exists journal_error_types_user_position_idx
  on public.journal_error_types (user_id, position, label);

alter table public.firms enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_error_types enable row level security;

revoke all on table public.firms from anon;
revoke all on table public.accounts from anon;
revoke all on table public.transactions from anon;
revoke all on table public.journal_entries from anon;
revoke all on table public.journal_error_types from anon;

grant select, insert, update, delete on table public.firms to authenticated;
grant select, insert, update, delete on table public.accounts to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.journal_entries to authenticated;
grant select, insert, update, delete on table public.journal_error_types to authenticated;

-- Remove any old policy on private app tables so no permissive policy remains.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('firms', 'accounts', 'transactions', 'journal_entries', 'journal_error_types')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

create policy "Firms are private"
  on public.firms
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Accounts are private"
  on public.accounts
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      firm_id is null
      or exists (
        select 1
        from public.firms
        where firms.id = accounts.firm_id
          and firms.user_id = auth.uid()
      )
    )
  );

create policy "Transactions are private"
  on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      firm_id is null
      or exists (
        select 1
        from public.firms
        where firms.id = transactions.firm_id
          and firms.user_id = auth.uid()
      )
    )
    and (
      account_id is null
      or exists (
        select 1
        from public.accounts
        where accounts.id = transactions.account_id
          and accounts.user_id = auth.uid()
      )
    )
  );

create policy "Journal entries are private"
  on public.journal_entries
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      firm_id is null
      or exists (
        select 1
        from public.firms
        where firms.id = journal_entries.firm_id
          and firms.user_id = auth.uid()
      )
    )
    and (
      account_id is null
      or exists (
        select 1
        from public.accounts
        where accounts.id = journal_entries.account_id
          and accounts.user_id = auth.uid()
      )
    )
  );

create policy "Journal error types are private"
  on public.journal_error_types
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
