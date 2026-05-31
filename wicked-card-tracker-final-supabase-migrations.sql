-- Wicked Card Tracker final Supabase SQL migration batch
-- Prepared for Zoltan on 2026-05-11.
-- Paste into Supabase Dashboard > SQL Editor > New query > Run.
-- IMPORTANT:
-- 1) Make sure BOTH account logins already exist in Supabase Auth before running:
--    - zoltankalman23@gmail.com
--    - Wickedcardsinc@gmail.com
-- 2) Do NOT run supabase-schema.sql on the existing production database unless rebuilding from scratch.
-- 3) This batch includes expenses, front-photo storage, listing pricing, shared workspace, and grading submissions.



-- ============================================================
-- SECTION 1: 1-expenses (supabase-expenses-migration.sql)
-- ============================================================

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

drop policy if exists "Users can view their own expenses" on public.expenses;
drop policy if exists "Users can insert their own expenses" on public.expenses;
drop policy if exists "Users can update their own expenses" on public.expenses;
drop policy if exists "Users can delete their own expenses" on public.expenses;

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


-- ============================================================
-- SECTION 2: 2-front-photo-storage (supabase-front-photo-migration.sql)
-- ============================================================

-- Front photo support for Card Inventory Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.

alter table public.cards
add column if not exists front_photo_url text default '',
add column if not exists back_photo_url text default '';

