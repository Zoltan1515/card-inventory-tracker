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
    page.includes('When you save, Cash on Hand will go down by'),
    'add inventory form must explain cash impact in regular-person language',
  ],
  [
    page.includes('cardPurchaseCost(activeCard) + inventoryExpenseTotal'),
    'cash impact must add purchase cost and linked HST/shipping/duties expenses',
  ],
  [
    page.includes('You do not need to add this purchase anywhere else.'),
    'add inventory guidance must prevent duplicate cash entries without confusing accounting language',
  ],
  [
    page.includes('Extra costs for this card (optional)') && page.includes('Only fill these in if you paid extra for this card'),
    'add inventory extra-cost section should use plain language',
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
