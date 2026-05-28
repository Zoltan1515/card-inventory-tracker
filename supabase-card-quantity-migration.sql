-- Wicked Card Tracker: card quantity support
-- Run in Supabase Dashboard > SQL Editor after existing schema/migrations.

alter table public.cards
  add column if not exists quantity integer not null default 1;

update public.cards
set quantity = 1
where quantity is null or quantity < 1;

alter table public.cards
  drop constraint if exists cards_quantity_positive;

alter table public.cards
  add constraint cards_quantity_positive check (quantity >= 1);
