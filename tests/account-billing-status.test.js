const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const billing = fs.readFileSync(path.join(root, 'app', 'billing', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const pageSnippets = [
  'const BILLING_PATH = "/billing";',
  'href={BILLING_PATH}>Billing</a>',
  'Full account access active',
  'Billing not connected yet',
  'No paid renewal/cancel status is attached to this login yet.',
  '$5/month discount eligible',
  'Manage billing',
];

for (const snippet of pageSnippets) {
  if (!page.includes(snippet)) throw new Error(`Missing account status snippet: ${snippet}`);
}

const billingSnippets = [
  'title: "Billing | Wicked Card Tracker"',
  'NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL',
  'Account login is active.',
  'Paid subscription tracking is not connected to this login yet',
  'Renewal date',
  'PrimeLot seller discount',
  'Open billing portal',
  'Billing portal coming after Stripe setup',
];

for (const snippet of billingSnippets) {
  if (!billing.includes(snippet)) throw new Error(`Missing billing page snippet: ${snippet}`);
}

const cssSnippets = [
  '.accountAccessStrip',
  '.accountBillingLink',
  '.billingStatusList',
  '.billingGridSection',
];

for (const snippet of cssSnippets) {
  if (!css.includes(snippet)) throw new Error(`Missing account/billing CSS snippet: ${snippet}`);
}

console.log('Account access and billing page checks passed.');
