const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');
const csv = fs.readFileSync(path.join(root, 'lib', 'csv.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(card.includes('export type CardRefund'), 'Card refund type should exist.');
assert(card.includes('export const parseCardRefunds'), 'Card refunds should be parsed from saved card notes.');
assert(card.includes('export const cardRefundTotal'), 'Refund total helper should exist.');
assert(card.includes('export const cardNetSoldPrice'), 'Net sold amount helper should exist.');
assert(card.includes('export const appendCardRefundNote'), 'Refunds should be appended to card notes for persistence.');
assert(card.includes('export const cardProfit = (card: CardRecord) => cardNetSoldPrice(card) - cardPurchaseCost(card);'), 'Card profit should use net sold amount after refunds.');

assert(page.includes('type RefundDraft = { amount: string; refundDate: string; note: string }'), 'Refund draft should be typed.');
assert(page.includes('const [refundingCard, setRefundingCard] = useState<CardRecord | null>(null);'), 'Refund modal state should exist.');
assert(page.includes('const openRefundModal = (card: CardRecord)'), 'Sold cards should open a refund modal.');
assert(page.includes('const saveRefund = async (event: FormEvent)'), 'Refunds should have a save handler.');
assert(page.includes('appendCardRefundNote(currentCard.notes, refundAmount, refundDraft.refundDate || todayIso(), refundDraft.note)'), 'Refund save should persist refund details to the card.');
assert(page.includes('const revenue = soldCards.reduce((sum, card) => sum + cardNetSoldPrice(card), 0);'), 'Dashboard revenue should use net sold amount.');
assert(page.includes('const cash = cashAdjustmentsTotal + revenue - totalInventoryCost - expensesTotal;'), 'Cash dashboard should be driven from net revenue.');
assert(page.includes('const soldViewRevenue = isSoldInventoryView ? filteredCards.reduce((sum, card) => sum + cardNetSoldPrice(card), 0) : 0;'), 'Sold inventory totals should use net sold amount.');
assert(page.includes('Net sold amount shown'), 'Sold inventory stat label should clarify net sold amount.');
assert(page.includes('Refund full remaining amount'), 'Refund modal should offer a full refund action.');
assert(page.includes('Enter partial amount'), 'Refund modal should offer partial refund entry.');
assert(page.includes('Net sold after this refund'), 'Refund modal should preview dashboard impact.');
assert(page.includes('cardRefundTotal(card)'), 'Sold rows should show refunded amount.');
assert(page.includes('parseCardRefunds(card.notes).map'), 'Sold rows should display refund history.');
assert(page.includes('cardNetSoldPrice(card) <= 0 ? "Fully refunded" : "Refund"'), 'Fully refunded cards should disable further refunds.');
assert(page.includes('const reverseSoldToListed = async (card: CardRecord)'), 'Sold cards should have a reverse-to-listed handler.');
assert(page.includes('status: "Listed",'), 'Reverse sale should move the card back to Listed.');
assert(page.includes('saleDate: "",') && page.includes('salePlatform: "",') && page.includes('soldPrice: 0,'), 'Reverse sale should clear sold fields so dashboard revenue updates.');
assert(page.includes('setStatusFilter("Listed")'), 'Reverse sale should take the user back to the Listed tab.');
assert(page.includes('Move back to Listed'), 'Sold card rows should expose a Move back to Listed action.');
assert(page.includes('saleExpenseMatchesCard'), 'Reverse sale should identify sale expense rows tied to the sale.');
assert(page.includes('for (const expense of saleExpensesToRemove) await deleteExpense(expense);'), 'Reverse sale should remove matching sale HST/fee expense rows from reports.');

assert(csv.includes('["refundTotal", "Refund Total"]'), 'Sales CSV should include refund total.');
assert(csv.includes('["netSoldPrice", "Net Sold Price"]'), 'Sales CSV should include net sold amount.');
assert(css.includes('.refundModal'), 'Refund modal should have themed styling.');
assert(css.includes('.refundSummaryGrid'), 'Refund summary should have themed styling.');

console.log('Sold card refund checks passed.');
