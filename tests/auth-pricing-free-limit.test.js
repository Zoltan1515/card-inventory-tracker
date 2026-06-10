const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const requiredPageSnippets = [
  'const PRICING_PATH = "/pricing";',
  'supabase.auth.resetPasswordForEmail',
  'PASSWORD_RECOVERY',
  'supabase.auth.updateUser({ password: newPassword })',
  'accountActionPath',
  'accountActionLabel',
  '<a className="secondary signOutButton" href={accountActionPath}>{accountActionLabel}</a>',
  '{ id: "pricing", tab: "add", label: "Pricing"',
  'tab === "add" && session',
];

for (const snippet of requiredPageSnippets) {
  if (!page.includes(snippet)) throw new Error(`Missing page snippet: ${snippet}`);
}

const forbiddenFreeInventoryFeatureSnippets = [
  'FREE_INVENTORY_ADD_STORAGE_KEY',
  'FREE_INVENTORY_ADD_LIMIT',
  'accountFreeInventoryAddStorageKey',
  'localAccountFreeInventoryAdds',
  'saveLocalAccountFreeInventoryAdds',
  'freeInventoryAdds',
  'freeInventoryAddsRemaining',
  'freeInventoryLimitReached',
  'freeInventoryCounter',
  'guestTrialBanner',
  'guestTrialActions',
  'Try 5 free inventory adds',
  '5 free adds',
  '5 account free',
  'account free inventory adds',
  'free inventory adds',
  'Account trial',
  'Upgrade for unlimited adds',
  'Unlock unlimited inventory',
  'Upgrade for unlimited full access',
  'Your account includes 5 free inventory adds',
  'Create an account first to use your 5 free inventory adds.',
  'disabled={photoUploading || freeInventoryLimitReached}',
];

for (const snippet of forbiddenFreeInventoryFeatureSnippets) {
  if (page.includes(snippet) || css.includes(snippet)) throw new Error(`Free inventory adds feature/copy should be removed: ${snippet}`);
}

const cssSnippets = [
  '.topHeaderActions',
  '.authForm',
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

console.log('Auth/pricing/free-inventory-removal/email template checks passed.');
