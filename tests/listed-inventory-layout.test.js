const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const pageSnippets = [
  'card.status === "Listed" ? "listedCardRow"',
  'className="listedMetaChips"',
  'Profit <strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}',
  'Minimum {money(card.lowestAcceptablePrice)}',
];

for (const snippet of pageSnippets) {
  if (!page.includes(snippet)) throw new Error(`Missing listed inventory JSX: ${snippet}`);
}

const removedAwkwardSnippets = [
  'Potential profit <strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}',
];

for (const snippet of removedAwkwardSnippets) {
  if (page.includes(snippet)) throw new Error(`Old listed paragraph layout should be gone: ${snippet}`);
}

const cssSnippets = [
  '.listedCardRow { grid-template-columns:',
  '.listedMetaChips',
  '.listedCardRow .inventoryControls',
  '.listedCardRow .listingEditButton',
  '.listedCardRow .rowActions',
  '.askingRowMoney { min-width: 0; justify-items: start; text-align: left; }',
];

for (const snippet of cssSnippets) {
  if (!css.includes(snippet)) throw new Error(`Missing listed inventory CSS: ${snippet}`);
}

console.log('Listed inventory layout checks passed.');
