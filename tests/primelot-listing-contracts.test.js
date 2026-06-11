const fs = require('fs');
const path = require('path');

const route = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractArray(name) {
  const match = route.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  assert(match, `Missing ${name} allowlist.`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractFunction(name) {
  const start = route.indexOf(`const ${name} = `);
  assert(start >= 0, `Missing ${name}.`);
  const nextConst = route.indexOf('\nconst ', start + 1);
  return route.slice(start, nextConst >= 0 ? nextConst : route.length);
}

const singleAllowed = extractArray('singleCardPrimeLotColumns');
const sealedAllowed = extractArray('sealedProductPrimeLotColumns');
const lotAllowed = extractArray('lotPrimeLotColumns');

for (const required of ['card_name', 'image_url_front', 'image_url_back', 'price']) {
  assert(singleAllowed.includes(required), `single_cards allowlist must include ${required}.`);
}
for (const forbidden of ['product_name', 'title', 'image_url_1', 'image_url_2', 'bulk_images']) {
  assert(!singleAllowed.includes(forbidden), `single_cards allowlist must not include ${forbidden}.`);
}

for (const required of ['product_name', 'image_url_1', 'image_url_2', 'price']) {
  assert(sealedAllowed.includes(required), `sealed_products allowlist must include ${required}.`);
}
for (const forbidden of ['card_name', 'title', 'player', 'condition', 'is_graded', 'grading_company', 'grade', 'image_url_front', 'image_url_back', 'bulk_images']) {
  assert(!sealedAllowed.includes(forbidden), `sealed_products allowlist must not include ${forbidden}.`);
}

for (const required of ['title', 'total_price', 'card_count', 'bulk_images']) {
  assert(lotAllowed.includes(required), `lots allowlist must include ${required}.`);
}
for (const forbidden of ['card_name', 'product_name', 'price', 'quantity', 'image_url_front', 'image_url_back', 'image_url_1', 'image_url_2']) {
  assert(!lotAllowed.includes(forbidden), `lots allowlist must not include ${forbidden}.`);
}

const singleBuilder = extractFunction('singleCardPrimeLotRow');
assert(singleBuilder.includes('card_name: card.name.trim()'), 'single_card rows must map title/name to card_name.');
assert(singleBuilder.includes('image_url_front: normalizePrimeLotImageUrl(card.frontPhotoUrl)'), 'single_card rows must map front image to image_url_front.');
assert(singleBuilder.includes('image_url_back: normalizePrimeLotImageUrl(card.backPhotoUrl)'), 'single_card rows must map back image to image_url_back.');
assert(!/product_name:|title:|image_url_1:|image_url_2:|bulk_images:/.test(singleBuilder), 'single_card builder must not send product/lot image fields.');

const sealedBuilder = extractFunction('sealedProductPrimeLotRow');
assert(sealedBuilder.includes('product_name: card.name.trim()'), 'sealed_product rows must map title/name to product_name.');
assert(sealedBuilder.includes('image_url_1: normalizePrimeLotImageUrl(card.frontPhotoUrl)'), 'sealed_product rows must map front image to image_url_1.');
assert(sealedBuilder.includes('image_url_2: normalizePrimeLotImageUrl(card.backPhotoUrl)'), 'sealed_product rows must map back image to image_url_2.');
assert(!/card_name:|title:|player:|condition:|is_graded:|grading_company:|grade:|image_url_front:|image_url_back:|bulk_images:/.test(sealedBuilder), 'sealed_product builder must not send single-card or lot-only fields.');

const lotBuilder = extractFunction('lotPrimeLotRow');
assert(lotBuilder.includes('title: card.name.trim()'), 'lot rows must map title/name to title.');
assert(lotBuilder.includes('total_price: Number(card.askingPrice || 0)'), 'lot rows must map price to total_price.');
assert(lotBuilder.includes('card_count: Math.max(1, Math.floor(Number(card.quantity) || 1))'), 'lot rows must map quantity/count to card_count.');
assert(lotBuilder.includes('bulk_images: [normalizePrimeLotImageUrl(card.frontPhotoUrl), normalizePrimeLotImageUrl(card.backPhotoUrl)].filter(Boolean)'), 'lot rows must map images to bulk_images.');
assert(!/card_name:|product_name:|(?<!total_)price:|quantity:|image_url_front:|image_url_back:|image_url_1:|image_url_2:/.test(lotBuilder), 'lot builder must not send single-card/sealed direct fields.');

assert(route.includes('allowedPrimeLotRowForListingType'), 'Direct Supabase fallback must pass rows through a listing-type allowlist before insert.');
assert(route.includes('row = allowedPrimeLotRowForListingType(listingType, primeLotRowForCard(card, listingType, primeLotSellerUserId, primeLotPostStatus))'), 'Base rows must be allowlisted before any PrimeLot Supabase insert.');
assert(route.includes('formData.append("listingType", listingType);') && route.includes('formData.append("cardType", cardTypeForCategory(card.category));'), 'Server endpoint FormData/mocks must keep listingType and cardType explicit for all listing types.');

console.log('PrimeLot listing contract allowlist checks passed.');
