# Wicked Card Tracker SQL runbook

Run this file in Supabase Dashboard > SQL Editor:

`/Users/zoltan/Desktop/card-inventory-tracker/wicked-card-tracker-final-supabase-migrations.sql`

## Before running

- Confirm both users have already created Supabase/Auth accounts:
  - `zoltankalman23@gmail.com`
  - `Wickedcardsinc@gmail.com`
- Do **not** run `supabase-schema.sql` unless rebuilding the database from scratch.

## Included order

1. Expenses table and policies
2. Front photo column/storage bucket/policies
3. Listing pricing fields
4. Shared workspace for the two emails
5. Grading submissions tables/policies, including per-card grading quantity (`quantity_sent`)

## After running

Refresh the production app and test:

- Sign in with each email.
- Confirm both accounts see the same inventory.
- Add an expense.
- Add/upload a front card photo.
- Mark/list a card with asking price and listed date.
- Create a grading submission from Inventory and mark it returned.
- Test a Qty 2 card by sending only Qty 1 to grading; confirm Qty 1 stays in inventory.
- Test returned grades by entering separate rows like Qty 1 PSA 10 and Qty 1 PSA 9.
