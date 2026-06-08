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
  page.includes('<Field label="Buyer shipping per item" type="number" value={String(sellingShippingUnitPrice)}'),
  'Sale modal should show buyer shipping per item so multi-quantity sales multiply shipping correctly.'
);
assert(
  page.includes('shippingCharge: Number(v || 0) * sellingQuantity'),
  'Sale modal shipping changes should store the total buyer shipping collected across quantity.'
);
assert(
  page.includes('<Field label="Sold price per item"') && page.includes('soldPrice: Number(v || 0) * sellingQuantity'),
  'Sale modal should take per-item sold price and store the total sold price for multi-quantity sales.'
);
assert(
  page.includes('soldPrice: sellingUnitPrice * nextQuantity') && page.includes('shippingCharge: sellingShippingUnitPrice * nextQuantity'),
  'Changing quantity should preserve the per-item price and shipping and update stored totals.'
);
assert(
  page.includes('<div><span>Shipping collected</span><strong>{money(sellingCard.shippingCharge || 0)}</strong></div>') &&
  page.includes('<small>{sellingQuantity} × {money(sellingShippingUnitPrice)} per card</small>'),
  'Sale summary should show buyer shipping per card and the multiplied total collected.'
);
assert(
  page.includes('<div className="saleMathTotal"><span>Total in</span><strong>{money(sellingCollectedTotal)}</strong></div>'),
  'Sale summary should show sale plus buyer shipping before expenses.'
);
assert(
  page.includes('{`Card sale (${money(saleCelebration.saleUnitPrice)} per card)`}') &&
  page.includes('{`Buyer shipping (${money(saleCelebration.shippingUnitPrice)} per card)`}') &&
  page.includes('<span><small>Total collected</small><strong>{money(saleCelebration.collectedTotal)}</strong></span>'),
  'Sale saved confirmation should include per-card sale, per-card shipping, and total collected.'
);
assert(
  page.includes('shippingLabel: ""') && page.includes('expenseDraftAmount(draft.shippingLabel)'),
  'Sale expense draft should include shipping label cost in sale expenses.'
);
assert(
  page.includes('<Field label="Shipping label cost" type="number" value={saleExpenseDraft.shippingLabel}') &&
  page.includes('If you bought the shipping label already, input your cost here. Otherwise you can input your shipping label cost later under the Expense tab.'),
  'Sale modal should let users add shipping label cost now or later in Expenses.'
);
assert(
  page.includes('{ category: "Shipping", amount: expenseDraftAmount(saleExpenseDraft.shippingLabel) }') && page.includes('description: saleExpenseDescriptionForCard(row.category, card)'),
  'Saving a sale should create a Shipping expense row for shipping label cost.'
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
assert(
  page.includes('e.currentTarget.select()'),
  'Input boxes should select their current value on focus so users can type over it.'
);

console.log('Sale shipping, quantity, label, and focus checks passed.');
