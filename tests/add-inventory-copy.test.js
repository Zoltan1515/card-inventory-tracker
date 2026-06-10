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
assert(page.includes('aria-label="Import cards from PSA CSV"'), 'Add Inventory tab should offer a PSA-only CSV import panel.');
assert(page.includes('PSA CSV import') && page.includes('Import cards from PSA CSV'), 'CSV import copy should be clearly PSA-only.');
assert(page.includes('Choose PSA CSV'), 'CSV picker should be labeled as PSA CSV.');
assert(page.includes('Upload a PSA CSV, preview the rows, select the cards you want, then import them into your Not Listed inventory.'), 'PSA import should explain where cards go.');
assert(!page.includes('Import cards from PrimeLot or PSA CSV'), 'Add Inventory tab should not mention PrimeLot CSV import.');
assert(!page.includes('Upload a PrimeLot or PSA CSV'), 'Add Inventory tab should not suggest PrimeLot CSV upload.');
assert(css.includes('.addInventoryIntro') && css.includes('.addInventoryHeader'), 'Add Inventory guidance should have dedicated responsive styling.');

console.log('Add Inventory copy checks passed.');
