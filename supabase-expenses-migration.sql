-- Add expenses support and simplified inventory workflow.
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category text not null default 'Other',
  amount numeric(12,2) not null default 0,
  expense_date date,
  description text default '',
  vendor text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Users can view their own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

-- Optional normalization for the revised statuses.
update public.cards
set status = case
  when status in ('Purchased', 'Ready to List') then 'Not Listed'
  when status = 'Shipped' then 'Sold'
  else status
end
where status in ('Purchased', 'Ready to List', 'Shipped');
