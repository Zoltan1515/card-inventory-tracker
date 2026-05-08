# Card Inventory Tracker

A local-first MVP for tracking trading card inventory, sales, fees, shipping, and real profit/loss.

## Current status

This first version stores data in your browser's localStorage so you can test the workflow immediately. Supabase/PostgreSQL is prepared as the next step for permanent cloud storage, login, backups, and photo uploads.

## Run locally

```bash
cd /Users/zoltan/card-inventory-tracker
npm install
npm run dev
```

Then open http://localhost:3000.

## MVP features

- Dashboard totals
- Add/edit/delete cards
- Status workflow: Purchased, Ready to List, Listed, Sold, Shipped
- Purchase cost tracking
- Listing fields
- Sale fields
- Fee and shipping fields
- Automatic cost basis, net proceeds, profit, and ROI
- Search and status filtering
- CSV export

## Next storage step

1. Create a Supabase project.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3. Create database tables for cards, purchases, sales, photos, and settings.
4. Replace localStorage persistence with Supabase CRUD.
