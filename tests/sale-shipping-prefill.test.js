const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('shippingCharge: Number(card.shippingCharge || 0),'),
  'Opening the sale modal should prefill buyer shipping from the listed card, defaulting blank/missing values to 0.'
);
assert(
  page.includes('<Field label="Buyer shipping charge" type="number" value={String(sellingCard.shippingCharge || 0)}'),
  'Sale modal should show the buyer shipping charge field with the prefilled or zero value.'
);
assert(
  page.includes('onChange={(v) => setSellingCard({ ...sellingCard, shippingCharge: Number(v || 0) })}'),
  'Sale modal shipping changes should be saved back onto the sold card.'
);
assert(
  page.includes('<Field label="Sold price per item"') && page.includes('soldPrice: Number(v || 0) * sellingQuantity'),
  'Sale modal should take per-item sold price and store the total sold price for multi-quantity sales.'
);
assert(
  page.includes('soldPrice: sellingUnitPrice * nextQuantity'),
  'Changing quantity should preserve the per-item price and update the stored sale total.'
);
assert(
  page.includes('<span>Buyer shipping collected: <strong>{money(sellingCard.shippingCharge || 0)}</strong></span>'),
  'Sale summary should make the carried-over buyer shipping amount visible as collected money.'
);
assert(
  page.includes('<span>Total collected: <strong>{money(sellingCollectedTotal)}</strong></span>'),
  'Sale summary should show sale plus buyer shipping before expenses.'
);
assert(
  page.includes('<span><small>Buyer shipping</small><strong>{money(saleCelebration.shippingCharge)}</strong></span>') &&
  page.includes('<span><small>Total collected</small><strong>{money(saleCelebration.collectedTotal)}</strong></span>'),
  'Sale saved confirmation should include buyer shipping and total collected.'
);
assert(
  card.includes('export const cardGrossSoldPrice') && card.includes('card.soldPrice + (card.shippingCharge || 0)'),
  'Gross sold price should include buyer shipping collected.'
);
assert(
  card.includes('export const cardNetSoldPrice') && card.includes('cardGrossSoldPrice(card) - cardRefundTotal(card)'),
  'Net sold price/profit should include buyer shipping collected, minus refunds.'
);
assert(
  page.includes('cardNetSoldPrice(soldCard))} collected'),
  'Sale notices should use total collected including buyer shipping.'
);

assert(
  page.includes('<Field label="Card sale total" type="number" value={String(editingCard.soldPrice)}') &&
  page.includes('<Field label="Buyer shipping collected" type="number" value={String(editingCard.shippingCharge || 0)}'),
  'Editing an existing sold card should allow fixing the card sale total and buyer shipping collected.'
);
assert(
  page.includes('<Field label="Card sale total" type="number" value={String(activeCard.soldPrice)}') &&
  page.includes('<Field label="Buyer shipping collected" type="number" value={String(activeCard.shippingCharge || 0)}'),
  'Adding a card directly as Sold should also record shipping collected separately from sale expenses.'
);

console.log('Sale shipping and quantity checks passed.');
