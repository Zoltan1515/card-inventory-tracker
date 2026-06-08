const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('Your cards imported successfully.'), 'PrimeLot success modal should lead with positive import success copy.');
assert(page.includes('Because you don’t have an active Seller membership yet, your imported listings have been saved as drafts in PrimeLot.'), 'Non-seller copy should explain imported listings were saved as drafts.');
assert(page.includes('Start a Seller membership when you’re ready, and you’ll be able to publish them to the marketplace.'), 'Non-seller copy should explain membership publishes drafts later without implying failure.');
assert(page.includes('Your listings are now live on the PrimeLot marketplace.'), 'Active seller copy should explain listings are live.');
assert(page.includes('Start Seller Membership'), 'Non-seller modal should include a clear seller membership CTA.');
assert(page.includes('View Drafts'), 'Non-seller modal should include a drafts/dashboard CTA.');
assert(page.includes('View Listings'), 'Active seller modal should include a view listings CTA.');
assert(page.includes('const primeLotSuccessHasDrafts = Boolean(primeLotPostResult?.draftListingCount);'), 'Success modal should branch from draft listing status.');
assert(!page.includes('PrimeLot posted live'), 'Success modal should not always claim PrimeLot listings went live.');
assert(!page.includes('Open first listing'), 'Success modal should use status-aware CTAs instead of Open first listing.');

console.log('PrimeLot import success modal checks passed.');
