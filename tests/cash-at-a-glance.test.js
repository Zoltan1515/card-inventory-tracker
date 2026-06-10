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
assert(page.includes('label: "Business Numbers"'), 'Quick Actions should include Business Numbers.');
assert(page.includes('id="at-a-glance-panel"'), 'At a Glance panel should render.');
assert(page.includes('<p className="eyebrow">Business Numbers</p>'), 'At a Glance panel should be titled Business Numbers.');
assert(page.includes('Cash on hand'), 'At a Glance should show cash on hand.');
assert(page.includes('Total Inventory Value'), 'At a Glance should show total inventory value.');
assert(page.includes('Total Sold'), 'At a Glance should show total sold.');
assert(!page.includes('Cash math'), 'At a Glance should not show the extra cash math bubble under the main stats.');
assert(!page.includes('aria-label="Report breakdown"'), 'At a Glance should not render the extra three-bubble report breakdown.');
assert(page.includes('onClick={() => window.print()}'), 'At a Glance should include print action.');
assert(page.includes('saveCashAdjustment'), 'Cash entry save handler should exist.');
assert(page.includes('id="dashboard-cash-entry"'), 'Dashboard should expose a front-page cash entry form, not hide it only in At a Glance.');
assert(page.includes('Enter actual business cash'), 'Dashboard cash entry should be clearly labeled for actual business cash.');
assert(page.includes('Only use this feature to add actual cash to your business or record cash removed.'), 'Dashboard cash entry should explain this is only for real cash added or removed.');
assert(page.includes('Purchases subtract automatically and sales add automatically.'), 'Collapsed dashboard cash entry should explain automatic purchase and sale cash movement.');
assert(page.includes('dashboardCashEntryOpen'), 'Dashboard cash entry should be collapsible instead of always taking up the full dashboard.');
assert(page.includes('dashboardCashEntryAutoOpened') && page.includes('!cashAdjustments.length'), 'Cash entry should auto-open the first time before any cash entries exist.');
assert(page.includes('aria-expanded={dashboardCashEntryOpen}'), 'Cash entry toggle should expose expanded/collapsed state accessibly.');
assert(page.includes('setDashboardCashEntryOpen(false);'), 'Cash entry should collapse after saving or canceling an edit.');
assert(page.includes('Getting started') && page.includes('Add your starting cash first'), 'Dashboard should onboard new users to add starting cash.');
assert(page.includes('CASH_ONBOARDING_DISMISSED_KEY'), 'Cash onboarding dismissal should persist locally.');
assert(page.includes('Add starting cash') && page.includes('scrollToDashboardCashEntry'), 'Cash onboarding should send users directly to the dashboard cash form.');
assert(css.includes('.dashboardCashEntryPanel'), 'Dashboard cash entry layout styles should exist.');
assert(css.includes('.cashEntryToggle'), 'Dashboard cash entry should have compact toggle styles.');
assert(css.includes('.dashboardCashEntryBody'), 'Dashboard cash entry body should be separate from the compact toggle.');
assert(css.includes('.cashOnboardingCard'), 'Cash onboarding card styles should exist.');
assert(page.includes('const cash = allCashAdjustmentsTotal + allRevenue - allTotalInventoryCost - allExpensesTotal;'), 'Cash on hand should use all-time cash entries plus sales minus purchases and expenses so new expenses update cash immediately.');
assert(page.includes('const expensesTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);'), 'Filtered expense totals should sum actual expense rows directly.');
assert(page.includes('unlistedInventoryValue + listedInventoryValue'), 'Total inventory value should include unlisted and listed inventory.');
assert(page.includes('DateFilterControls'), 'At a Glance should reuse date filters.');

assert(css.includes('@media print'), 'Print stylesheet should exist.');
assert(css.includes('.printableReport'), 'Print stylesheet should target printable report.');
assert(css.includes('.glanceHeroGrid'), 'At a Glance layout styles should exist.');
assert(css.includes('padding-bottom: calc(32px + env(safe-area-inset-bottom))'), 'Mobile content should not reserve oversized space for the removed bottom nav.');
assert(css.includes('bottom: max(12px, env(safe-area-inset-bottom))'), 'Mobile quick-action drawer should respect iPhone safe-area inset.');
assert(css.includes('.secondaryStatStrip::-webkit-scrollbar { display: none; }'), 'Mobile stat strip should not show an ugly horizontal scrollbar.');
assert(css.includes('input[type="date"]::-webkit-calendar-picker-indicator'), 'Date inputs should style the native picker indicator for dark mobile UI.');

assert(migration.includes('create table if not exists public.cash_adjustments'), 'Cash adjustments migration should create table.');
assert(migration.includes('enable row level security'), 'Cash adjustments migration should enable RLS.');
assert(migration.includes('workspace_members'), 'Cash adjustments migration should support shared workspace access.');

console.log('Cash on hand and At a Glance checks passed.');
