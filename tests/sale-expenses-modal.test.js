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
assert(page.includes('type SaleExpenseDraft = { hst: string; fees: string; shippingLabel: string }'), 'Sale modal should have a draft for HST, fees, and shipping label cost.');
assert(page.includes('const saleExpenseRowsForCard'), 'Sale modal should create expense rows for sale expenses.');
assert(page.includes('{ category: "HST", amount: expenseDraftAmount(saleExpenseDraft.hst) }'), 'Sale HST should save as an HST expense.');
assert(page.includes('{ category: "Marketplace Fees", amount: expenseDraftAmount(saleExpenseDraft.fees) }'), 'Sale fees should save as Marketplace Fees expenses.');
assert(page.includes('{ category: "Shipping", amount: expenseDraftAmount(saleExpenseDraft.shippingLabel) }'), 'Shipping label cost should save as a Shipping expense.');
assert(page.includes('description: saleExpenseDescriptionForCard(row.category, card)'), 'Sale expense descriptions should identify the card sale from the expense category.');
assert(page.includes('vendor: card.salePlatform || "Sale"'), 'Sale expenses should use the sold platform/vendor when available.');
assert(page.includes('const savedSaleExpenses = await insertExpenseRecords(saleExpenseRowsForCard'), 'Saving a sale should insert sale expense rows.');
assert(page.includes('setSaleExpenseDraft(emptySaleExpenseDraft())'), 'Sale expense inputs should reset after opening/canceling/saving.');
assert(page.includes('Optional HST, marketplace/payment fees, and shipping label cost.'), 'Sale modal should explain sale expenses and shipping label cost.');
assert(page.includes('sellingNetAfterExpenses') && page.includes('Total profit'), 'Sale modal should show net sale profit after HST/fees/shipping label.');
assert(page.includes('type SaleCelebration = { cardName: string; quantity: number; saleTotal: number; saleUnitPrice: number; shippingCharge: number; shippingUnitPrice: number; collectedTotal: number; purchaseCost: number; saleExpenseTotal: number; netProfit: number; remainingQuantity?: number; platform: string; listingRemovalReminder: MultiPlatformListing[] }'), 'Saved sale should have a typed celebration summary including listing removal reminders.');
assert(page.includes('const [saleCelebration, setSaleCelebration] = useState<SaleCelebration | null>(null);'), 'Sale save should track the celebration modal state.');
assert(page.includes('const showSaleCelebration = (card: CardRecord, savedSaleExpenses: ExpenseRecord[], remainingQuantity?: number)'), 'Sale save should prepare a celebration modal after saving.');
assert(page.includes('showSaleCelebration(soldCard, savedSaleExpenses)'), 'Full sale save should open the celebration modal.');
assert(page.includes('showSaleCelebration(insertedSold, savedSaleExpenses, availableQty - saleQty)'), 'Partial quantity sale save should open the celebration modal with remaining quantity.');
assert(page.includes('aria-label="Sale congratulations"'), 'Sale celebration modal should be accessible as a dialog.');
assert(page.includes('Congrats — you made a sale!'), 'Sale celebration modal should congratulate the user.');
assert(page.includes('aria-label="Sale price expenses and total profit"'), 'Sale celebration modal should have an easy-to-read sale breakdown list.');
assert(page.includes('Card sale (${money(saleCelebration.saleUnitPrice)} per card)'), 'Celebration should list card sale with per-card amount clearly.');
assert(page.includes('<small>Expenses</small><strong>{money(saleCelebration.saleExpenseTotal)}</strong>'), 'Celebration should list sale expenses clearly.');
assert(page.includes('<small>Total profit</small><strong'), 'Celebration should list total profit clearly.');
assert(page.includes('Nice — continue'), 'Sale celebration modal should have a themed continue action.');
assert(page.includes('View expenses'), 'Sale celebration modal should link to expense reports/details.');
assert(css.includes('.saleExpenseBox'), 'Sale expense fields should have dedicated modal styling.');
assert(css.includes('.saleCelebrationModal'), 'Sale celebration modal should have dedicated themed styling.');
assert(css.includes('.saleCelebrationList'), 'Sale celebration breakdown should use easy-to-read list styling.');
assert(css.includes('.saleCelebrationProfit'), 'Total profit should be visually emphasized in the celebration modal.');
assert(css.includes('radial-gradient(circle at 50% 20%'), 'Sale celebration backdrop should have neon themed glow.');
assert(css.includes('.saleCelebrationCard, .saleCelebrationActions { grid-template-columns: 1fr; }'), 'Sale celebration modal should collapse cleanly on mobile.');

console.log('Sale expense modal checks passed.');
