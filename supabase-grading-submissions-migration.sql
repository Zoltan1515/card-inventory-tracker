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
  created_at timestamptz default now(),
  primary key (submission_id, card_id)
);

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
