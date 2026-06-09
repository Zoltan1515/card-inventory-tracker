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
  page.includes('<strong>{money(card.shippingCharge || 0)}</strong>') &&
  page.includes('<span>Original cost</span>') &&
  page.includes('<strong>{money(cardPurchaseCost(card))}</strong>') &&
  page.includes('<span>Fees taken off</span>') &&
  page.includes('<strong>{money(saleExpenseTotalForCard(card))}</strong>'),
  'Sold inventory rows should separate the card sale amount, shipping collected, original cost, and fees taken off.'
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
  page.includes('const totalProfitForCard = (card: CardRecord) => cardProfit(card) - saleExpenseTotalForCard(card);') &&
  page.includes('const soldViewSaleExpenses = isSoldInventoryView ? filteredCards.reduce((sum, card) => sum + saleExpenseTotalForCard(card), 0) : 0;') &&
  page.includes('const soldViewProfit = soldViewRevenue - soldViewCost - soldViewSaleExpenses;'),
  'Sold inventory rows and sold-section totals should compute total profit after original cost and any sale expenses.'
);
assert(
  page.includes('<Stat label="Fees taken off shown" value={money(soldViewSaleExpenses)}') && page.includes('<Stat label="Original cost shown" value={money(soldViewCost)} />'),
  'Sold inventory section totals should show original cost and fees taken off before profit.'
);
assert(
  page.includes('<span>Total profit</span>') && page.includes('<strong>{money(totalProfitForCard(card))}</strong>') && page.includes('className={totalProfitForCard(card) >= 0 ? "soldProfit positive" : "soldProfit negative"}'),
  'Sold inventory rows should show total profit under the shipping collected column.'
);
assert(
  css.includes('.soldSummary .soldProfit.positive strong { color: var(--good); }') && css.includes('.soldSummary .soldProfit.negative strong { color: var(--bad); }') && css.includes('.soldSummary .soldDeduction strong { color: var(--bad); }'),
  'Sold row fees taken off and total profit should be color-coded clearly.'
);

console.log('Sold inventory row checks passed.');
