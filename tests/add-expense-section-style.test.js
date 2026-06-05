const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('<section className="addExpenseCard" aria-labelledby="add-expense-heading">'), 'Add expense form should be wrapped in a distinct card section.');
assert(page.includes('<p className="eyebrow">Add expense</p>'), 'Add expense section should have a clear label.');
assert(page.includes('<h3 id="add-expense-heading">Log a new cost</h3>'), 'Add expense section should have its own accessible heading.');
assert(page.includes('<span>Separate from expense history</span>'), 'Add expense section should clarify it is separate from history rows.');
assert(css.includes('.addExpenseCard'), 'Add expense card should have dedicated styling.');
assert(css.includes('border: 1px solid rgba(57,255,156,.36);'), 'Add expense card should stand out with a highlighted border.');
assert(css.includes('.addExpenseCard::after'), 'Add expense card should include a visual divider from the expense list.');
assert(css.includes('.addExpenseHeader'), 'Add expense card should have a styled header.');

console.log('Add expense section style checks passed.');
