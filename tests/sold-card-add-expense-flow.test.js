const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('const [expenseForSoldCard, setExpenseForSoldCard] = useState<CardRecord | null>(null);'), 'Sold-card expenses should track which sold card the expense belongs to.');
assert(page.includes('const saleExpenseCategories: ExpenseCategory[] = ["Shipping", "Marketplace Fees", "HST", "Other"];'), 'Sold-card expense modal should use a short sale-expense category list.');
assert(page.includes('const openSoldCardExpenseModal = (card: CardRecord) => {'), 'Sold card rows should have a dedicated add-expense opener.');
assert(!page.includes('{card.status === "Sold" && <button className="secondary" onClick={() => openSoldCardExpenseModal(card)} type="button">Add expense</button>}'), 'Sold cards should not show an Add expense button in the sold section.');
assert(page.includes('expenseForSoldCard ? `Add expense for ${expenseForSoldCard.name}`'), 'Expense modal title should make it clear when the expense is tied to a sold card.');
assert(page.includes('This cost will lower this card’s Total profit and Profit from sold cards.'), 'Sold-card expense modal should explain the profit impact in plain language.');
assert(page.includes('const normalizedSaleExpenseForCard = expenseForSoldCard ? normalizeSaleExpenseForCard(expenseToSave, expenseForSoldCard) : expenseToSave;'), 'Saving a sold-card expense should normalize date/vendor/description so profit math can link it to the card.');
assert(page.includes('expense.description === `Sale expense: ${card.name}`'), 'Sale expense matching should include other sale expenses added from the sold card row.');
assert(page.includes('const saleExpenseDraftFromCard = (card: CardRecord): SaleExpenseDraft =>'), 'Update sale should prefill existing saved sale expenses instead of showing blank fee fields.');
assert(page.includes('await replaceSaleExpensesForCard(soldCard, saleExpenseRowsForCard(soldCard))'), 'Update sale should replace matched sale expenses rather than adding duplicates every time the modal is saved.');

console.log('Sold-card add-expense flow checks passed.');
