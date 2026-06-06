const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('className="soldSummary"') &&
  page.includes('<span>Card sold</span>') &&
  page.includes('<strong>{money(card.soldPrice)}</strong>') &&
  page.includes('<span>Shipping collected</span>') &&
  page.includes('<strong>{money(card.shippingCharge || 0)}</strong>'),
  'Sold inventory rows should separate the card sale amount from shipping collected.'
);
assert(
  page.includes('card.status !== "Sold" && (') && page.includes('<span>{money(card.purchasePrice)}</span>'),
  'Sold inventory rows should not show a duplicate net-sold total in the right money column.'
);
assert(
  css.includes('.soldSummary strong') && css.includes('font-variant-numeric: tabular-nums') && css.includes('text-align: right'),
  'Sold row numbers should align cleanly with tabular right-aligned amounts.'
);
assert(
  css.includes('.soldCardRow .rowActions { display: grid') && css.includes('.soldCardRow .rowActions button { width: 100%'),
  'Sold row action buttons should be aligned in one clean right-side column.'
);

console.log('Sold inventory row checks passed.');
