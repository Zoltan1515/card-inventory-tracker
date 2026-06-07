const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const billing = fs.readFileSync(path.join(root, 'app', 'billing', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const pageSnippets = [
  'const BILLING_PATH = "/billing";',
  'const hasActiveSubscription = false;',
  'const subscriptionStatusLabel = hasActiveSubscription ? "Subscribed"',
  'const accountActionPath = hasActiveSubscription ? BILLING_PATH : PRICING_PATH;',
  'const accountActionLabel = hasActiveSubscription ? "Billing" : "Pricing";',
  'href={accountActionPath}>{accountActionLabel}</a>',
  'subscriptionStatusPill',
  'isNotSubscribed',
];

for (const snippet of pageSnippets) {
  if (!page.includes(snippet)) throw new Error(`Missing account status snippet: ${snippet}`);
}

const removedHeroSnippets = [
  'className="accountAccessStrip"',
  'Full account access active',
  'No paid renewal/cancel status is attached to this login yet.',
  'className="secondary accountBillingLink"',
];

for (const snippet of removedHeroSnippets) {
  if (page.includes(snippet)) throw new Error(`Bulky hero billing detail should not remain in app/page.tsx: ${snippet}`);
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
  '.subscriptionStatusPill',
  '.subscriptionStatusPill.isSubscribed',
  '.subscriptionStatusPill.isNotSubscribed',
  'min-width: 82px',
  '.billingStatusList',
  '.billingGridSection',
];

for (const snippet of cssSnippets) {
  if (!css.includes(snippet)) throw new Error(`Missing account/billing CSS snippet: ${snippet}`);
}

const removedCssSnippets = [
  '.accountAccessStrip',
  '.accountBillingLink',
];

for (const snippet of removedCssSnippets) {
  if (css.includes(snippet)) throw new Error(`Removed bulky hero CSS should not remain: ${snippet}`);
}

console.log('Account access and billing page checks passed.');
