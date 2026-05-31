-- Wicked Card Tracker: cash-on-hand adjustments
-- Run this in the Supabase SQL editor for the Wicked Card Tracker project.

create table if not exists public.cash_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  adjustment_type text not null default 'Cash Added' check (adjustment_type in ('Starting Cash', 'Cash Added', 'Cash Removed')),
  amount numeric not null default 0 check (amount >= 0),
  adjustment_date date not null default current_date,
  description text default '',
  created_at timestamptz default now(),
  created_by text default '',
  updated_at timestamptz default now(),
  updated_by text default '',
  constraint cash_adjustments_owner_check check (user_id is not null or workspace_id is not null)
);

create index if not exists cash_adjustments_user_date_idx on public.cash_adjustments(user_id, adjustment_date desc);
create index if not exists cash_adjustments_workspace_date_idx on public.cash_adjustments(workspace_id, adjustment_date desc);

alter table public.cash_adjustments enable row level security;

drop policy if exists "Users can manage own cash adjustments" on public.cash_adjustments;
create policy "Users can manage own cash adjustments"
on public.cash_adjustments
for all
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = cash_adjustments.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = cash_adjustments.workspace_id
      and wm.user_id = auth.uid()
  )
);
