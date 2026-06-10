const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('card?: CardRecord;'), 'Needs Attention items should carry the actual card record.');
assert(page.includes('action: "List Card"') && page.includes('card,'), 'Unlisted attention rows should be real card-backed List Card actions.');
assert(page.includes('onListCard={beginListingEdit}'), 'Needs Attention List Card should reuse the existing inventory listing modal opener.');
assert(page.includes('photoUrl ? (') && page.includes('className="attentionCardThumb"') && page.includes('No photo'), 'Needs Attention card rows should show the actual card image or an explicit no-photo placeholder.');
assert(page.includes('<button className="primary" type="button" onClick={() => { if (card) onListCard(card); }}>List Card</button>'), 'Unlisted Needs Attention rows should have a primary List Card button.');
assert(page.includes('<button className="secondary" type="button" onClick={() => onOpenItem(item)}>Edit card</button>'), 'Unlisted Needs Attention rows should still allow editing the card.');
assert(css.includes('.attentionCardItem') && css.includes('grid-template-columns: 74px minmax(0, 1fr) auto'), 'Needs Attention card rows should lay out thumbnail, details, and actions.');
assert(css.includes('.attentionItemActions') && css.includes('.attentionCardThumb'), 'Needs Attention card rows should have action and thumbnail styling.');

console.log('Needs Attention List Card UX checks passed.');
