# Card Inventory Tracker MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a usable first version for tracking trading card inventory from purchase to sale with profit/loss calculations.

**Architecture:** Start with a local-first Next.js app so Zoltan can use and test the workflow immediately. Prepare Supabase config and database schema for cloud persistence in the next phase.

**Tech Stack:** Next.js, React, TypeScript, CSS modules/global CSS, future Supabase/PostgreSQL.

---

## MVP Scope

### Included now
- Dashboard with inventory and profit/loss totals
- Add/edit/delete cards
- Card statuses: Purchased, Ready to List, Listed, Sold, Shipped
- Purchase fields: price, date, source, tax, inbound shipping
- Sale fields: sold price, date, platform, fees, outbound shipping, packaging
- Automatic cost basis, net proceeds, profit, ROI
- Search/filter by status and query
- CSV export
- Browser localStorage persistence for immediate testing

### Deferred
- Supabase auth and database persistence
- Photo uploads
- Bulk lot allocation
- eBay/TCGplayer/PriceCharting integrations
- AI card scanning
- Grading submission workflow

## Next implementation steps

1. Build local-first single-page MVP.
2. Verify build passes.
3. Have Zoltan test the workflow.
4. Create Supabase project and migrate storage to PostgreSQL.
5. Add auth and photo storage.
