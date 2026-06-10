const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('className="modal panel addListingModal"'), 'Add Listing dialog should have a dedicated layout class.');
assert(css.includes('.modal { width: min(720px, calc(100vw - 36px)); max-width: 100%;'), 'Modal width should be clamped to the viewport so it cannot clip off-screen.');
assert(css.includes('.panelHeader > div { min-width: 0; }'), 'Panel header text area should be allowed to shrink instead of pushing action buttons outside the modal.');
assert(css.includes('.addListingModal .panelHeader .secondary { flex: 0 0 auto; }'), 'Add Listing cancel button should stay inside the modal header on wide screens.');
assert(css.includes('@media (max-width: 860px)') && css.includes('.addListingModal .panelHeader { flex-direction: column; align-items: stretch; }'), 'Add Listing header should stack before it gets cramped.');
assert(css.includes('.addListingModal .panelHeader .secondary { width: 100%; justify-content: center; }'), 'Add Listing cancel button should become a full-width safe action when stacked.');
assert(css.includes('.modalBackdrop { padding: 12px; align-items: start; }'), 'Mobile modal backdrop should give the modal breathing room and avoid edge clipping.');
assert(css.includes('.modal { width: min(100%, calc(100vw - 24px)); max-height: calc(100dvh - 24px); }'), 'Mobile modal should fit inside the visible viewport.');

console.log('Add Listing modal layout checks passed.');
