const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('const isSaleExpenseForCard = (expense: ExpenseRecord, card: CardRecord) => {'),
  'Sale expenses should have a shared matcher so dashboard totals and move-back cleanup use the same sale-expense rows.'
);
assert(
  page.includes('expense.category === "HST" || expense.category === "Marketplace Fees" || expense.category === "Shipping"'),
  'Sale expense matching should include HST, marketplace fees, and shipping label costs entered while marking a card sold.'
);
assert(
  page.includes('expense.description === `Sale HST: ${card.name}` || expense.description === `Sale fees: ${card.name}` || expense.description === `Shipping label: ${card.name}`'),
  'Sale expense matching should only include expenses tied to that sold card sale.'
);
assert(
  page.includes('const saleExpensesTotalForCards = (sourceExpenses: ExpenseRecord[], sourceCards: CardRecord[]) => sourceExpenses') &&
  page.includes('.filter((expense) => sourceCards.some((card) => isSaleExpenseForCard(expense, card)))') &&
  page.includes('const saleExpensesForSoldCardsTotal = saleExpensesTotalForCards(expenses, soldCards);') &&
  page.includes('const soldCardProfit = revenue - soldInventoryCost - saleExpensesForSoldCardsTotal;'),
  'Profit from sold cards should subtract every sale expense tied to the sold cards in the selected sold-date period, even if the expense was entered later, while counting each expense row once.'
);
assert(
  page.includes('const cash = allCashAdjustmentsTotal + allRevenue - allTotalInventoryCost - allExpensesTotal;'),
  'Cash should still subtract all expenses once using all-time totals; sold-card profit subtracts only matched sale expenses for profit display.'
);

const exampleProfit = 80 + 15 - 70 - 16.52;
assert(exampleProfit === 8.48, 'Example sale math should be $80 + $15 - $70 - $16.52 = $8.48.');

console.log('Sold-card sale-expense profit checks passed.');
