-- Shared workspace support for Wicked Card Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.
-- IMPORTANT: Replace the two example emails near the bottom before running.

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
drop policy if exists "Users can view own legacy cards" on public.cards;
drop policy if exists "Users can insert own legacy cards" on public.cards;
drop policy if exists "Users can update own legacy cards" on public.cards;
drop policy if exists "Users can delete own legacy cards" on public.cards;

drop policy if exists "Workspace members can view shared expenses" on public.expenses;
drop policy if exists "Workspace members can insert shared expenses" on public.expenses;
drop policy if exists "Workspace members can update shared expenses" on public.expenses;
drop policy if exists "Workspace members can delete shared expenses" on public.expenses;
drop policy if exists "Users can view own legacy expenses" on public.expenses;
drop policy if exists "Users can insert own legacy expenses" on public.expenses;
drop policy if exists "Users can update own legacy expenses" on public.expenses;
drop policy if exists "Users can delete own legacy expenses" on public.expenses;

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

-- Keep older one-user rows visible/editable until they are assigned to the shared workspace.
create policy "Users can view own legacy cards"
  on public.cards for select
  using (workspace_id is null and auth.uid() = user_id);

create policy "Users can insert own legacy cards"
  on public.cards for insert
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can update own legacy cards"
  on public.cards for update
  using (workspace_id is null and auth.uid() = user_id)
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can delete own legacy cards"
  on public.cards for delete
  using (workspace_id is null and auth.uid() = user_id);

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

-- Keep older one-user expense rows visible/editable until they are assigned to the shared workspace.
create policy "Users can view own legacy expenses"
  on public.expenses for select
  using (workspace_id is null and auth.uid() = user_id);

create policy "Users can insert own legacy expenses"
  on public.expenses for insert
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can update own legacy expenses"
  on public.expenses for update
  using (workspace_id is null and auth.uid() = user_id)
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can delete own legacy expenses"
  on public.expenses for delete
  using (workspace_id is null and auth.uid() = user_id);

-- Create one shared workspace for two existing auth users and move their current data into it.
-- Replace these emails with the two login emails you want to share one inventory.
do $$
declare
  shared_workspace_id uuid;
  owner_user_id uuid;
begin
  select id into owner_user_id
  from auth.users
  where email = 'YOUR_EMAIL_HERE@example.com'
  limit 1;

  if owner_user_id is null then
    raise exception 'Owner user email not found. Create the login first or replace YOUR_EMAIL_HERE@example.com.';
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
  where email in (
    'YOUR_EMAIL_HERE@example.com',
    'SECOND_PERSON_EMAIL_HERE@example.com'
  )
  on conflict (workspace_id, user_id) do nothing;

  update public.cards
  set workspace_id = shared_workspace_id
  where user_id in (
    select id from auth.users
    where email in (
      'YOUR_EMAIL_HERE@example.com',
      'SECOND_PERSON_EMAIL_HERE@example.com'
    )
  );

  update public.expenses
  set workspace_id = shared_workspace_id
  where user_id in (
    select id from auth.users
    where email in (
      'YOUR_EMAIL_HERE@example.com',
      'SECOND_PERSON_EMAIL_HERE@example.com'
    )
  );
end $$;

-- If the second person signs up later, rerun only this block after replacing both emails:
-- insert into public.workspace_members (workspace_id, user_id, role)
-- select w.id, u.id, 'member'
-- from public.workspaces w
-- cross join auth.users u
-- where w.name = 'Wicked Card Tracker'
--   and u.email = 'SECOND_PERSON_EMAIL_HERE@example.com'
-- on conflict (workspace_id, user_id) do nothing;
