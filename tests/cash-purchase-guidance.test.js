const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

const checks = [
  [
    page.includes('Do not use it for card purchases — purchase price on Add Inventory already subtracts from cash.'),
    'cash entry panel must warn that purchases are not cash-added entries',
  ],
  [
    page.includes('Cash impact when saved: purchase cost'),
    'add inventory form must show purchase cost + linked expenses cash impact',
  ],
  [
    page.includes('cardPurchaseCost(activeCard) + inventoryExpenseTotal'),
    'cash impact must add purchase cost and linked HST/shipping/duties expenses',
  ],
  [
    page.includes('Do not add the purchase price again as a cash entry.'),
    'add inventory guidance must prevent duplicate cash entries',
  ],
  [
    css.includes('.cashImpactNote') && css.includes('rgba(57,255,156,.07)'),
    'cash impact note must have a visible style',
  ],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error('Cash purchase guidance checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Cash purchase guidance checks passed.');
