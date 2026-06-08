const fs = require('fs');
const path = require('path');
const assert = require('assert');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

assert(
  page.includes('quantity: cardQuantity(card),'),
  'Opening the sale modal for an active multi-quantity card should default to selling the full available quantity so a qty-2 card does not leave 1 Not Listed by accident.'
);

assert(
  page.includes('setSellingCard({ ...sellingCard, quantity: nextQuantity, soldPrice: sellingUnitPrice * nextQuantity, shippingCharge: sellingShippingUnitPrice * nextQuantity });'),
  'Changing the sale quantity should continue recalculating sold price and buyer shipping totals from per-item values.'
);

assert(
  page.includes('const saleQty = Math.min(availableQty, cardQuantity(sellingCard));') &&
    page.includes('if (saleQty < availableQty) {') &&
    page.includes('${availableQty - saleQty} left in inventory'),
  'Partial sales should still intentionally leave remaining quantity in active inventory only when the user lowers the sale quantity.'
);

console.log('Sale quantity default checks passed.');
