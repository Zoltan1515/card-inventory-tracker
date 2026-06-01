const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');
const dbCard = fs.readFileSync(path.join(root, 'lib', 'dbCard.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase-cash-adjustments-migration.sql'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

assert(card.includes('export type CashAdjustmentRecord'), 'Cash adjustment model should exist.');
assert(card.includes('emptyCashAdjustment'), 'Empty cash adjustment factory should exist.');
assert(dbCard.includes('rowToCashAdjustment'), 'Cash adjustment DB row mapper should exist.');
assert(dbCard.includes('cashAdjustmentToInsert'), 'Cash adjustment DB insert mapper should exist.');
assert(dbCard.includes('cashAdjustmentToUpdate'), 'Cash adjustment DB update mapper should exist.');

assert(page.includes('type Tab = "add" | "attention" | "listingReview" | "grading" | "inventory" | "expenses" | "profit" | "glance"'), 'At a Glance should be a dashboard tab.');
assert(page.includes('label: "At a Glance"'), 'Quick Actions should include At a Glance.');
assert(page.includes('id="at-a-glance-panel"'), 'At a Glance panel should render.');
assert(page.includes('Cash on hand'), 'At a Glance should show cash on hand.');
assert(page.includes('Total Inventory Value'), 'At a Glance should show total inventory value.');
assert(page.includes('Total Sold'), 'At a Glance should show total sold.');
assert(page.includes('onClick={() => window.print()}'), 'At a Glance should include print action.');
assert(page.includes('saveCashAdjustment'), 'Cash entry save handler should exist.');
assert(page.includes('id="dashboard-cash-entry"'), 'Dashboard should expose a front-page cash entry form, not hide it only in At a Glance.');
assert(page.includes('Enter starting cash or cash added'), 'Dashboard cash entry should be clearly labeled for starting cash.');
assert(page.includes('Getting started') && page.includes('Add your starting cash first'), 'Dashboard should onboard new users to add starting cash.');
assert(page.includes('CASH_ONBOARDING_DISMISSED_KEY'), 'Cash onboarding dismissal should persist locally.');
assert(page.includes('Add starting cash') && page.includes('scrollToDashboardCashEntry'), 'Cash onboarding should send users directly to the dashboard cash form.');
assert(css.includes('.dashboardCashEntryPanel'), 'Dashboard cash entry layout styles should exist.');
assert(css.includes('.cashOnboardingCard'), 'Cash onboarding card styles should exist.');
assert(page.includes('cashAdjustmentsTotal + revenue - totalInventoryCost - expensesTotal'), 'Cash on hand should include cash entries plus sales minus purchases and expenses.');
assert(page.includes('unlistedInventoryValue + listedInventoryValue'), 'Total inventory value should include unlisted and listed inventory.');
assert(page.includes('DateFilterControls'), 'At a Glance should reuse date filters.');

assert(css.includes('@media print'), 'Print stylesheet should exist.');
assert(css.includes('.printableReport'), 'Print stylesheet should target printable report.');
assert(css.includes('.glanceHeroGrid'), 'At a Glance layout styles should exist.');
assert(css.includes('padding-bottom: calc(152px + env(safe-area-inset-bottom))'), 'Mobile content should leave enough safe-area room for the fixed bottom nav.');
assert(css.includes('bottom: max(10px, env(safe-area-inset-bottom))'), 'Bottom mobile nav should respect iPhone safe-area inset.');
assert(css.includes('.secondaryStatStrip::-webkit-scrollbar { display: none; }'), 'Mobile stat strip should not show an ugly horizontal scrollbar.');
assert(css.includes('input[type="date"]::-webkit-calendar-picker-indicator'), 'Date inputs should style the native picker indicator for dark mobile UI.');

assert(migration.includes('create table if not exists public.cash_adjustments'), 'Cash adjustments migration should create table.');
assert(migration.includes('enable row level security'), 'Cash adjustments migration should enable RLS.');
assert(migration.includes('workspace_members'), 'Cash adjustments migration should support shared workspace access.');

console.log('Cash on hand and At a Glance checks passed.');
