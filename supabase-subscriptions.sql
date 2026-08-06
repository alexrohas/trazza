-- Subscriptions table for Stripe billing. Run once in the Supabase SQL Editor.
-- Mirrors the RLS approach in supabase-rls.sql: users can only read their own row,
-- all writes happen server-side (service_role) from the Stripe webhook Edge Function.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'lifetime')),
  stripe_customer_id text,
  stripe_subscription_id text,
  price_id text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id);

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

revoke all on table public.subscriptions from anon;
grant usage on schema public to authenticated;
grant select on table public.subscriptions to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

create policy "Users can read their own subscription"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep updated_at current on every write (writes only ever come from service_role).
create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_subscriptions_updated_at();

-- Auto-create a 14-day trial row for every new signup, regardless of which
-- frontend (legacy app.js or React) created the auth.users row.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row
  execute function public.handle_new_user_subscription();

-- Backfill: give every existing user a trial row too, so nobody is locked out
-- by accident before you decide who gets a lifetime license.
insert into public.subscriptions (user_id, status, trial_ends_at)
select id, 'trialing', now() + interval '14 days'
from auth.users
on conflict (user_id) do nothing;

-- To grant one of your ~10 chosen users a lifetime license, run:
-- update public.subscriptions set status = 'lifetime' where user_id = '<uuid-here>';
