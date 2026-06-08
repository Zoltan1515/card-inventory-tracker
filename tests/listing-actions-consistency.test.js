const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('const firstUrlInText'), 'Should detect a URL pasted into text fields.');
assert(page.includes('const listingHref'), 'Should calculate an effective listing link from Listing URL or listed-platform text.');
assert(page.includes('const listingPlatformLabel'), 'Should display a clean platform label when a URL was pasted into Listed where.');
assert(page.includes('platformUrl && !listingCard.listingUrl.trim()'), 'Saving listing should move a pasted platform URL into listingUrl.');
assert(page.includes('const [confirmingClearListing, setConfirmingClearListing] = useState<CardRecord | null>(null);'), 'Clear listing should use confirmation state.');
assert(page.includes('const requestClearListing = (card: CardRecord)'), 'Clear listing clicks should open a confirmation request.');
assert(page.includes('const confirmClearListing = async ()'), 'Clear listing should only run after confirmation.');
assert(page.includes('aria-label="Confirm clear listing"'), 'Clear listing should render a confirmation modal.');
assert(page.includes('Clear listing for {confirmingClearListing.name || "this card"}?'), 'Confirmation modal should name the card being cleared.');
assert(page.includes('Yes, clear listing'), 'Confirmation modal should have an explicit destructive confirmation button.');
assert(page.includes('Keep listing'), 'Confirmation modal should have a safe cancel action.');
assert(!page.includes('Clear all WCT listings'), 'Listed inventory rows should not show a duplicate clear-all link.');
assert(page.includes('{card.status === "Listed" && activeListingsForCard(card).some((listing) => listing.url) && ('), 'Listed rows should only render the external listing link row when a URL exists.');
assert(page.includes('onClick={() => requestClearListing(listingCard)}>Clear old listing / make Not Listed</button>'), 'Listing edit modal clear action should also require confirmation.');
assert(page.includes('activeListingsForCard(card).map((listing) => listing.url ? <a') && page.includes('Open {listing.platform}'), 'Listed cards should show each marketplace listing link when a URL exists.');

console.log('Listing action consistency checks passed.');
