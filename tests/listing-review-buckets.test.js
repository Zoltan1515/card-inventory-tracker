const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('type ListingReviewBucket = "current" | "warning" | "urgent" | "all"'), 'Listing Review should track an active date bucket.');
assert(page.includes('const [activeListingReviewBucket, setActiveListingReviewBucket] = useState<ListingReviewBucket | null>(null);'), 'Listing Review should start with no bucket selected so rows stay hidden.');
assert(page.includes('Use the date buckets as the focus. Listings stay hidden until you click a dollar amount below.'), 'Listing Review header should explain the bucket-first flow.');
assert(page.includes('0–30 days listed • ${listingReviewCounts.current} cards'), 'Current date bucket should be shown as a clickable dollar tab.');
assert(page.includes('30–60 days listed • ${listingReviewCounts.warning} cards'), 'Review-soon date bucket should be shown as a clickable dollar tab.');
assert(page.includes('60+ days listed • ${listingReviewCounts.urgent} cards'), 'Urgent date bucket should be shown as a clickable dollar tab.');
assert(page.includes('activeListingReviewBucket ? ('), 'Listing rows should only render after a bucket is selected.');
assert(page.includes('Pick a dollar amount above to open that date bucket. All individual listings are hidden until then.'), 'Listing Review should show a prompt instead of all rows by default.');
assert(page.includes('.map((card) => ({ card, listings: activeListingsForCard(card) }))'), 'Listing Review should create one review row per physical card, not one row per marketplace listing.');
assert(page.includes('key={card.id}'), 'Listing Review rows should be keyed by card id so cross-listed cards are not duplicated.');
assert(page.includes('listingReviewLinksForCard(card, listings)') && page.includes('Open {link.label}'), 'Listing Review should render separate clickable links for each marketplace.');
assert(page.includes('listingReviewPlatformsLabel(listings)'), 'Listing Review should summarize all platforms on one card row.');
assert(page.includes('aria-pressed={active}'), 'Clickable stat tabs should expose active state accessibly.');
assert(css.includes('.clickableStat'), 'Clickable dollar tabs should have styling.');
assert(css.includes('.activeStat'), 'Active dollar tab should be visually highlighted.');
assert(css.includes('.listingReviewPrompt'), 'Hidden-listing prompt should have dedicated styling.');
assert(page.includes('className="listingReviewMeta"'), 'Listing Review rows should use structured mobile-friendly detail chips instead of long bullet text.');
assert(css.includes('.listingReviewMeta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));') && css.includes('.listingReviewMeta { grid-template-columns: repeat(2, minmax(0, 1fr));'), 'Listing Review details should be compact chips on desktop and two-column chips on mobile.');
assert(css.includes('.listingReviewRow.compactRow { grid-template-columns: 1fr;') && css.includes('.listingReviewRow .rowActions { grid-template-columns: 1fr; }'), 'Mobile Listing Review rows should stack cleanly without narrow squeezed columns.');

console.log('Listing review bucket checks passed.');
