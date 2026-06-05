const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

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
  page.includes('<span>Buyer shipping: <strong>{money(sellingCard.shippingCharge || 0)}</strong></span>'),
  'Sale summary should make the carried-over buyer shipping amount visible.'
);

console.log('Sale shipping prefill checks passed.');
