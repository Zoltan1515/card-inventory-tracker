const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const actionOrder = [
  'id: "add"',
  'id: "inventory"',
  'id: "glance"',
  'id: "attention"',
  'id: "listingReview"',
  'id: "grading"',
  'id: "expenses"',
  'id: "soldInventory"',
].map((marker) => page.indexOf(marker));

assert(actionOrder.every((index) => index > -1), 'Quick Actions should include all expected action ids.');
assert(actionOrder.every((index, i) => i === 0 || index > actionOrder[i - 1]), 'Add Inventory should be first and every other quick action should shift over in order.');
assert(page.includes('featured={action.id === "add"}'), 'Add Inventory quick action should be marked as the featured action.');
assert(page.includes('featuredNavButton'), 'NavButton should support a featured styling class.');

assert(css.includes('.quickActionsPanel {'), 'Quick Actions panel should have dedicated menu styling.');
assert(css.includes('background: #062b2f'), 'Quick Actions panel should use a solid menu background that stands apart from the glass sections.');
assert(css.includes('border-color: rgba(57,255,156,.46)'), 'Quick Actions panel should have a stronger branded border.');
assert(css.includes('.quickActionGrid .navButton') && css.includes('background: #041a22'), 'Quick Actions menu buttons should use solid inner blocks.');
assert(css.includes('.quickActionsHeader .eyebrow') && css.includes('text-shadow: 0 0 16px rgba(57,255,156,.28)'), 'Quick Actions menu label should keep a subtle branded glow.');
assert(css.includes('.quickActionGrid .featuredNavButton') && css.includes('border-color: rgba(57,255,156,.78)'), 'Featured Add Inventory action should stand out from the other quick action buttons.');
assert(css.includes('.quickActionGrid .featuredNavButton strong') && css.includes('var(--neon-green)'), 'Featured Add Inventory label should use a brighter branded color.');
assert(css.includes('@media (min-width: 960px)') && css.includes('.quickActionsPanel { position: fixed; left: max(16px, calc((100vw - 1240px) / 2)); top: 112px;'), 'Desktop Quick Actions should move into a fixed left-side menu bar.');
assert(css.includes('.quickActionGrid.navBar { grid-template-columns: 1fr; gap: 8px; }'), 'Desktop Quick Actions sidebar should stack actions vertically.');
assert(page.includes('const [mobileQuickActionsOpen, setMobileQuickActionsOpen] = useState(false);'), 'Mobile Quick Actions drawer should be closed by default on refresh.');
assert(page.includes('aria-label={mobileQuickActionsOpen ? "Close quick actions menu" : "Open quick actions menu"}') && page.includes('aria-controls="quick-actions"'), 'Top menu button should open and close the mobile Quick Actions drawer.');
assert(page.includes('setMobileQuickActionsOpen(false);') && page.includes('onClick={() => runDashboardAction(action)}'), 'Choosing a Quick Action should collapse the mobile drawer.');
assert(page.includes('className="quickActionsScrim"') && page.includes('aria-label="Close quick actions menu"'), 'Mobile Quick Actions drawer should include a tap-outside close target.');
assert(css.includes('.quickActionsPanel { position: fixed; left: 10px; top: 82px;') && css.includes('transform: translateX(-118%)'), 'Mobile Quick Actions should slide out from the left side and collapse off-canvas.');
assert(css.includes('.quickActionsPanel.isOpen { transform: translateX(0); opacity: 1; pointer-events: auto; }'), 'Mobile Quick Actions open state should bring the drawer into view.');
assert(!page.includes('bottomMobileNav') && !page.includes('Mobile dashboard navigation') && !page.includes('<small>More</small>'), 'Mobile should not render the old bottom nav or unclear More button.');

console.log('Quick Actions menu style checks passed.');
