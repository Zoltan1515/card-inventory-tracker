const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('const unlistedInventoryValue = unlistedInventoryCost;') &&
    page.includes('const listedInventoryValue = listedCards.reduce((sum, card) => sum + ((card.askingPrice || card.purchasePrice) * cardQuantity(card)), 0);') &&
    page.includes('const totalInventoryValue = unlistedInventoryValue + listedInventoryCost;'),
  'Total inventory value should be unsold cost basis: unlisted cost plus listed cost, while listed value remains listed asking price.'
);

assert(
  page.includes('<button type="button" onClick={() => setTab("profit")}><small>Inventory Value</small><strong>{money(totals.totalInventoryValue)}</strong></button>') &&
    page.includes('<button type="button" onClick={() => setTab("listingReview")}><small>Listed Value</small><strong>{money(listedValue)}</strong></button>'),
  'The stat strip should keep Inventory Value separate from Listed Value.'
);

assert(
  page.includes('<Stat label="Listed asking value" value={money(totals.listedInventoryValue)} />') &&
    page.includes('<ProfitStatusSection title="Listed cards" cards={totals.listedCards} totalLabel="Listed asking value" total={totals.listedInventoryValue}'),
  'Profit listed-card summaries should use listed asking value, not total inventory cost basis.'
);

console.log('Inventory value cost-basis checks passed.');
