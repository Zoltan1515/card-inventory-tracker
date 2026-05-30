const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('const [statusFilter, setStatusFilter] = useState<CardStatus | "All">("Not Listed");'),
  'Inventory should default to Not Listed instead of showing all active inventory.'
);

assert(
  page.includes('type InventoryMainView = "Not Listed" | "Listed";') && page.includes('showInventoryMainView'),
  'Inventory should have an explicit two-button Not Listed / Listed main view.'
);

assert(
  page.includes('Not listed <span>{notListedInventoryQuantity}</span>') && page.includes('Listed <span>{listedInventoryQuantity}</span>'),
  'Inventory should render two main buttons: Not listed and Listed.'
);

assert(
  page.includes('Not Listed: showing ${filteredInventoryQuantity} of ${notListedInventoryQuantity} cards to list'),
  'Not Listed section should be framed as the cards ready to list.'
);

assert(
  page.includes('Listed: showing ${filteredInventoryQuantity} of ${listedInventoryQuantity} listed cards'),
  'Listed section should have its own count and header.'
);

assert(
  css.includes('.inventoryMainSwitch'),
  'Two-button inventory switch should have dedicated styling.'
);

console.log('Inventory listing section checks passed.');
