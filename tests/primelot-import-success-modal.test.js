const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('Your cards imported successfully.'), 'PrimeLot success modal should lead with positive import success copy.');
assert(!page.includes('Because you don’t have an active Seller membership yet, your imported listings have been saved as drafts in PrimeLot.'), 'WCT should not claim non-seller imports were saved as drafts.');
assert(page.includes('PrimeLot returned these imported listings as drafts.'), 'Draft copy should only describe drafts returned by PrimeLot after a successful import.');
assert(page.includes('Start a PrimeLot Seller membership to import and publish your listings.'), 'Membership-required modal should use the required PrimeLot Seller membership message.');
assert(page.includes('PRIMELOT_SELLER_MEMBERSHIP_REQUIRED'), 'Client should branch on the PrimeLot Seller membership required error code.');
assert(page.includes('PrimeLot is not accepting non-seller draft imports yet.'), 'Membership-required modal should avoid promising draft imports until PrimeLot API supports them.');
assert(page.includes('Your listings are now live on the PrimeLot marketplace.'), 'Active seller copy should explain listings are live.');
assert(page.includes('Start Seller Membership'), 'Non-seller modal should include a clear seller membership CTA.');
assert(page.includes('View Drafts'), 'Non-seller modal should include a drafts/dashboard CTA.');
assert(page.includes('https://primelot.cards/dashboard/seller?tab=listings&status=draft'), 'View Drafts should open the PrimeLot seller listings drafts view.');
assert(page.includes('View Listings'), 'Active seller modal should include a view listings CTA.');
assert(page.includes('const primeLotSuccessHasDrafts = Boolean(primeLotPostResult?.draftListingCount);'), 'Success modal should branch from draft listing status.');
assert(!page.includes('PrimeLot posted live'), 'Success modal should not always claim PrimeLot listings went live.');
assert(!page.includes('Open first listing'), 'Success modal should use status-aware CTAs instead of Open first listing.');

console.log('PrimeLot import success modal checks passed.');
