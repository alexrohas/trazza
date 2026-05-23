create extension if not exists pgcrypto;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_id uuid references public.firms(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  date date not null,
  title text not null check (length(trim(title)) >= 1),
  trade_direction text check (trade_direction in ('long', 'short')),
  trading_session text check (trading_session in ('asia', 'london', 'newYork', 'londonNewYork', 'other')),
  session_type text not null check (
    session_type in ('trading-day', 'evaluation', 'funded', 'payout-day', 'news-day', 'review', 'other')
  ),
  result text not null check (result in ('good', 'neutral', 'bad')),
  emotion text not null check (
    emotion in ('calm', 'focused', 'anxious', 'impatient', 'fomo', 'revenge', 'tired', 'other')
  ),
  discipline smallint not null check (discipline between 1 and 5),
  pnl numeric(12, 2) not null default 0,
  errors text[] not null default '{}',
  operation_url text,
  notes text,
  lesson text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries
  drop constraint if exists journal_entries_title_check;

alter table public.journal_entries
  add constraint journal_entries_title_check check (length(trim(title)) >= 1);

alter table public.journal_entries
  add column if not exists trade_direction text;

alter table public.journal_entries
  drop constraint if exists journal_entries_trade_direction_check;

alter table public.journal_entries
  add constraint journal_entries_trade_direction_check check (trade_direction in ('long', 'short'));

alter table public.journal_entries
  add column if not exists trading_session text;

alter table public.journal_entries
  drop constraint if exists journal_entries_trading_session_check;

alter table public.journal_entries
  add constraint journal_entries_trading_session_check check (
    trading_session in ('asia', 'london', 'newYork', 'londonNewYork', 'other')
  );

alter table public.journal_entries
  add column if not exists pnl numeric(12, 2) not null default 0;

alter table public.journal_entries
  add column if not exists errors text[] not null default '{}';

alter table public.journal_entries
  add column if not exists operation_url text;

create index if not exists journal_entries_user_date_idx on public.journal_entries (user_id, date desc);
create index if not exists journal_entries_user_firm_idx on public.journal_entries (user_id, firm_id);
create index if not exists journal_entries_user_account_idx on public.journal_entries (user_id, account_id);

alter table public.journal_entries enable row level security;

drop policy if exists "Journal entries are private" on public.journal_entries;
create policy "Journal entries are private"
  on public.journal_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.trazza_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row
  execute function public.trazza_set_updated_at();

create table if not exists public.journal_error_types (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  label text not null check (length(trim(label)) >= 2),
  color text not null default '#3b82f6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists journal_error_types_user_position_idx
  on public.journal_error_types (user_id, position, label);

alter table public.journal_error_types enable row level security;

drop policy if exists "Journal error types are private" on public.journal_error_types;
create policy "Journal error types are private"
  on public.journal_error_types
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists journal_error_types_set_updated_at on public.journal_error_types;
create trigger journal_error_types_set_updated_at
  before update on public.journal_error_types
  for each row
  execute function public.trazza_set_updated_at();
