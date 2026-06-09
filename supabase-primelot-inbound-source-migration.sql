-- PrimeLot -> Wicked Card Tracker inbound source tracking
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.
-- These columns let WCT skip duplicate imports by PrimeLot listing id safely.

alter table public.cards
add column if not exists source_platform text default '',
add column if not exists source_id text default '',
add column if not exists source_url text default '',
add column if not exists source_listing_type text default '';

create unique index if not exists cards_user_source_unique
on public.cards(user_id, source_platform, source_id)
where source_platform <> '' and source_id <> '';
