-- Adds audit trail fields used by Wicked Card Tracker.
-- Run this once in Supabase SQL Editor after the existing cards/expenses/grading migrations.

alter table public.cards
  add column if not exists created_by text default '',
  add column if not exists updated_by text default '',
  add column if not exists listed_at timestamptz,
  add column if not exists listed_by text default '',
  add column if not exists sold_at timestamptz,
  add column if not exists sold_by text default '';

alter table public.expenses
  add column if not exists created_by text default '',
  add column if not exists updated_by text default '';

alter table public.grading_submissions
  add column if not exists created_by text default '',
  add column if not exists updated_by text default '',
  add column if not exists returned_by text default '';

-- Backfill existing records with available auth/user ids where possible.
update public.cards
set created_by = coalesce(nullif(created_by, ''), user_id::text),
    updated_by = coalesce(nullif(updated_by, ''), user_id::text)
where created_by is null or created_by = '' or updated_by is null or updated_by = '';

update public.expenses
set created_by = coalesce(nullif(created_by, ''), user_id::text),
    updated_by = coalesce(nullif(updated_by, ''), user_id::text)
where created_by is null or created_by = '' or updated_by is null or updated_by = '';

update public.grading_submissions
set created_by = coalesce(nullif(created_by, ''), user_id::text),
    updated_by = coalesce(nullif(updated_by, ''), user_id::text)
where created_by is null or created_by = '' or updated_by is null or updated_by = '';
