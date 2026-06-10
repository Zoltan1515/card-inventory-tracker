const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('<section className="bulkGradingBar" aria-label="Bulk inventory actions">') &&
    page.includes('Select all shown') &&
    page.includes('Clear selected') &&
    page.includes('Send selected to grading'),
  'Inventory bulk action bar should keep the existing select/clear/post/grading actions.'
);

assert(
  css.includes('.bulkGradingBar { border: 1px solid var(--line);') &&
    css.includes('display: grid; grid-template-columns: minmax(220px, 1fr) auto;'),
  'Bulk action bar should use a stable two-column grid so selection text cannot push buttons around.'
);

assert(
  css.includes('.bulkGradingBar .rowActions { display: grid; grid-template-columns: repeat(4, max-content);') &&
    css.includes('flex-wrap: nowrap;'),
  'Bulk action buttons should stay in stable desktop columns instead of re-wrapping after click/selection changes.'
);

assert(
  css.includes('.rowActions button { flex: 0 0 auto; white-space: nowrap; }') &&
    css.includes('.primary, .secondary, .danger, .navButton, .buttonLink, .filterToggleButton, .exportInventoryButton { white-space: nowrap; }'),
  'Action buttons should not resize/wrap their labels when focused or clicked.'
);

assert(
  css.includes('.bulkGradingBar .rowActions button:focus, .bulkGradingBar .rowActions button:active, .bulkGradingBar .rowActions button:focus-visible { transform: none; }'),
  'Bulk action buttons should not transform on focus/active states because that can look like layout shift.'
);

assert(
  css.includes('@media (max-width: 1000px)') &&
    css.includes('.bulkGradingBar { grid-template-columns: 1fr; align-items: stretch; }') &&
    css.includes('.bulkGradingBar .rowActions { grid-template-columns: repeat(2, minmax(0, 1fr)); justify-content: stretch; }') &&
    css.includes('@media (max-width: 720px)') &&
    css.includes('.bulkGradingBar .rowActions { grid-template-columns: 1fr; }'),
  'Bulk action bar should still stack predictably on tablet/mobile without random wrapping.'
);

console.log('Bulk action layout stability checks passed.');
