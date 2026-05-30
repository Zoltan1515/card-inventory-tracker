-- PrimeLot account connection support for Wicked Card Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.
-- This stores the verified/pending link between one Card Tracker user/workspace and one PrimeLot seller profile.

create table if not exists public.primelot_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  primelot_seller_user_id uuid,
  primelot_seller_email text not null,
  primelot_store_slug text,
  status text not null default 'pending' check (status in ('pending', 'active', 'disconnected')),
  requested_intent text not null default 'connect' check (requested_intent in ('connect', 'create')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  connected_at timestamptz,
  disconnected_at timestamptz
);

create index if not exists primelot_connections_user_id_idx on public.primelot_connections(user_id);
create index if not exists primelot_connections_workspace_id_idx on public.primelot_connections(workspace_id);
create unique index if not exists primelot_connections_one_active_user_idx
  on public.primelot_connections(user_id)
  where workspace_id is null and status <> 'disconnected';
create unique index if not exists primelot_connections_one_active_workspace_idx
  on public.primelot_connections(workspace_id)
  where workspace_id is not null and status <> 'disconnected';

alter table public.primelot_connections enable row level security;

drop policy if exists "Users can view own PrimeLot connections" on public.primelot_connections;
drop policy if exists "Users can request own PrimeLot connections" on public.primelot_connections;
drop policy if exists "Users can update own pending PrimeLot connections" on public.primelot_connections;
drop policy if exists "Workspace members can view PrimeLot connections" on public.primelot_connections;
drop policy if exists "Workspace members can request PrimeLot connections" on public.primelot_connections;
drop policy if exists "Workspace members can update pending PrimeLot connections" on public.primelot_connections;

create policy "Users can view own PrimeLot connections"
  on public.primelot_connections for select
  using (workspace_id is null and auth.uid() = user_id);

create policy "Users can request own PrimeLot connections"
  on public.primelot_connections for insert
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can update own pending PrimeLot connections"
  on public.primelot_connections for update
  using (workspace_id is null and auth.uid() = user_id)
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Workspace members can view PrimeLot connections"
  on public.primelot_connections for select
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = primelot_connections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can request PrimeLot connections"
  on public.primelot_connections for insert
  with check (
    auth.uid() = user_id
    and workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = primelot_connections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can update pending PrimeLot connections"
  on public.primelot_connections for update
  using (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = primelot_connections.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    workspace_id is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = primelot_connections.workspace_id
        and wm.user_id = auth.uid()
    )
  );
