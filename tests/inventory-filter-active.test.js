const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filtersBlock = page.match(/const filtersAreActive = Boolean\(([\s\S]*?)\n  \);/);

assert(filtersBlock, 'filtersAreActive block should exist.');
assert(
  !filtersBlock[1].includes('statusFilter'),
  'Main inventory status views should not count as active filters.'
);
assert(
  filtersBlock[1].includes('query.trim()') &&
  filtersBlock[1].includes('categoryFilter !== "All"') &&
  filtersBlock[1].includes('inventorySort !== "newest-purchase"'),
  'Search, dropdown filters, date filters, and sort changes should still count as active filters.'
);

console.log('Inventory filter active-state checks passed.');
