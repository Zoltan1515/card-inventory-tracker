const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const imagePaths = [
  '/cards/charizard-card.png',
  '/cards/luka-card.png',
  '/cards/mewtwo-card.png',
  '/cards/mike-trout.png',
  '/cards/sealed-box.png',
  '/screenshots/transparent-lot-view.png',
  '/screenshots/messages-preview.png',
  '/screenshots/primelot-dashboard.png',
];

for (const imagePath of imagePaths) {
  assert(page.includes(`src="${imagePath}"`) || page.includes(`"${imagePath}"`), `PrimeLot page should use ${imagePath}.`);
  const filePath = path.join(root, 'public', imagePath);
  assert(fs.existsSync(filePath), `${imagePath} should exist in public assets.`);
  assert(fs.statSync(filePath).size > 10000, `${imagePath} should be a real image asset, not a tiny placeholder.`);
}

assert(page.includes('Fire Chase + graded collector lot'), 'PrimeLot hero should use generic collector-safe featured lot copy.');
assert(page.includes('Diamond Pro'), 'PrimeLot tools section should use the richer local single-card asset copy.');

console.log('PrimeLot marketplace image checks passed.');
