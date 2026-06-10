const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('const listingNotesPrefix = "WCT_LISTINGS_JSON:";'), 'Inventory page should keep the internal listings metadata prefix centralized.');
assert(page.includes('const cleanListingNotes = (notes = "") => notes.split("\\n").filter((line) => !line.startsWith(listingNotesPrefix)).join("\\n").trim();'), 'Inventory page should expose a helper that removes internal listing metadata from human notes.');
assert(
  page.includes('<label className="full textareaLabel">Notes<textarea value={cleanListingNotes(editingCard.notes)}'),
  'Edit-card Notes textarea should show cleaned notes instead of raw WCT_LISTINGS_JSON metadata.'
);
assert(
  page.includes('notes: notesWithListings(e.target.value, activeListingsForCard(editingCard))'),
  'Editing visible notes should preserve the hidden multi-listing metadata used by Manage listings.'
);
assert(
  route.includes('cleanListingNotes(card.notes).trim() ? `Notes: ${cleanListingNotes(card.notes)}` : "",'),
  'PrimeLot listing description should also strip internal WCT_LISTINGS_JSON from posted notes.'
);

console.log('Listing notes metadata hiding checks passed.');
