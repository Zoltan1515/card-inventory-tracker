const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('type MultiPlatformListing = {'), 'Page should model multiple marketplace listings for one inventory item.');
assert(page.includes('const listingNotesPrefix = "WCT_LISTINGS_JSON:"'), 'Multiple platform listings should be stored with a dedicated notes marker.');
assert(page.includes('const activeListingsForCard = (card: CardRecord): MultiPlatformListing[]'), 'Page should read all active listings for a card.');
assert(page.includes('const cardWithListings = (card: CardRecord, listings: MultiPlatformListing[]): CardRecord'), 'Saving listings should update one inventory card instead of duplicating counts.');
assert(page.includes('Saving another platform here does not create another card. It only adds another place where this same inventory is advertised.'), 'Listing modal should explain that another platform does not duplicate inventory.');
assert(page.includes('Current listings for this inventory item'), 'Listing modal should show current platform listings before adding another.');
assert(page.includes('Manage listings'), 'Listed inventory rows should let users manage multiple platform listings.');
assert(page.includes('activeListingsForCard(card).map((listing) => listing.url ? <a'), 'Listed rows should show each marketplace listing link.');
assert(!page.includes('Clear all WCT listings'), 'Inventory rows should not show the duplicate clear-all WCT listing action.');
assert(page.includes('listingRemovalReminder: otherListingsAfterSale(card)'), 'Sold flow should calculate other listings that may need removal.');
assert(page.includes('Remove/update this listing in WCT and on the real marketplace so it cannot sell twice.'), 'Sold notice should remind users to update WCT and real marketplaces.');
assert(page.includes('This sale is saved in WCT, but you still need to remove/update any other live marketplace listings so the card cannot sell twice.'), 'Sold celebration should remind users to remove/update remaining real marketplace listings.');
assert(css.includes('.saleListingReminder'), 'Sold listing reminder should have dedicated warning styling.');

console.log('Multi-platform listing checks passed.');
