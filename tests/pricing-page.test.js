const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'app', 'pricing', 'page.tsx');
const cssPath = path.join(__dirname, '..', 'app', 'globals.css');

const page = fs.readFileSync(pagePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const requiredPageSnippets = [
  'title: "Pricing | Wicked Card Tracker"',
  '1 month free',
  '$</span>20<small>/month</small>',
  '$5 off every month',
  'PrimeLot Cards sellers pay $15/month after the free month.',
  'Start your free month',
  'NEXT_PUBLIC_STRIPE_CHECKOUT_URL',
  'Track every card purchase, sale, expense, and profit number',
  'See real profit after grading costs, shipping, marketplace fees',
  'Track grading submissions',
];

const requiredCssSnippets = [
  '.pricingShell',
  '.pricingHero',
  '.pricingCard',
  '.primeLotDiscount',
  '.pricingBenefit',
  '.pricingFeatureGrid { display: grid; grid-template-columns: 1fr;',
  '.pricingFeatureCard { display: grid; grid-template-columns: 44px 1fr;',
  '.pricingFeatureIcon',
  '.pricingFinalCta',
  '@media (max-width: 1000px)',
  '.pricingHero, .pricingGridSection { grid-template-columns: 1fr; }',
  '@media (max-width: 720px)',
  '.pricingShell { width: min(100% - 24px, 1160px);',
];

for (const snippet of requiredPageSnippets) {
  if (!page.includes(snippet)) {
    throw new Error(`Missing pricing page snippet: ${snippet}`);
  }
}

for (const snippet of requiredCssSnippets) {
  if (!css.includes(snippet)) {
    throw new Error(`Missing pricing CSS snippet: ${snippet}`);
  }
}

if (!page.includes('target={hasStripeCheckoutUrl ? "_blank" : undefined}')) {
  throw new Error('Stripe CTA should open real checkout URLs in a new tab.');
}

if (!page.includes('rel={hasStripeCheckoutUrl ? "noopener noreferrer" : undefined}')) {
  throw new Error('Stripe CTA should protect external checkout links with noopener noreferrer.');
}

console.log('Pricing page checks passed');
