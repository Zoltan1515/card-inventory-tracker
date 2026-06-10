const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mobileMedia = css.slice(css.indexOf('@media (max-width: 720px)', css.indexOf('@media (max-width: 860px)')));

assert(mobileMedia.includes('.listedCardRow {\n    grid-template-columns: 24px 76px minmax(0, 1fr);'), 'Mobile listed cards should use a wider thumbnail/info grid instead of the cramped generic row grid.');
assert(mobileMedia.includes('.listedCardRow .selectCardBox { grid-column: 1; grid-row: 1; align-self: start; padding-top: 28px; }'), 'Mobile listed card checkbox should align with the thumbnail instead of floating awkwardly mid-card.');
assert(mobileMedia.includes('.listedCardRow .photoThumbButton, .listedCardRow > .cardThumb { grid-column: 2; grid-row: 1; width: 76px; height: 102px; border-radius: 12px; }'), 'Mobile listed card thumbnail should be larger and consistently placed.');
assert(mobileMedia.includes('.listedCardRow .cardInfo { grid-column: 3; grid-row: 1; align-self: start; }'), 'Mobile listed card title/details should sit beside the thumbnail.');
assert(mobileMedia.includes('.listedCardRow .listingLinkRow { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));'), 'Mobile listing links should become tidy side-by-side buttons.');
assert(mobileMedia.includes('.listedCardRow .listingLinkRow a { display: inline-flex;') && mobileMedia.includes('text-decoration: none;'), 'Mobile listing links should be styled as buttons instead of large underlined text.');
assert(mobileMedia.includes('.listedCardRow .rowMoney { grid-column: 1 / -1; width: 100%; display: flex;') && mobileMedia.includes('background: rgba(57,255,156,.06);'), 'Mobile listed card price should be a full-width summary strip.');
assert(mobileMedia.includes('.listedCardRow .listingEditButton { min-height: 48px; font-size: 1rem; border-radius: 14px; }'), 'Mobile Manage listings button should be a clear full-width action.');

console.log('Mobile listed inventory layout checks passed.');
