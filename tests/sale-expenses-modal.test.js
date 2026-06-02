const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');
const dbCard = fs.readFileSync(path.join(root, 'lib', 'dbCard.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(card.includes('"Marketplace Fees"'), 'Expense categories should include Marketplace Fees for sale fees.');
assert(dbCard.includes('category === "Marketplace Fees"'), 'DB expense category normalization should preserve Marketplace Fees.');
assert(page.includes('type SaleExpenseDraft = { hst: string; fees: string }'), 'Sale modal should have a draft for HST and fees.');
assert(page.includes('const saleExpenseRowsForCard'), 'Sale modal should create expense rows for sale expenses.');
assert(page.includes('{ category: "HST", amount: expenseDraftAmount(saleExpenseDraft.hst), label: "Sale HST" }'), 'Sale HST should save as an HST expense.');
assert(page.includes('{ category: "Marketplace Fees", amount: expenseDraftAmount(saleExpenseDraft.fees), label: "Sale fees" }'), 'Sale fees should save as Marketplace Fees expenses.');
assert(page.includes('description: `${row.label}: ${card.name}`'), 'Sale expense descriptions should identify the card sale.');
assert(page.includes('vendor: card.salePlatform || "Sale"'), 'Sale expenses should use the sold platform/vendor when available.');
assert(page.includes('const savedSaleExpenses = await insertExpenseRecords(saleExpenseRowsForCard'), 'Saving a sale should insert sale expense rows.');
assert(page.includes('setSaleExpenseDraft(emptySaleExpenseDraft())'), 'Sale expense inputs should reset after opening/canceling/saving.');
assert(page.includes('Optional HST and marketplace/payment fees. These save to Expenses and expense reports with this sale date.'), 'Sale modal should explain that sale expenses hit reports.');
assert(page.includes('Net after sale expenses'), 'Sale modal should show net sale profit after HST/fees.');
assert(css.includes('.saleExpenseBox'), 'Sale expense fields should have dedicated modal styling.');

console.log('Sale expense modal checks passed.');
