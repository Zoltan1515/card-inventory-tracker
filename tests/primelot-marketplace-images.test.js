const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const logoPath = path.join(root, 'public', 'primelot-logo.png');

assert(page.includes('primeLotHeroOnlyPanel'), 'PrimeLot page should use the simplified hero-only panel.');
assert(page.includes('primeLotCenteredLogo'), 'PrimeLot page should show the logo centered above the hero.');
assert(page.includes('primeLotSoloHero'), 'PrimeLot hero should render as a single-column hero.');
assert(page.includes('src="/primelot-logo.png"') || page.includes('"/primelot-logo.png"'), 'PrimeLot page should use the PrimeLot logo.');
assert(fs.existsSync(logoPath), 'PrimeLot logo should exist in public assets.');
assert(fs.statSync(logoPath).size > 10000, 'PrimeLot logo should be a real image asset, not a tiny placeholder.');

assert(page.includes('The transparent card marketplace'), 'PrimeLot hero should keep the marketplace pill.');
assert(page.includes('Buy &amp; Sell Cards Without Marketplace Fees'), 'PrimeLot hero should keep the main headline.');
assert(page.includes('Start 3 Months Free'), 'PrimeLot hero should keep the signup CTA.');
assert(page.includes('Browse Marketplace'), 'PrimeLot hero should keep the browse CTA.');
assert(page.includes('0% PrimeLot transaction fees'), 'PrimeLot hero should keep the benefit bubbles.');
assert(page.includes('First 3 months free. Then $6.99/month plus applicable tax.'), 'PrimeLot hero should keep the price note.');

for (const removedClass of [
  'primeLotLandingTopbar',
  'primeLotHeroMockupWrap',
  'primeLotWctDiscount',
  'primeLotWhySection',
  'primeLotNeedsSection',
  'primeLotHowSection',
  'primeLotMembershipBlock',
  'primeLotFaqBlock',
  'primeLotFinalCta',
]) {
  assert(!page.includes(removedClass), `PrimeLot page should not render ${removedClass}.`);
}

assert(css.includes('.primeLotCenteredLogo'), 'PrimeLot CSS should style the centered logo.');
assert(css.includes('.primeLotCenteredLogo img'), 'PrimeLot CSS should scale the centered logo image.');
assert(css.includes('.primeLotSoloHero'), 'PrimeLot CSS should style the single-column hero.');

console.log('PrimeLot marketplace hero checks passed.');
