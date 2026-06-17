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
  page.includes('inventoryMainSwitchButtonActive') && page.includes('inventoryMainSwitchButtonInactive') && !page.includes('activeInventoryMainView === "Not Listed" ? "primary" : "secondary"'),
  'Only the selected inventory main switch button should use the bright green primary style.'
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

assert(
  css.includes('.inventoryMainSwitchButtonInactive { border: 1px solid rgba(103,232,249,.28);') &&
    css.includes('background: linear-gradient(135deg, rgba(15,23,42,.86), rgba(8,16,34,.78));') &&
    css.includes('.inventoryMainSwitchButtonInactive span'),
  'Inactive inventory main switch button should be subdued instead of bright green.'
);

assert(
  css.includes('.inventoryMainSwitch span { border-radius: 999px; background: rgba(255,255,255,.14); padding: 6px 13px; font-size: 1.64rem; line-height: 1; font-weight: 1000; }'),
  'Inventory main switch count numbers should be about twice as large as the old compact pills.'
);

assert(
  page.includes('className={card.status === "Listed" ? "rowMoney askingRowMoney" : "rowMoney unlistedCostMoney"}') && page.includes('const activeInventoryDisplayPrice = (card: CardRecord) => card.status === "Listed" ? card.askingPrice'),
  'Listed inventory rows should make asking price the prominent row price instead of purchase cost.'
);

assert(
  page.includes('asking${cardQuantity(card) > 1 ? ` each • Qty ${cardQuantity(card)}` : ""} • cost ${money(card.purchasePrice)}') && css.includes('.askingRowMoney span'),
  'Listed inventory rows should label the asking price and keep purchase cost secondary.'
);

console.log('Inventory listing section checks passed.');
