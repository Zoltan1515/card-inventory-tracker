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

assert(
  page.includes('const saleExpenseTotalForCard = (card: CardRecord) => expenses.filter((expense) => isSaleExpenseForCard(expense, card)).reduce((sum, expense) => sum + expense.amount, 0);') &&
  page.includes('const totalProfitForCard = (card: CardRecord) => cardProfit(card) - saleExpenseTotalForCard(card);'),
  'Sold inventory rows should compute total profit after card cost and any sale expenses.'
);
assert(
  page.includes('<span>Total profit</span>') && page.includes('<strong>{money(totalProfitForCard(card))}</strong>') && page.includes('className={totalProfitForCard(card) >= 0 ? "soldProfit positive" : "soldProfit negative"}'),
  'Sold inventory rows should show total profit under the shipping collected column.'
);
assert(
  css.includes('.soldSummary .soldProfit.positive strong { color: var(--good); }') && css.includes('.soldSummary .soldProfit.negative strong { color: var(--bad); }'),
  'Sold row total profit should be color-coded positive or negative.'
);

console.log('Sold inventory row checks passed.');
