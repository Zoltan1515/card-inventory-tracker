const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'primelot', 'clear-listing', 'route.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('fetch("/api/primelot/clear-listing"'),
  'Clearing a PrimeLot listing in Wicked Card Tracker should call the PrimeLot clear-listing API first.'
);

assert(
  page.includes('if (!primeLotRemoved) return;'),
  'Card Tracker should not clear its local listing state when PrimeLot removal fails.'
);

assert(
  page.includes('Removed ${card.name} from PrimeLot and moved it back to Not Listed.'),
  'Success copy should make clear that the PrimeLot listing was removed and the card moved back to Not Listed.'
);

assert(
  route.includes('.from("single_cards")') && route.includes('.delete()'),
  'Clear-listing route should delete the PrimeLot single_cards listing.'
);

assert(
  route.includes('.eq("id", primeLotListingId)') && route.includes('.eq("user_id", primeLotSellerUserId)'),
  'Clear-listing route should target the seller-owned PrimeLot listing by listing id.'
);

assert(
  route.includes('primeLotListingIdFromUrl'),
  'Clear-listing route should extract the PrimeLot listing id from the saved listing URL.'
);

assert(
  route.includes('.eq("source_platform", "wickedcardtracker")') && route.includes('.eq("source_id", cardTrackerId)'),
  'Clear-listing route should fall back to source tracking when a listing URL is missing.'
);

console.log('PrimeLot clear-listing checks passed.');
