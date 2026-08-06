-- Run once in Supabase SQL Editor before saving payouts with profit split.
alter table public.transactions
  add column if not exists payout_gross_amount numeric,
  add column if not exists payout_profit_split numeric;

update public.transactions
set
  payout_gross_amount = coalesce(payout_gross_amount, amount),
  payout_profit_split = coalesce(payout_profit_split, 100)
where category = 'payout';

comment on column public.transactions.payout_gross_amount is
  'Gross amount deducted from the trading account for a payout.';

comment on column public.transactions.payout_profit_split is
  'Trader profit split percentage used to calculate the net payout received.';
