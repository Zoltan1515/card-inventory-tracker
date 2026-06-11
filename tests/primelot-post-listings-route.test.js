const fs = require('fs');
const path = require('path');

const route = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  route.includes('shipping_cost: Number(item.card.shippingCharge || 0)'),
  'PrimeLot API should write buyer shipping to shipping_cost, the field read by the live PrimeLot listing UI.'
);

assert(
  !route.includes('shipping_price: Number(cards[index].shippingCharge || 0)'),
  'PrimeLot API should not write buyer shipping only to shipping_price because PrimeLot listings read shipping_cost.'
);

assert(
  route.includes('const hasRequestedShipping = cards.some((card) => Number(card.shippingCharge || 0) > 0);'),
  'PrimeLot API should detect when the seller requested non-zero shipping.'
);

assert(
  route.includes('if (hasRequestedShipping) return jsonError('),
  'PrimeLot API must not silently create listings without shipping when non-zero shipping was requested.'
);

assert(
  route.includes('const hasActiveSellerMembership = async') && route.includes('PRIMELOT_SELLER_MEMBERSHIP_REQUIRED') && route.includes('const primeLotPostStatus = "draft";'),
  'PrimeLot API should check Seller membership and keep temporary direct fallback imports as drafts.'
);

assert(
  route.includes("Temporary fallback while PrimeLot's browser-session-protected WCT import endpoint") && route.includes('PrimeLot should own live publishing, duplicate checks'),
  'Temporary direct Supabase fallback should be documented as non-final architecture until PrimeLot exposes server-to-server multipart import.'
);

assert(
  !route.includes('const primeLotPostStatus = "active";') && !route.includes('status: primeLotPublic') && !route.includes('status: "live"'),
  'Temporary direct Supabase fallback must never directly create active PrimeLot listings.'
);

assert(
  route.includes('buyer_seller') && route.includes('sellerMembershipActiveStatuses'),
  'Seller membership detection should treat Seller-style plans with active/trialing status as publishable.'
);

assert(
  route.includes('sellerMembershipTruthySellerKeys')
    && route.includes('is_seller')
    && route.includes('seller_membership_active')
    && route.includes('probeImpliesSellerPlan')
    && route.includes('/seller/i.test(probe.table)')
    && route.includes('"professional"')
    && route.includes('"pro"'),
  'Seller membership detection should accept PrimeLot seller-only tables, seller boolean flags, and pro/professional seller plans.'
);

assert(
  route.includes('purchase_price: Number(card.purchasePrice || 0)')
    && route.includes('purchase_cost: Number(card.purchasePrice || 0)')
    && route.includes('original_purchase_price: Number(card.purchasePrice || 0)')
    && route.includes('original_price: Number(card.purchasePrice || 0)')
    && route.includes('cost_basis: Number(card.purchasePrice || 0)'),
  'PrimeLot API should preserve WCT purchase cost across every cost column PrimeLot may expose, including original_price.'
);

assert(
  route.includes('formData.append("sourcePlatform", "wickedcardtracker");')
    && route.includes('formData.append("wctCardId", card.id);')
    && route.includes('formData.append("purchasePrice", String(Number(card.purchasePrice || 0)));')
    && route.includes('sourcePlatform: "wickedcardtracker"')
    && route.includes('wctCardId: card.id')
    && route.includes('purchasePrice: Number(card.purchasePrice || 0)'),
  'PrimeLot create payload should include round-trip metadata as sourcePlatform, wctCardId, and purchasePrice.'
);

assert(
  route.includes('source_platform: "wickedcardtracker"')
    && route.includes('source_id: card.id')
    && route.includes('source_listing_id: card.id'),
  'Direct PrimeLot fallback rows should store WCT card id in both source_id and source_listing_id for round-trip recovery.'
);

assert(
  route.includes('cleanListingNotes(card.notes).trim() ? `Notes: ${cleanListingNotes(card.notes)}` : "",')
    && route.includes('const cleanListingNotes = (notes = "") => notes.split("\\n").filter((line) => !line.startsWith(listingNotesPrefix)).join("\\n").trim();'),
  'PrimeLot descriptions should strip internal WCT_LISTINGS_JSON metadata from listing notes.'
);

console.log('PrimeLot post-listings shipping route checks passed.');
