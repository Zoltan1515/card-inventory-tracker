const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

assert(page.includes('Enter grading fees'), 'Grading orders should expose an Enter grading fees button.');
assert(page.includes('aria-label="Enter grading fees for submission"'), 'Feature should open an accessible grading fee modal.');
assert(page.includes('gradingFeeSelection') && page.includes('bulkGradingFee'), 'Grading fee modal should support selecting multiple cards and applying a bulk fee.');
assert(page.includes('applyBulkGradingFee'), 'Bulk grading fee action should copy one fee to all selected cards.');
assert(page.includes('saveGradingFees'), 'Grading fee modal should save per-card grading fees.');
assert(page.includes('gradingFeeDescriptionForCard') && page.includes('Grading fee:'), 'Grading fees should be stored as card-specific grading fee expenses.');
assert(page.includes('isGradingExpenseForCard'), 'Accounting should match grading fee expenses back to the card.');
assert(page.includes('gradingFeeTotalForCard(card)') && page.includes('<span>Grading fees</span>'), 'Sold items should show their grading fees separately.');
assert(page.includes('totalCostBasisForCard') && page.includes('cardPurchaseCost(card) + gradingFeeTotalForCard(card)'), 'Sold ROI should include grading fees in cost basis.');
assert(page.includes('soldViewGradingFees') && page.includes('Grading fees shown'), 'Sold inventory totals should include grading fees.');
assert(css.includes('.gradingFeeModal') && css.includes('.gradingFeeRows') && css.includes('.gradingFeeBulkBar'), 'Grading fee modal needs desktop layout styles.');
assert(css.includes('@media (max-width: 720px)') && css.includes('.gradingFeeRow'), 'Grading fee modal needs mobile responsive styles.');

console.log('Grading fee feature checks passed.');
