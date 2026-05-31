const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');
const dbCard = fs.readFileSync(path.join(root, 'lib', 'dbCard.ts'), 'utf8');
const csv = fs.readFileSync(path.join(root, 'lib', 'csv.ts'), 'utf8');
const primeLotRoute = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase-back-photo-migration.sql'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(card.includes('backPhotoUrl: string;'), 'CardRecord should store an optional back-of-card photo URL.');
assert(card.includes('backPhotoUrl: ""'), 'emptyCard should default backPhotoUrl to an empty string.');

assert(dbCard.includes('back_photo_url?: string | null;'), 'Supabase card row mapping should read back_photo_url.');
assert(dbCard.includes('backPhotoUrl: text(row.back_photo_url)'), 'rowToCard should map back_photo_url to backPhotoUrl.');
assert(dbCard.includes('back_photo_url: card.backPhotoUrl'), 'card inserts/updates should persist backPhotoUrl into back_photo_url.');

assert(page.includes('side: "front" | "back" = "front"'), 'Photo upload helper should support front and back sides.');
assert(page.includes('photoField = side === "front" ? "frontPhotoUrl" : "backPhotoUrl"'), 'Photo upload helper should choose the correct front/back field.');
assert(page.includes('helpText="Back photo"'), 'Add inventory form should show a back-photo upload option for marketplace listings.');
assert(page.includes('Add/replace back photo'), 'Edit card form should show a back-photo upload option.');
assert(page.includes('backPhotoDot'), 'Inventory rows should visibly indicate when a back photo exists.');
assert(page.includes('Enlarged back of'), 'Photo lightbox should display the back photo.');
assert(page.includes('One front/back photo set applies to every copy in this row'), 'Quantity rows should explain that one photo set applies to all copies in that row.');

assert(csv.includes('["backPhotoUrl", "Back Photo URL"]'), 'General card CSV export should include a Back Photo URL column.');
assert(csv.includes('[card.frontPhotoUrl, card.backPhotoUrl].filter(Boolean).join("|")'), 'eBay PicURL should include front and back URLs separated by | when both exist.');
assert(csv.includes('Missing back photo for eBay'), 'eBay export review notes should warn when the back photo is missing.');

assert(primeLotRoute.includes('backPhotoUrl?: string;'), 'PrimeLot posting payload should accept backPhotoUrl.');
assert(primeLotRoute.includes('image_url_back: normalizePrimeLotImageUrl(card.backPhotoUrl)'), 'PrimeLot posting should pass the back photo into image_url_back.');
assert(primeLotRoute.includes('normalizePrimeLotImageUrl'), 'PrimeLot posting should normalize public front/back image URLs before insert.');
assert(primeLotRoute.includes('PRIMELOT_INVALID_PHOTO_URL'), 'PrimeLot posting should reject non-public or malformed photo URLs before insert.');
assert(primeLotRoute.includes('PRIMELOT_PHOTOS_NOT_CONFIGURED'), 'PrimeLot posting should fail closed if PrimeLot cannot save front/back photo columns.');

assert(migration.includes('add column if not exists back_photo_url text default'), 'Back-photo migration should add the back_photo_url column.');

console.log('Back photo and eBay export checks passed.');
