const fs = require('fs');
const path = require('path');
const assert = require('assert');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

assert(
  page.includes('const primeLotListingStatusLabel = (status = "") => isPrimeLotPublicListing(status) ? "PrimeLot" : "PrimeLot Draft";'),
  'WCT should preserve whether the PrimeLot listing is public or draft in the marketplace label.'
);

assert(
  page.includes('platform: primeLotListingStatusLabel(listing.status),'),
  'Successful PrimeLot exports should add a PrimeLot/PrimeLot Draft listing record back to the WCT card.'
);

assert(
  page.includes('const nextListings = [...activeListingsForCard(card).filter((item) => !item.platform.toLowerCase().includes("primelot")), primeLotListing];'),
  'Successful PrimeLot exports should replace any old PrimeLot listing and keep the new PrimeLot link on the card even when PrimeLot returns draft status.'
);

assert(
  page.includes('status: "Listed",'),
  'Successful PrimeLot exports should move the WCT card to the Listed tab so it no longer remains in Not Listed after posting.'
);

assert(
  !page.includes('Card Tracker will keep them Not Listed until they are published on PrimeLot')
    && !page.includes('Drafts stay Not Listed in Card Tracker until published'),
  'PrimeLot export success copy should not tell users drafts remain Not Listed after WCT now records the PrimeLot listing.'
);

console.log('PrimeLot export marks WCT cards listed checks passed.');
