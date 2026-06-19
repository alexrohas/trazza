-- Run once in Supabase SQL Editor before using payout profit splits.
alter table public.transactions
  add column if not exists payout_gross_amount numeric,
  add column if not exists payout_profit_split numeric;

-- Existing payouts did not distinguish gross from net, so preserve their amount as 100%.
update public.transactions
set
  payout_gross_amount = coalesce(payout_gross_amount, amount),
  payout_profit_split = coalesce(payout_profit_split, 100)
where category = 'payout';

comment on column public.transactions.payout_gross_amount is
  'Gross amount deducted from the trading account for a payout.';
comment on column public.transactions.payout_profit_split is
  'Percentage of the gross payout received by the trader.';