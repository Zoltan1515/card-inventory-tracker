const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('<div className="saleMathResultBreakdown"><span>Customer paid</span><strong>{money(sellingCollectedTotal)}</strong></div>') &&
  page.includes('<div className="saleMathResultBreakdown"><span>Your cost</span><strong>{money(sellingTotalCost)}</strong></div>'),
  'Final result card should summarize Customer paid and Your cost before the final profit/loss number.'
);

assert(
  page.includes('<div className="saleMathFinal"><span>{sellingNetAfterExpenses >= 0 ? "Total profit" : "Total loss"}</span><strong>{money(sellingNetAfterExpenses)}</strong></div>'),
  'Final result card should label the large result as Total profit or Total loss.'
);

assert(
  css.includes('.saleMathCard div { display: grid; grid-template-columns: minmax(0, 1fr) 120px') &&
  css.includes('font-variant-numeric: tabular-nums') &&
  css.includes('text-align: right'),
  'Sale math rows should use aligned grid columns with right-aligned tabular numbers.'
);

assert(
  css.includes('.saleMathCard.result { align-content: center') &&
  css.includes('justify-items: center') &&
  css.includes('.saleMathCard.result .saleMathFinal strong { font-size: 1.9rem; text-align: center; }'),
  'Final result holder should center its contents and emphasize the total profit/loss number.'
);

console.log('Sale math layout checks passed.');
