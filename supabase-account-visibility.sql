alter table public.accounts
  add column if not exists journal_visible boolean not null default true;

update public.accounts
set journal_visible = true
where journal_visible is null;
