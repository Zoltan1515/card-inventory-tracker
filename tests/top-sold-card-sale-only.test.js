const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('return card.soldPrice > best.soldPrice ? card : best;'),
  'Top Sold should rank cards by actual card sale price only, not sale plus buyer shipping.'
);
assert(
  page.includes('card sale ${money(mostExpensiveSoldCard.soldPrice)}'),
  'Top Sold aria label should describe the card sale amount only.'
);
assert(
  page.includes('<strong>{money(mostExpensiveSoldCard.soldPrice)}</strong>'),
  'Top Sold display amount should show the actual card sold price only.'
);
assert(
  !page.includes('<strong>{money(cardNetSoldPrice(mostExpensiveSoldCard))}</strong>'),
  'Top Sold display should not show cardNetSoldPrice, because that includes buyer shipping.'
);

console.log('Top sold card sale-only checks passed.');
