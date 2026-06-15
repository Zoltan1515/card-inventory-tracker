const fs = require('fs');
const path = require('path');
const assert = require('assert');

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

assert(
  page.includes('<section className="modalCard primeLotReviewModal"'),
  'PrimeLot review dialog should have a dedicated class for mobile modal scrolling fixes.'
);

assert(
  css.includes('.primeLotReviewModal { width: min(860px, 100%);'),
  'PrimeLot review modal base styles should exist.'
);

const reviewActionsRule = css.match(/\.primeLotReviewModal > \.rowActions \{[^}]+\}/)?.[0] || '';
const reviewActionButtonRule = css.match(/\.primeLotReviewModal > \.rowActions button \{[^}]+\}/)?.[0] || '';

assert(
  reviewActionsRule.includes('position: sticky;')
    && reviewActionsRule.includes('bottom: 0;')
    && reviewActionsRule.includes('padding-bottom: calc(12px + env(safe-area-inset-bottom));'),
  'Mobile PrimeLot review action buttons should stick above the bottom safe area instead of being cut off.'
);

assert(
  reviewActionsRule.includes('grid-template-columns: 1fr;')
    && reviewActionButtonRule.includes('width: 100%;'),
  'Mobile PrimeLot review action buttons should stack full-width so their labels are not clipped.'
);

assert(
  css.includes('.modalCard { width: min(720px, 100%); max-height: calc(100vh - 36px);')
    && css.includes('.modalCard { max-height: calc(100dvh - 24px);'),
  'Mobile modal cards should use dynamic viewport height so browser chrome does not hide the modal footer.'
);

console.log('PrimeLot review mobile action checks passed.');
