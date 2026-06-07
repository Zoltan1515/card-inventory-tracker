const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('const [primeLotDetailsOpen, setPrimeLotDetailsOpen] = useState(false);'),
  'PrimeLot storefront card details should be collapsed by default.'
);

assert(
  page.includes('<a className="primeLotLogoLink" href="https://primelot.cards" target="_blank" rel="noreferrer" aria-label="Open PrimeLot storefront website">') &&
  page.includes('<img src="/primelot-logo.png" alt="PrimeLot logo" />') &&
  page.includes('<strong>PrimeLot Storefront</strong>') &&
  page.includes('>Manage</button>'),
  'Collapsed PrimeLot storefront card should show the PrimeLot logo, PrimeLot Storefront label, and Manage button.'
);

assert(
  page.includes('{primeLotDetailsOpen && (') &&
  page.includes('id="primelot-status-details"') &&
  page.includes('aria-label={primeLotDetailsOpen ? "Hide PrimeLot storefront details" : "Show PrimeLot storefront details"}'),
  'PrimeLot connection details should be expandable instead of always visible.'
);

assert(
  !page.includes('<p className="eyebrow">PrimeLot storefront</p>') &&
  !page.includes('View request') &&
  !page.includes('Set up PrimeLot'),
  'Collapsed PrimeLot storefront card should not show status copy or alternate setup labels.'
);

assert(
  css.includes('.primeLotStatusCard {') &&
  css.includes('.primeLotLogoLink { display: inline-flex; align-items: center;') &&
  css.includes('.primeLotStatusBrand img { width: 114px; height: 38px; object-fit: contain;') &&
  css.includes('.primeLotStatusDetails { border-top:'),
  'PrimeLot storefront card should have compact brand/logo and expandable details styling.'
);

console.log('PrimeLot status card checks passed.');
