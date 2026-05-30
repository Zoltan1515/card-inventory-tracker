-- Wicked Card Tracker marketplace details migration
-- Run in Supabase Dashboard > SQL Editor > New query > Run.
-- Adds the fields needed to post accurate listings to PrimeLot and other marketplaces.

alter table public.cards
  add column if not exists outbound_shipping numeric(12,2) default 0,
  add column if not exists grading_company text default '',
  add column if not exists grade text default '';

update public.cards
set
  outbound_shipping = coalesce(outbound_shipping, 0),
  grading_company = coalesce(grading_company, ''),
  grade = coalesce(grade, '')
where outbound_shipping is null
   or grading_company is null
   or grade is null;

comment on column public.cards.outbound_shipping is 'Buyer shipping charge to carry from Card Tracker to marketplace listings.';
comment on column public.cards.grading_company is 'Professional grader such as PSA, BGS, SGC, CGC, or TAG.';
comment on column public.cards.grade is 'Assigned grade value, stored separately from grading company.';
