const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('const showInventoryUtilityPanels = tab === "add" || (tab === "inventory" && statusFilter !== "Sold");'),
  'Cash/PrimeLot utility panels should only be enabled on Add Inventory or regular Inventory views.'
);
assert(
  page.includes('{session && showInventoryUtilityPanels && !cashAdjustments.length && !cashOnboardingDismissed && (') &&
  page.includes('className="cashOnboardingCard"'),
  'Cash onboarding should only show inside inventory utility views.'
);
assert(
  page.includes('{session && showInventoryUtilityPanels && (\n        <section className={`dashboardCashEntryPanel') &&
  page.includes('aria-label="Enter cash on hand from dashboard"'),
  'Cash on hand panel should only show inside inventory utility views.'
);
assert(
  page.includes('{session && showInventoryUtilityPanels && (\n        <section className="primeLotStatusCard"') &&
  page.includes('PrimeLot Storefront'),
  'PrimeLot storefront panel should only show inside inventory utility views.'
);

console.log('Inventory utility panel visibility checks passed.');
