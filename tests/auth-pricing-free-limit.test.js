const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const pageSnippets = [
  'const FREE_INVENTORY_ADD_LIMIT = 5;',
  'const PRICING_PATH = "/pricing";',
  'accountFreeInventoryAddStorageKey',
  'localAccountFreeInventoryAdds',
  'saveLocalAccountFreeInventoryAdds',
  'freeInventoryAddsRemaining',
  'freeInventoryLimitReached',
  'Create an account first to use your 5 free inventory adds.',
  '5 free adds after signup',
  'Account trial',
  'account free inventory adds left',
  'tab === "add" && session',
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

const forbiddenSignedOutTrialSnippets = [
  'Try 5 free inventory adds',
  'Add up to 5 inventory items without signing up',
  '!session && (\n        <section className="guestTrialBanner"',
  'You can add 5 inventory items before signing up',
];

for (const snippet of forbiddenSignedOutTrialSnippets) {
  if (page.includes(snippet)) throw new Error(`Free inventory adds must not be advertised or usable before account creation: ${snippet}`);
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
