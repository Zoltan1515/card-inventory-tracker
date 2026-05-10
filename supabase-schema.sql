-- Card Inventory Tracker MVP schema
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text default 'Sports',
  year text default '',
  set_name text default '',
  card_number text default '',
  variant text default '',
  condition text default 'Near Mint',
  raw_or_graded text default 'Raw',
  grading_company text default '',
  grade text default '',
  cert_number text default '',
  status text default 'Purchased',
  storage_location text default '',
  purchase_date date,
  purchase_source text default '',
  purchase_price numeric(12,2) default 0,
  purchase_tax numeric(12,2) default 0,
  inbound_shipping numeric(12,2) default 0,
  listed_platform text default '',
  listing_url text default '',
  asking_price numeric(12,2) default 0,
  lowest_acceptable_price numeric(12,2) default 0,
  listed_date date,
  sale_date date,
  sale_platform text default '',
  sold_price numeric(12,2) default 0,
  platform_fees numeric(12,2) default 0,
  payment_fees numeric(12,2) default 0,
  promoted_fees numeric(12,2) default 0,
  outbound_shipping numeric(12,2) default 0,
  packaging_cost numeric(12,2) default 0,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cards enable row level security;

create policy "Users can view their own cards"
  on public.cards for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cards"
  on public.cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cards"
  on public.cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own cards"
  on public.cards for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_cards_updated_at on public.cards;
create trigger set_cards_updated_at
before update on public.cards
for each row
execute function public.set_updated_at();