insert into storage.buckets (id, name, public)
values ('card-photos', 'card-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload their own card photos" on storage.objects;
drop policy if exists "Users can view card photos" on storage.objects;
drop policy if exists "Users can update their own card photos" on storage.objects;
drop policy if exists "Users can delete their own card photos" on storage.objects;

create policy "Users can upload their own card photos"
  on storage.objects for insert
  with check (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view card photos"
  on storage.objects for select
  using (bucket_id = 'card-photos');

create policy "Users can update their own card photos"
  on storage.objects for update
  using (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own card photos"
  on storage.objects for delete
  using (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- SECTION 3: 3-listing-pricing (supabase-listing-pricing-migration.sql)
-- ============================================================

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


-- ============================================================
-- SECTION 4: 4-shared-workspace (supabase-shared-workspace-migration.sql)
-- ============================================================

-- Shared workspace support for Wicked Card Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.
-- Emails have been filled in for the two shared logins.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Wicked Card Tracker',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

alter table public.cards add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.expenses add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists cards_workspace_id_idx on public.cards(workspace_id);
create index if not exists expenses_workspace_id_idx on public.expenses(workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Recreate policies so this script can be safely rerun.
drop policy if exists "Workspace members can view workspaces" on public.workspaces;
drop policy if exists "Users can create workspaces" on public.workspaces;
drop policy if exists "Workspace owners can update workspaces" on public.workspaces;
drop policy if exists "Workspace owners can delete workspaces" on public.workspaces;

drop policy if exists "Workspace members can view memberships" on public.workspace_members;
drop policy if exists "Workspace owners can add members" on public.workspace_members;
drop policy if exists "Workspace owners can update members" on public.workspace_members;
drop policy if exists "Workspace owners can remove members" on public.workspace_members;

drop policy if exists "Workspace members can view shared cards" on public.cards;
drop policy if exists "Workspace members can insert shared cards" on public.cards;
drop policy if exists "Workspace members can update shared cards" on public.cards;
drop policy if exists "Workspace members can delete shared cards" on public.cards;

drop policy if exists "Workspace members can view shared expenses" on public.expenses;
drop policy if exists "Workspace members can insert shared expenses" on public.expenses;
drop policy if exists "Workspace members can update shared expenses" on public.expenses;
drop policy if exists "Workspace members can delete shared expenses" on public.expenses;

create policy "Workspace members can view workspaces"
  on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

create policy "Users can create workspaces"
  on public.workspaces for insert
  with check (auth.uid() = created_by);

create policy "Workspace owners can update workspaces"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Workspace owners can delete workspaces"
  on public.workspaces for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Workspace members can view memberships"
  on public.workspace_members for select
  using (user_id = auth.uid());

-- Membership changes are handled from the Supabase SQL Editor for now.
-- That keeps the app simple and avoids exposing team-management controls in the UI.

create policy "Workspace members can view shared cards"
  on public.cards for select
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = cards.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can insert shared cards"
  on public.cards for insert
  with check (
    auth.uid() = user_id
    and workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = cards.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can update shared cards"
  on public.cards for update
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = cards.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = cards.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can delete shared cards"
  on public.cards for delete
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = cards.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can view shared expenses"
  on public.expenses for select
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = expenses.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can insert shared expenses"
  on public.expenses for insert
  with check (
    auth.uid() = user_id
    and workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = expenses.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can update shared expenses"
  on public.expenses for update
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = expenses.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = expenses.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can delete shared expenses"
  on public.expenses for delete
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = expenses.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Create one shared workspace for two existing auth users and move their current data into it.
-- Replace these emails with the two login emails you want to share one inventory.
do $$
declare
  shared_workspace_id uuid;
  owner_user_id uuid;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = lower('zoltankalman23@gmail.com')
  limit 1;

  if owner_user_id is null then
    raise exception 'Owner user email not found. Create the login first or replace zoltankalman23@gmail.com.';
  end if;

  select id into shared_workspace_id
  from public.workspaces
  where name = 'Wicked Card Tracker'
    and created_by = owner_user_id
  limit 1;

  if shared_workspace_id is null then
    insert into public.workspaces (name, created_by)
    values ('Wicked Card Tracker', owner_user_id)
    returning id into shared_workspace_id;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  select shared_workspace_id, id,
    case when id = owner_user_id then 'owner' else 'member' end
  from auth.users
  where lower(email) in (
    lower('zoltankalman23@gmail.com'),
    lower('Wickedcardsinc@gmail.com')
  )
  on conflict (workspace_id, user_id) do nothing;

  update public.cards
  set workspace_id = shared_workspace_id
  where user_id in (
    select id from auth.users
    where lower(email) in (
      lower('zoltankalman23@gmail.com'),
      lower('Wickedcardsinc@gmail.com')
    )
  );

  update public.expenses
  set workspace_id = shared_workspace_id
  where user_id in (
    select id from auth.users
    where lower(email) in (
      lower('zoltankalman23@gmail.com'),
      lower('Wickedcardsinc@gmail.com')
    )
  );
end $$;

-- If the second person signs up later, rerun only this block after replacing both emails:
-- insert into public.workspace_members (workspace_id, user_id, role)
-- select w.id, u.id, 'member'
-- from public.workspaces w
-- cross join auth.users u
-- where w.name = 'Wicked Card Tracker'
--   and lower(u.email) = lower('Wickedcardsinc@gmail.com')
-- on conflict (workspace_id, user_id) do nothing;


-- ============================================================
-- SECTION 5: 5-grading-submissions (supabase-grading-submissions-migration.sql)
-- ============================================================

-- Grading submissions support for Wicked Card Tracker.
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.
-- Run after the shared workspace migration if you want shared grading submissions.

create table if not exists public.grading_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  company text not null,
  sent_date date not null,
  returned_date date,
  status text not null default 'At Grading' check (status in ('At Grading', 'Returned')),
  reference text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.grading_submission_cards (
  submission_id uuid not null references public.grading_submissions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  quantity_sent integer not null default 1 check (quantity_sent > 0),
  created_at timestamptz default now(),
  primary key (submission_id, card_id)
);

alter table public.grading_submission_cards
  add column if not exists quantity_sent integer not null default 1 check (quantity_sent > 0);

create index if not exists grading_submissions_user_id_idx on public.grading_submissions(user_id);
create index if not exists grading_submissions_workspace_id_idx on public.grading_submissions(workspace_id);
create index if not exists grading_submissions_status_idx on public.grading_submissions(status);
create index if not exists grading_submission_cards_card_id_idx on public.grading_submission_cards(card_id);

alter table public.grading_submissions enable row level security;
alter table public.grading_submission_cards enable row level security;

-- Recreate policies so this script can be safely rerun.
drop policy if exists "Users can view their own grading submissions" on public.grading_submissions;
drop policy if exists "Users can insert their own grading submissions" on public.grading_submissions;
drop policy if exists "Users can update their own grading submissions" on public.grading_submissions;
drop policy if exists "Users can delete their own grading submissions" on public.grading_submissions;
drop policy if exists "Workspace members can view grading submissions" on public.grading_submissions;
drop policy if exists "Workspace members can insert grading submissions" on public.grading_submissions;
drop policy if exists "Workspace members can update grading submissions" on public.grading_submissions;
drop policy if exists "Workspace members can delete grading submissions" on public.grading_submissions;

drop policy if exists "Users can view grading submission cards" on public.grading_submission_cards;
drop policy if exists "Users can insert grading submission cards" on public.grading_submission_cards;
drop policy if exists "Users can delete grading submission cards" on public.grading_submission_cards;
drop policy if exists "Workspace members can view grading submission cards" on public.grading_submission_cards;
drop policy if exists "Workspace members can insert grading submission cards" on public.grading_submission_cards;
drop policy if exists "Workspace members can delete grading submission cards" on public.grading_submission_cards;

create policy "Users can view their own grading submissions"
  on public.grading_submissions for select
  using (workspace_id is null and auth.uid() = user_id);

create policy "Users can insert their own grading submissions"
  on public.grading_submissions for insert
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can update their own grading submissions"
  on public.grading_submissions for update
  using (workspace_id is null and auth.uid() = user_id)
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can delete their own grading submissions"
  on public.grading_submissions for delete
  using (workspace_id is null and auth.uid() = user_id);

create policy "Workspace members can view grading submissions"
  on public.grading_submissions for select
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = grading_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can insert grading submissions"
  on public.grading_submissions for insert
  with check (
    auth.uid() = user_id
    and workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = grading_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can update grading submissions"
  on public.grading_submissions for update
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = grading_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = grading_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can delete grading submissions"
  on public.grading_submissions for delete
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = grading_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Users can view grading submission cards"
  on public.grading_submission_cards for select
  using (
    exists (
      select 1 from public.grading_submissions gs
      where gs.id = grading_submission_cards.submission_id
        and gs.workspace_id is null
        and gs.user_id = auth.uid()
    )
  );

create policy "Users can insert grading submission cards"
  on public.grading_submission_cards for insert
  with check (
    exists (
      select 1 from public.grading_submissions gs
      join public.cards c on c.id = grading_submission_cards.card_id
      where gs.id = grading_submission_cards.submission_id
        and gs.workspace_id is null
        and gs.user_id = auth.uid()
        and c.user_id = auth.uid()
    )
  );

create policy "Users can delete grading submission cards"
  on public.grading_submission_cards for delete
  using (
    exists (
      select 1 from public.grading_submissions gs
      where gs.id = grading_submission_cards.submission_id
        and gs.workspace_id is null
        and gs.user_id = auth.uid()
    )
  );

create policy "Workspace members can view grading submission cards"
  on public.grading_submission_cards for select
  using (
    exists (
      select 1 from public.grading_submissions gs
      join public.workspace_members wm on wm.workspace_id = gs.workspace_id
      where gs.id = grading_submission_cards.submission_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can insert grading submission cards"
  on public.grading_submission_cards for insert
  with check (
    exists (
      select 1 from public.grading_submissions gs
      join public.cards c on c.id = grading_submission_cards.card_id
      join public.workspace_members wm on wm.workspace_id = gs.workspace_id
      where gs.id = grading_submission_cards.submission_id
        and c.workspace_id = gs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can delete grading submission cards"
  on public.grading_submission_cards for delete
  using (
    exists (
      select 1 from public.grading_submissions gs
      join public.workspace_members wm on wm.workspace_id = gs.workspace_id
      where gs.id = grading_submission_cards.submission_id
        and wm.user_id = auth.uid()
    )
  );

drop trigger if exists set_grading_submissions_updated_at on public.grading_submissions;
create trigger set_grading_submissions_updated_at
before update on public.grading_submissions
for each row
execute function public.set_updated_at();

-- Cash-on-hand adjustments
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
