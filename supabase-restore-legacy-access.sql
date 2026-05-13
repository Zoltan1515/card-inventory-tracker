-- Emergency legacy access restore for Wicked Card Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.
-- Purpose: if shared workspace RLS policies were added before every old row received a workspace_id,
-- this restores access to the logged-in user's own older rows where workspace_id is still null.

-- Cards
drop policy if exists "Users can view own legacy cards" on public.cards;
drop policy if exists "Users can insert own legacy cards" on public.cards;
drop policy if exists "Users can update own legacy cards" on public.cards;
drop policy if exists "Users can delete own legacy cards" on public.cards;

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

-- Expenses
drop policy if exists "Users can view own legacy expenses" on public.expenses;
drop policy if exists "Users can insert own legacy expenses" on public.expenses;
drop policy if exists "Users can update own legacy expenses" on public.expenses;
drop policy if exists "Users can delete own legacy expenses" on public.expenses;

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

-- Grading submissions
drop policy if exists "Users can view own legacy grading submissions" on public.grading_submissions;
drop policy if exists "Users can insert own legacy grading submissions" on public.grading_submissions;
drop policy if exists "Users can update own legacy grading submissions" on public.grading_submissions;
drop policy if exists "Users can delete own legacy grading submissions" on public.grading_submissions;

create policy "Users can view own legacy grading submissions"
  on public.grading_submissions for select
  using (workspace_id is null and auth.uid() = user_id);

create policy "Users can insert own legacy grading submissions"
  on public.grading_submissions for insert
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can update own legacy grading submissions"
  on public.grading_submissions for update
  using (workspace_id is null and auth.uid() = user_id)
  with check (workspace_id is null and auth.uid() = user_id);

create policy "Users can delete own legacy grading submissions"
  on public.grading_submissions for delete
  using (workspace_id is null and auth.uid() = user_id);
