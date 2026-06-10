const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const dbCard = fs.readFileSync(path.join(root, 'lib', 'dbCard.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('const [inlineCostDrafts, setInlineCostDrafts] = useState<Record<string, string>>({});'), 'Inventory rows should keep inline cost edits in a draft state before saving.');
assert(page.includes('const inlineCostValue = (card: CardRecord) => inlineCostDrafts[card.id] ?? String(Number(card.purchasePrice || 0));'), 'Inline cost input should display the saved purchasePrice unless the user is editing.');
assert(page.includes('const saveInlineCost = async (card: CardRecord, rawValue: string) => {') && page.includes('purchasePrice: nextCost'), 'Inline cost input should save back to the card purchasePrice field.');
assert(page.includes('updateCard({ ...card, purchasePrice: nextCost') && dbCard.includes('purchase_price: card.purchasePrice'), 'Inline cost edits should persist to Supabase cards.purchase_price through the normal update path.');
assert(page.includes('Profit, inventory value, cash snapshot, and expense math now use'), 'Inline cost save notice should make clear the cost flows into app math.');
assert(page.includes('className="inlineCostField"') && page.includes('Your cost') && page.includes('aria-label={`Your cost for ${card.name}`}'), 'Not Listed rows should render a direct Your cost input.');
assert(page.includes('onBlur={(event) => void saveInlineCost(card, event.currentTarget.value)}') && page.includes('if (event.key === "Enter") event.currentTarget.blur();'), 'Inline cost should save on blur and Enter.');
assert(css.includes('.unlistedCostMoney') && css.includes('.inlineCostField input'), 'Inline cost field should have dedicated row styling.');

console.log('Unlisted inline cost field checks passed.');
