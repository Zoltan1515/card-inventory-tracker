const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

assert(page.includes('type PrimeLotListingType = "single_card" | "sealed_product" | "lot";'), 'Client should type the required PrimeLot listing type values.');
assert(page.includes('listingType: PrimeLotListingType'), 'PrimeLot review drafts should store a required listing type choice.');
assert(page.includes('listingType: draft?.listingType || ""'), 'Confirmed PrimeLot payload should include the user-chosen listingType, not infer it from title.');
assert(page.includes('Choose Single Card, Sealed Product, or Lot for every selected listing before importing to PrimeLot.'), 'Confirm should require a listing type before import/export.');
assert(page.includes('PrimeLot listing type') && page.includes('Single Card') && page.includes('Sealed Product') && page.includes('Lot'), 'PrimeLot review UI should offer Single Card, Sealed Product, and Lot choices.');
assert(page.includes('All imports are saved as PrimeLot drafts'), 'Review modal should tell users PrimeLot imports remain drafts for review.');

assert(route.includes('type PrimeLotListingType = "single_card" | "sealed_product" | "lot";'), 'Route should type the allowed listingType values.');
assert(route.includes('const allowedListingTypes = new Set<PrimeLotListingType>(["single_card", "sealed_product", "lot"]);'), 'Route should validate allowed listingType values.');
assert(route.includes('listingTypeForCard(card)') && route.includes('if (!listingType) return null;'), 'Route should require listingType instead of guessing from title.');
assert(route.includes('single_card: { table: "single_cards", path: "single-cards" }') && route.includes('sealed_product: { table: "sealed_products", path: "sealed-products" }') && route.includes('lot: { table: "lots", path: "lots" }'), 'Route should map listingType to PrimeLot draft tables and URLs.');
assert(route.includes('formData.append("listingType", listingType);') && route.includes('formData.append("cardType", cardTypeForCategory') && route.includes('formData.append("file",'), 'Route should include listingType, cardType, and file when posting to PrimeLot WCT import endpoint.');
assert(route.includes('const primeLotPostStatus = "draft";'), 'PrimeLot WCT imports should be drafts by default.');
assert(route.includes("Temporary fallback while PrimeLot's browser-session-protected WCT import endpoint"), 'Direct Supabase inserts should be marked as a temporary fallback, not final architecture.');
assert(!route.includes('const primeLotPostStatus = "active";'), 'WCT should not publish PrimeLot imports as active by default.');

console.log('PrimeLot listing type checks passed.');
