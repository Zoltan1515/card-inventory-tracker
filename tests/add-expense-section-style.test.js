const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('const [expenseModalOpen, setExpenseModalOpen] = useState(false);'), 'Expenses should use a dedicated add/edit modal state.');
assert(page.includes('const openAddExpenseModal = () => {') && page.includes('setActiveExpense(emptyExpense());') && page.includes('setEditingExpenseId(null);'), 'Add expense should reset to a blank expense before opening.');
assert(page.includes('<button className="primary" onClick={openAddExpenseModal} type="button">Add expense</button>'), 'Expenses tab should show a primary Add expense button like Add Inventory.');
assert(!page.includes('<section className="addExpenseCard" aria-labelledby="add-expense-heading">'), 'The expenses tab should not show an always-open add-expense form.');
assert(page.includes('{expenseModalOpen && (') && page.includes('aria-label={editingExpenseId ? "Edit expense" : "Add expense"}'), 'Add/edit expense should render in a modal dialog.');
assert(page.includes('<button className="secondary" type="button" onClick={() => openEditExpenseModal(expense)}>Edit</button>'), 'Edit should open the expense modal instead of filling an inline form.');
assert(page.includes('value={activeExpense.amount ? String(activeExpense.amount) : ""}'), 'New expense amount field should appear blank instead of showing 0.');

console.log('Add expense modal checks passed.');
