const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!page.includes('Export eBay upload CSV'), 'Inventory screen should not show the eBay upload CSV export button for now.');
assert(!page.includes('exportEbayListings'), 'Inventory screen should not wire an eBay CSV export action for now.');
assert(!page.includes('ebayListingsToCsv'), 'Inventory page should not import the eBay CSV helper while the button is hidden.');
assert(
  page.includes('className="filterToggleButton"') && page.includes('Show filters') && page.includes('Hide filters'),
  'Show filters control should use the standout filterToggleButton styling.'
);
assert(
  page.includes('className="secondary exportInventoryButton"') && page.includes('Export filtered inventory') && page.indexOf('exportInventoryButton') > page.indexOf('inventoryFilterToggleRow'),
  'Export filtered inventory should live in the inventory filter toolbar, not the top header.'
);
assert(
  css.includes('.filterToggleButton {') && css.includes('border: 1px solid rgba(57,255,156,.58)') && css.includes('box-shadow: 0 0 0 1px rgba(103,232,249,.14), 0 0 22px rgba(57,255,156,.14)'),
  'Show filters button should stand out with neon border/glow styling.'
);
assert(
  css.includes('.inventoryToolbarActions') && css.includes('.exportInventoryButton') && css.includes('.filterStatus.active'),
  'Inventory toolbar should have dedicated layout, export, and filter status styling.'
);

console.log('Inventory toolbar checks passed.');
