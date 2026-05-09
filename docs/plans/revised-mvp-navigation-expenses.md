# Revised Card Inventory Tracker MVP Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Refocus the app around a simple operating workflow: add inventory, view inventory, enter expenses separately, and see profit.

**Architecture:** Keep the current Next.js + Supabase app. Add an `expenses` table for non-card-specific costs. Simplify card fields by removing shipping/expense fields from the card form and moving expenses into a separate tab. Use card sale price for revenue and expenses for profit calculations.

**Tech Stack:** Next.js, React, TypeScript, Supabase Auth, Supabase PostgreSQL.

---

## User requirements

- Add a navbar with:
  - Add Inventory
  - Inventory
  - Expenses
  - Profit
- Add Inventory should be much simpler and used to add card/cards.
- Inventory should clearly show whether each card is unsold/listed/sold and where it is listed.
- Expenses should be separate and include expense categories/options:
  - HST
  - Duties
  - Grading fees
  - Shipping
  - Other
- Profit should show revenue minus expenses and resulting profit.
- Remove shipping from the card form; shipping belongs under Expenses.
- Marking a card sold must open/edit sale details, especially sold price. Profit updates from sold price.

## Implementation notes

- Cards retain sale price and status.
- Cards retain purchase price for inventory cost basis.
- Expenses are separate rows; optionally linked to a card later, but MVP can support optional card name/note only.
- Profit formula for MVP:
  - Revenue = sum sold_price for sold/shipped cards
  - Inventory cost = sum purchase_price for sold/shipped cards
  - Expenses = sum all expense amounts
  - Profit = Revenue - Inventory cost - Expenses

## Verification

- `npm run build` passes.
- Browser shows login when signed out.
- Signed-in page has navbar tabs.
- Add Inventory has simplified fields only.
- Inventory can mark a card sold by entering sale price.
- Expenses tab can add HST/duties/grading/shipping expenses.
- Profit tab changes based on sold cards and expenses.
