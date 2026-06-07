const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const pageSnippets = [
  'const FREE_INVENTORY_ADD_LIMIT = 5;',
  'const PRICING_PATH = "/pricing";',
  'Try 5 free inventory adds',
  'freeInventoryAddsRemaining',
  'freeInventoryLimitReached',
  'Sign up for unlimited full access',
  'disabled={photoUploading || freeInventoryLimitReached}',
  'supabase.auth.resetPasswordForEmail',
  'PASSWORD_RECOVERY',
  'supabase.auth.updateUser({ password: newPassword })',
  'accountActionPath',
  'accountActionLabel',
  '<a className="secondary signOutButton" href={accountActionPath}>{accountActionLabel}</a>',
  '{ id: "pricing", tab: "add", label: "Pricing"',
];

for (const snippet of pageSnippets) {
  if (!page.includes(snippet)) throw new Error(`Missing page snippet: ${snippet}`);
}

const cssSnippets = [
  '.guestTrialBanner',
  '.freeInventoryCounter',
  '.freeInventoryCounter.isLocked',
  '.topHeaderActions',
];

for (const snippet of cssSnippets) {
  if (!css.includes(snippet)) throw new Error(`Missing CSS snippet: ${snippet}`);
}

const templateFiles = [
  'welcome-confirm-signup.html',
  'reset-password.html',
  'subscription-welcome.html',
  'subscription-receipt.html',
  'README.md',
];

for (const file of templateFiles) {
  const content = fs.readFileSync(path.join(root, 'email-templates', file), 'utf8');
  if (!content.includes('Wicked Card Tracker')) throw new Error(`${file} missing WCT branding`);
  if (file.endsWith('.html') && !content.includes('wicked-card-tracker-logo.png')) throw new Error(`${file} missing logo`);
}

console.log('Auth/pricing/free-limit/email template checks passed.');
