const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');
const dbCard = fs.readFileSync(path.join(root, 'lib', 'dbCard.ts'), 'utf8');
const csv = fs.readFileSync(path.join(root, 'lib', 'csv.ts'), 'utf8');
const primeLotRoute = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(card.includes('sport: string;') && card.includes('sport: ""'), 'CardRecord should store a PrimeLot sport value with a blank default.');
assert(dbCard.includes('const sportFromCardNotes = (notes = "")') && dbCard.includes('sport: sportFromCardNotes(text(row.notes))'), 'Supabase card rows should recover the saved sport metadata from card notes.');
assert(csv.includes('["sport", "PrimeLot Sport"]'), 'Inventory and sales CSV exports should include PrimeLot Sport.');

assert(
  page.includes('const primeLotSportOptions = [') &&
    page.includes('{ value: "baseball", label: "Baseball" }') &&
    page.includes('{ value: "basketball", label: "Basketball" }') &&
    page.includes('{ value: "football", label: "Football" }') &&
    page.includes('{ value: "hockey", label: "Hockey" }') &&
    page.includes('{ value: "soccer", label: "Soccer" }') &&
    page.includes('{ value: "mma", label: "UFC / MMA" }') &&
    page.includes('{ value: "wrestling", label: "Wrestling" }') &&
    page.includes('{ value: "racing", label: "Racing" }') &&
    page.includes('{ value: "golf", label: "Golf" }') &&
    page.includes('{ value: "tennis", label: "Tennis" }') &&
    page.includes('{ value: "other", label: "Other Sport" }'),
  'WCT sport dropdown should use the same values PrimeLot accepts.'
);

assert(
  page.includes('value={activeCard.sport}') &&
    page.includes('onChange={(e) => setActiveCard(cardWithPrimeLotSport(activeCard, e.target.value))}') &&
    page.includes('value={editingCard.sport}') &&
    page.includes('onChange={(e) => setEditingCard(cardWithPrimeLotSport(editingCard, e.target.value))}'),
  'Add Inventory and Edit Card should expose a PrimeLot sport dropdown wired to the card.'
);

assert(
  page.includes('const notesWithPrimeLotSport = (notes: string, sport: string) =>') &&
    page.includes('Sport: ${normalizedSport}') &&
    page.includes('const cardWithPrimeLotSport = (card: CardRecord, sport: string): CardRecord =>') &&
    page.includes('}, preparedCard.sport || inferPrimeLotSport(preparedCard));') &&
    page.includes('}, editingCard.sport || inferPrimeLotSport(editingCard));'),
  'Saving Add Inventory and Edit Card should persist the selected sport into durable card metadata.'
);

assert(
  page.includes('const importedSport = normalizePrimeLotSport(csvValue(row, ["primelot sport", "sport", "league", "sport category", "sport type"]));') &&
    page.includes('const category = csvValue(row, ["category", "type", "game"]) || "Sports";') &&
    page.includes('}, importedSport);'),
  'CSV import should map sport/league columns into PrimeLot sport instead of misusing them as WCT category.'
);

assert(
  page.includes('!line.toLowerCase().startsWith("sport:")') &&
    page.includes('value={cleanListingNotes(activeCard.notes)}') &&
    page.includes('notesWithPrimeLotSport(e.target.value, activeCard.sport)') &&
    page.includes('notesWithPrimeLotSport(notesWithListings(e.target.value, activeListingsForCard(editingCard)), editingCard.sport)'),
  'Sport metadata should stay hidden from Notes textareas while preserving the dropdown value.'
);

assert(primeLotRoute.includes('"sport",'), 'PrimeLot route should allow sport on single-card rows.');
assert(primeLotRoute.includes('"sport",') && primeLotRoute.includes('privatePrimeLotDescriptionNoteLabels'), 'PrimeLot buyer-facing description should strip internal sport metadata.');

console.log('PrimeLot sport inventory checks passed.');
