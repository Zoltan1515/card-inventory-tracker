const fs = require('fs');
const path = require('path');
const assert = require('assert');

const route = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');

function extractFunction(name) {
  const start = route.indexOf(`const ${name} = `);
  assert(start >= 0, `Missing ${name}.`);
  const nextConst = route.indexOf('\nconst ', start + 1);
  return route.slice(start, nextConst >= 0 ? nextConst : route.length);
}

const descriptionBuilder = extractFunction('descriptionForCard');
const sharedRowBuilder = extractFunction('sharedPrimeLotRow');
const singleCardBuilder = extractFunction('singleCardPrimeLotRow');
const sealedProductBuilder = extractFunction('sealedProductPrimeLotRow');
const lotBuilder = extractFunction('lotPrimeLotRow');

const forbiddenDescriptionLabels = [
  'WickedCardTracker Status',
  'Previous Listed Platform',
  'Listed Platform',
  'Minimum Sale Price',
  'Lowest Acceptable Price',
  'Buyer Shipping Charge',
  'Purchase Date',
  'Purchase Price',
  'WCT Purchase Price',
  'Cost Basis',
  'Asking Price',
  'Status',
];

function containsBuyerFacingLabel(source, label) {
  return source.includes(`\`${label}:`)
    || source.includes(`"${label}:`)
    || source.includes(`'${label}:`);
}

for (const label of forbiddenDescriptionLabels) {
  assert(
    !containsBuyerFacingLabel(descriptionBuilder, label),
    `PrimeLot buyer-facing description must not include internal/private label "${label}".`
  );
}

assert(
  sharedRowBuilder.includes('description: descriptionForCard(card) || null'),
  'PrimeLot rows should build marketplace description from the buyer-facing description helper.'
);

for (const [listingType, builder] of [
  ['single_card', singleCardBuilder],
  ['sealed_product', sealedProductBuilder],
  ['lot', lotBuilder],
]) {
  assert(
    builder.includes('...sharedPrimeLotRow(card, primeLotSellerUserId, primeLotPostStatus)'),
    `${listingType} exports should use the shared privacy-safe PrimeLot row description.`
  );
  for (const label of forbiddenDescriptionLabels) {
    assert(
      !containsBuyerFacingLabel(builder, label),
      `${listingType} exports must not add internal/private label "${label}" to the PrimeLot description.`
    );
  }
}

console.log('PrimeLot description privacy checks passed.');
