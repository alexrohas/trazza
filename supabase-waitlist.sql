create extension if not exists pgcrypto;

create table if not exists public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing' check (length(trim(source)) between 1 and 80),
  user_agent text check (user_agent is null or length(user_agent) <= 500),
  launch_updates_consent boolean not null default true,
  privacy_accepted_at timestamptz,
  consent_text text,
  created_at timestamptz not null default now(),
  constraint waitlist_emails_email_format check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

alter table public.waitlist_emails
  add column if not exists launch_updates_consent boolean not null default true;

alter table public.waitlist_emails
  add column if not exists privacy_accepted_at timestamptz;

alter table public.waitlist_emails
  add column if not exists consent_text text;

create unique index if not exists waitlist_emails_email_unique_idx
  on public.waitlist_emails (lower(email));

alter table public.waitlist_emails enable row level security;

drop policy if exists "Anyone can join waitlist" on public.waitlist_emails;
create policy "Anyone can join waitlist"
  on public.waitlist_emails
  for insert
  to anon, authenticated
  with check (true);

grant insert on table public.waitlist_emails to anon;
grant insert on table public.waitlist_emails to authenticated;
