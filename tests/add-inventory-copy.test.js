const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('className="panelHeader addInventoryHeader"'), 'Add Inventory header should use the customer guidance layout.');
assert(page.includes('This section uploads your card to your <strong>Not Listed</strong> Inventory.'), 'Add a card should explain that manual adds go to Not Listed Inventory.');
assert(page.includes('All information here should be your cost for this card and the information you want to store.'), 'Add a card should explain that the form records cost and stored card info.');
assert(page.includes('label="Your cost per item"'), 'Purchase price field should be relabeled as Your cost per item.');
assert(page.includes('label="Date you purchased"'), 'Purchase date field should be relabeled as Date you purchased.');
assert(!page.includes('Import cards from PrimeLot or PSA CSV'), 'Manual Add Inventory tab should not show redundant CSV import copy.');
assert(!page.includes('Choose CSV'), 'Manual Add Inventory tab should not show the CSV file picker.');
assert(!page.includes('aria-label="Import cards from CSV"'), 'Manual Add Inventory tab should not render the CSV import panel.');
assert(css.includes('.addInventoryIntro') && css.includes('.addInventoryHeader'), 'Add Inventory guidance should have dedicated responsive styling.');

console.log('Add Inventory copy checks passed.');
