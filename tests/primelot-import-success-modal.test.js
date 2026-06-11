const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sliceBetween(start, end) {
  const startIndex = page.indexOf(start);
  assert(startIndex >= 0, `Missing start marker: ${start}`);
  const endIndex = page.indexOf(end, startIndex);
  assert(endIndex > startIndex, `Missing end marker after ${start}: ${end}`);
  return page.slice(startIndex, endIndex);
}

const successModal = sliceBetween('{primeLotPostResult && (', '{primeLotMembershipRequiredOpen && (');
const membershipModal = sliceBetween('{primeLotMembershipRequiredOpen && (', '{tab === "glance" && (');

assert(successModal.includes('Your cards imported successfully.'), 'PrimeLot success modal should lead with positive import success copy.');
assert(successModal.includes('Your listings imported successfully. They were saved as drafts in PrimeLot so you can review them before publishing.'), 'Successful draft imports should use the exact requested draft-success wording.');
assert(successModal.includes('<span><small>Imported cards</small><strong>{primeLotPostResult.postedCount}</strong></span>'), 'Success modal should show imported-card count.');
assert(successModal.includes('<span><small>Live listings</small><strong>{primeLotPostResult.publicListingCount}</strong></span>'), 'Success modal should show live-listing count.');
assert(successModal.includes('<span><small>Drafts</small><strong>{primeLotPostResult.draftListingCount}</strong></span>'), 'Success modal should show draft count.');
assert(successModal.includes('href={PRIMELOT_DRAFTS_URL} target="_blank" rel="noreferrer">View Drafts</a>'), 'Successful draft import primary CTA should be View Drafts.');
assert(successModal.includes('<button className="secondary" type="button" onClick={() => setPrimeLotPostResult(null)}>Done</button>'), 'Successful draft import secondary CTA should be Done.');
assert(!successModal.includes('Start Seller Membership'), 'Successful draft import modal must not render Start Seller Membership.');
assert(!successModal.includes('PRIMELOT_SELLER_MEMBERSHIP_REQUIRED'), 'Success modal should not branch from membership-required failure state.');
assert(!page.includes('Because you don’t have an active Seller membership yet, your imported listings have been saved as drafts in PrimeLot.'), 'WCT should not claim non-seller imports were saved as drafts.');
assert(page.includes('const primeLotSuccessHasDrafts = Boolean(primeLotPostResult?.draftListingCount);'), 'Success modal should branch from draft listing status.');
assert(page.includes('View Listings'), 'Active seller modal should include a view listings CTA.');
assert(!page.includes('PrimeLot posted live'), 'Success modal should not always claim PrimeLot listings went live.');
assert(!page.includes('Open first listing'), 'Success modal should use status-aware CTAs instead of Open first listing.');

assert(membershipModal.includes('Start a PrimeLot Seller membership to import and publish your listings.'), 'Membership-required modal should use the required PrimeLot Seller membership message.');
assert(membershipModal.includes('Start Seller Membership'), 'Membership-required modal should include a clear seller membership CTA.');
assert(membershipModal.includes('Go to PrimeLot Dashboard'), 'Membership-required modal should link to the PrimeLot dashboard instead of labeling the secondary CTA View Drafts.');
assert(page.includes('const isPrimeLotMembershipRequiredFailure =')
  && page.includes('result.code === "NO_SELLER_MEMBERSHIP"')
  && page.includes('result.code === "PRIMELOT_SELLER_MEMBERSHIP_REQUIRED"')
  && page.includes('result.canSell === false'), 'Client should show the membership modal only for explicit seller-membership failure signals.');
assert(page.includes('const PRIMELOT_DASHBOARD_URL = "https://primelot.cards/dashboard/seller?tab=listings";'), 'Dashboard CTA should use the seller dashboard/listings URL without the draft filter.');
assert(page.includes('const PRIMELOT_DRAFTS_URL = "https://primelot.cards/dashboard/seller?tab=listings&status=draft";'), 'Draft CTA should keep the valid PrimeLot seller listings drafts URL.');

console.log('PrimeLot import success modal checks passed.');
