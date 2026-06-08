const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const pricing = fs.readFileSync(path.join(root, 'app', 'pricing', 'page.tsx'), 'utf8');
const billing = fs.readFileSync(path.join(root, 'app', 'billing', 'page.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app', 'layout.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(file) {
  const buffer = fs.readFileSync(file);
  assert(buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${file} should be a real PNG file`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

for (const source of [page, pricing, billing]) {
  assert(source.includes('/wicked-card-tracker-logo.png'), 'Website pages should use the shared Wicked Card Tracker logo asset.');
}
assert(layout.includes('icon: "/icon.png"'), 'Layout metadata should expose the favicon asset.');
assert(layout.includes('apple: "/wicked-card-tracker-icon.png"'), 'Layout metadata should expose the Apple touch icon asset.');

const logo = pngDimensions(path.join(root, 'public', 'wicked-card-tracker-logo.png'));
const publicIcon = pngDimensions(path.join(root, 'public', 'wicked-card-tracker-icon.png'));
const appIcon = pngDimensions(path.join(root, 'app', 'icon.png'));

assert(logo.width === 1254 && logo.height === 1254, 'Main logo should preserve the provided square artwork size.');
assert(publicIcon.width === 512 && publicIcon.height === 512, 'Public app icon should be a 512x512 PNG.');
assert(appIcon.width === 512 && appIcon.height === 512, 'Next.js favicon/app icon should be a 512x512 PNG.');
assert(css.includes('drop-shadow(0 18px 34px rgba(239,68,68,.24))'), 'Main logo glow should be red instead of gold.');
assert(css.includes('drop-shadow(0 0 16px rgba(239,68,68,.38)) drop-shadow(0 0 22px rgba(127,29,29,.28))'), 'Mobile logo glow should be red instead of gold.');
assert(!css.includes('rgba(234,179,8') && !css.includes('rgba(120,53,15'), 'Old gold/brown logo glow colors should not remain.');

console.log('Logo asset checks passed.');
