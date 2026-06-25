const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

assert(
  page.includes('function NumberInput') &&
    page.includes('type="number"') &&
    page.includes('onWheel={(event) => event.currentTarget.blur()}'),
  'Number inputs should blur on wheel events so scrolling cannot nudge money fields by one cent.'
);

assert(
  page.includes('<Field label="Sold price per item" type="number"') &&
    page.includes('step={label.toLowerCase().includes("quantity") ? "1" : "0.01"}'),
  'Sold price per item should use the guarded shared number input with a one-cent money step.'
);

console.log('Number input wheel guard checks passed.');
