-- Listing pricing migration for Wicked Card Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run

alter table public.cards
  add column if not exists asking_price numeric(12,2) default 0,
  add column if not exists lowest_acceptable_price numeric(12,2) default 0,
  add column if not exists listed_date date;

create index if not exists cards_listed_date_idx on public.cards(listed_date);

-- Backfill listed_date for existing listed cards when possible.
-- Uses updated_at first because existing listed cards may not have had a dedicated listed date yet.
update public.cards
set listed_date = coalesce(listed_date, updated_at::date, purchase_date)
where status = 'Listed'
  and listed_date is null;
