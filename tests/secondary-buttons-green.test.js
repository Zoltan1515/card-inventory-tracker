const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  css.includes('.primary, .secondary { background: linear-gradient(135deg, var(--neon-green), #67e8f9);') &&
    css.includes('.primary, .secondary { background: linear-gradient(135deg, var(--neon-green), var(--primary));') &&
    css.includes('color: #031018') &&
    css.includes('box-shadow: 0 0 20px rgba(57,255,156,.2)'),
  'Primary and secondary buttons should use the existing green gradient style instead of cyan/dark bordered styles.'
);

assert(
  css.includes('.primary:hover, .secondary:hover { background: linear-gradient(135deg, #6dffb6, #7dd3fc);') &&
    css.includes('border-color: var(--neon-green)'),
  'Primary and secondary button hover states should stay green themed.'
);

assert(
  !css.includes('.secondary { background: rgba(8,16,34,.72);'),
  'Secondary buttons must not be overridden back to a dark background with dark text.'
);

assert(
  css.includes('.danger { background: rgba(248,113,113,.12); color: var(--bad); border: 1px solid rgba(248,113,113,.28); }'),
  'Danger/delete buttons should remain red.'
);

assert(
  page.includes('<button className="danger" onClick={() => requestDeleteCard(card)} type="button">Delete</button>') &&
    page.includes('<button className="danger" type="button" onClick={() => requestDeleteExpense(expense)}>Delete</button>') &&
    page.includes('<button className="danger" type="button" onClick={confirmDeleteGradingSubmission}>Yes, delete submission</button>'),
  'Delete actions should keep using danger styling, not secondary green styling.'
);

assert(
  css.includes('.exportInventoryButton { min-height: 44px; }') && !css.includes('.exportInventoryButton { min-height: 44px; border-color:'),
  'Export inventory should inherit green secondary button styling instead of overriding back to dark.'
);

assert(
  css.includes('.importFileButton { position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; min-width: 150px; min-height: 44px; color: #031018; }'),
  'Choose PSA CSV should keep dark text on the green gradient instead of overriding to white text.'
);

console.log('Secondary button green style checks passed.');
