const fs = require('fs');
const path = require('path');

const route = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  route.includes('shipping_cost: Number(cards[index].shippingCharge || 0)'),
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
  route.includes('const hasActiveSellerMembership = async') && route.includes('PRIMELOT_SELLER_MEMBERSHIP_REQUIRED') && route.includes('const primeLotPostStatus = "active";'),
  'PrimeLot API should check Seller membership and reject imports before insert unless active Seller membership is verified.'
);

assert(
  route.includes('buyer_seller') && route.includes('sellerMembershipActiveStatuses'),
  'Seller membership detection should treat Seller-style plans with active/trialing status as publishable.'
);

console.log('PrimeLot post-listings shipping route checks passed.');
