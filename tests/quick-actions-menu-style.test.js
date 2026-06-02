const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(css.includes('.quickActionsPanel {'), 'Quick Actions panel should have dedicated menu styling.');
assert(css.includes('background: #062b2f'), 'Quick Actions panel should use a solid menu background that stands apart from the glass sections.');
assert(css.includes('border-color: rgba(57,255,156,.46)'), 'Quick Actions panel should have a stronger branded border.');
assert(css.includes('.quickActionGrid .navButton') && css.includes('background: #041a22'), 'Quick Actions menu buttons should use solid inner blocks.');
assert(css.includes('.quickActionsHeader .eyebrow') && css.includes('text-shadow: 0 0 16px rgba(57,255,156,.28)'), 'Quick Actions menu label should keep a subtle branded glow.');

console.log('Quick Actions menu style checks passed.');
