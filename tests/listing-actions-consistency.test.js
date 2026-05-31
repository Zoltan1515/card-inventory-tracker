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
assert(page.includes('{card.status === "Listed" && (') && page.includes('<button className="inlineLinkButton" type="button" onClick={() => clearListingInfo(card)}>Clear listing</button>'), 'Listed cards should always show Clear listing, even without a listing URL.');
assert(page.includes('{listingHref(card) && <a href={listingHref(card)} target="_blank" rel="noreferrer">Open listing</a>}'), 'Listed cards should show Open listing when a listing URL exists or can be extracted.');

console.log('Listing action consistency checks passed.');
